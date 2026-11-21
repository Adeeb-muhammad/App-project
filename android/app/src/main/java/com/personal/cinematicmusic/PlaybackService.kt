package com.personal.cinematicmusic

import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Owns playback for the whole app.
 *
 * MediaSessionService runs ExoPlayer in a foreground service, publishes the
 * MediaSession (notification, lock screen, Bluetooth/headset buttons) and keeps
 * audio alive when the WebView is backgrounded or the screen is off.
 *
 * The Capacitor plugin never creates a player: it controls this service through
 * a MediaController so there is exactly one playback engine.
 */
class PlaybackService : MediaSessionService() {

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null

    /**
     * Logs the transitions that decide whether the service is allowed to stay in
     * the foreground. `adb logcat -s CinematicPlayback` is then enough to see
     * when Android actually started decoding and when it stopped.
     */
    private val playerListener = object : Player.Listener {
        override fun onPlayerError(error: PlaybackException) {
            // Reported to the WebView by the plugin as well. Logging it here
            // means a failure is still visible when the Activity is gone.
            Log.e(
                PlaybackErrors.TAG,
                "playback error ${error.errorCodeName} (${error.errorCode})",
                error.cause,
            )
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            Log.i(TAG, "isPlaying=$isPlaying state=${player?.playbackState}")
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            Log.i(TAG, "playbackState=$playbackState")
        }
    }

    override fun onCreate() {
        super.onCreate()

        val exoPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build()
        exoPlayer.addListener(playerListener)

        player = exoPlayer
        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setSessionActivity(openAppIntent())
            .build()
        Log.i(TAG, "service created")
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    /**
     * Dismissing the task must not silence ongoing playback, but it must not
     * leave a silent paused service running forever either. Media3 only keeps
     * the service alive while playback is genuinely ongoing.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val current = player
        val playbackOngoing = current != null &&
            current.mediaItemCount > 0 &&
            current.playWhenReady &&
            current.playbackState != Player.STATE_IDLE &&
            current.playbackState != Player.STATE_ENDED
        if (playbackOngoing) {
            Log.i(TAG, "task removed while playing, keeping playback")
        } else {
            Log.i(TAG, "task removed while idle, stopping service")
            current?.pause()
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        Log.i(TAG, "service destroyed")
        mediaSession?.run {
            player.removeListener(playerListener)
            player.release()
            release()
        }
        mediaSession = null
        player = null
        super.onDestroy()
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private companion object {
        const val TAG = "CinematicPlayback"
    }
}
