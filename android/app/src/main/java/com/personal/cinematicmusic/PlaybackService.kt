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
 * a MediaController so there is exactly one playback engine, and the queue lives
 * here rather than in the WebView. `adb logcat -s CinematicPlayback` shows every
 * transition that decides whether playback is allowed to continue.
 */
class PlaybackService : MediaSessionService() {

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null

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

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            // This is where a silent stop shows up. ExoPlayer clears
            // playWhenReady on a permanent audio-focus loss and on an
            // audio-becoming-noisy broadcast; both look identical to the user
            // ("the music just stopped") and neither is a playback error, so
            // the reason is logged explicitly.
            Log.i(
                TAG,
                "playWhenReady=$playWhenReady reason=${reasonName(reason)} isPlaying=${player?.isPlaying}",
            )
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
     * Media3 already implements the documented policy here: keep the service
     * when playback is genuinely ongoing (foreground service plus a playing
     * session), otherwise pause and stop it so the system does not restart a
     * dead service. The app previously re-implemented that decision in this
     * method and then called `stopSelf()` on its own narrower verdict, which
     * could tear the service down while Media3 still considered playback
     * ongoing — audio then stopped with no error at all. Delegating removes that
     * second source of truth.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.i(TAG, "task removed; handing the keep-or-stop decision to Media3")
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

    private fun reasonName(reason: Int): String = when (reason) {
        Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST -> "USER_REQUEST"
        Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS -> "AUDIO_FOCUS_LOSS"
        Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY -> "AUDIO_BECOMING_NOISY"
        Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM -> "END_OF_MEDIA_ITEM"
        Player.PLAY_WHEN_READY_CHANGE_REASON_REMOTE -> "REMOTE"
        else -> "OTHER_$reason"
    }

    private companion object {
        const val TAG = "CinematicPlayback"
    }
}
