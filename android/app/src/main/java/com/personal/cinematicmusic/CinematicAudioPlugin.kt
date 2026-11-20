package com.personal.cinematicmusic

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.activity.result.ActivityResult
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * JS ↔ Kotlin bridge for local playback.
 *
 * File access uses ACTION_OPEN_DOCUMENT and takes a persistable read grant, so
 * no storage permission is requested and the app can only open the exact files
 * the user picked.
 */
@CapacitorPlugin(name = "CinematicAudio")
class CinematicAudioPlugin : Plugin() {

    private var controller: MediaController? = null
    private val handler = Handler(Looper.getMainLooper())

    private val playerListener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            emitPlaybackState(player)
            updateTicker(player.isPlaying)
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            emitPlaybackState(controller)
        }
    }

    private val ticker = object : Runnable {
        override fun run() {
            val player = controller ?: return
            if (!player.isPlaying) return
            emitPlaybackState(player)
            handler.postDelayed(this, POSITION_TICK_MS)
        }
    }

    // ---------------------------------------------------------------- picker

    @PluginMethod
    fun pickAudio(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "audio/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "audioPickerResult")
    }

    @ActivityCallback
    private fun audioPickerResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Selection cancelled")
            return
        }
        val uri: Uri? = result.data?.data
        if (uri == null) {
            call.reject("No audio file was selected")
            return
        }

        // The grant must outlive the picker, otherwise a saved track would stop
        // playing after the app restarts.
        try {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        } catch (error: SecurityException) {
            call.reject("Android did not grant lasting access to that file", error)
            return
        }

        val audio = AudioMetadataReader.read(context, uri)
        val payload = JSObject().apply {
            put("uri", audio.uri)
            put("fileName", audio.fileName)
            put("title", audio.title)
            put("artist", audio.artist)
            put("album", audio.album)
            put("durationMs", audio.durationMs)
            put("mimeType", audio.mimeType)
        }
        call.resolve(payload)
    }

    // -------------------------------------------------------------- playback

    @PluginMethod
    fun setQueue(call: PluginCall) {
        val tracks: JSArray = call.getArray("tracks") ?: run {
            call.reject("tracks is required")
            return
        }
        val startIndex = call.getInt("startIndex") ?: 0
        val autoplay = call.getBoolean("autoplay") ?: true

        val items = ArrayList<MediaItem>()
        for (index in 0 until tracks.length()) {
            val entry = tracks.getJSONObject(index) ?: continue
            val uri = entry.optString("uri")
            if (!PlaybackPolicy.isSupportedContentUri(uri)) {
                call.reject("Unsupported audio URI")
                return
            }
            val metadata = MediaMetadata.Builder()
                .setTitle(entry.optString("title", "Unknown track"))
                .setArtist(entry.optString("artist", "Unknown artist"))
                .setAlbumTitle(entry.optString("album", "Imported audio"))
                .build()
            items.add(
                MediaItem.Builder()
                    .setMediaId(entry.optString("id", uri))
                    .setUri(uri)
                    .setMediaMetadata(metadata)
                    .build(),
            )
        }

        if (items.isEmpty()) {
            call.reject("Queue is empty")
            return
        }

        withController(call) { mediaController ->
            mediaController.setMediaItems(
                items,
                PlaybackPolicy.startIndex(startIndex, items.size),
                0L,
            )
            mediaController.prepare()
            if (autoplay) mediaController.play() else mediaController.pause()
            requestNotificationPermission()
            emitPlaybackState(mediaController)
            call.resolve()
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        withController(call) { mediaController ->
            if (mediaController.playbackState == Player.STATE_ENDED) {
                mediaController.seekTo(0L)
            }
            mediaController.play()
            requestNotificationPermission()
            call.resolve()
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        withController(call) { mediaController ->
            mediaController.pause()
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val mediaController = controller
        if (mediaController == null) {
            call.resolve()
            return
        }
        mediaController.stop()
        mediaController.clearMediaItems()
        handler.removeCallbacks(ticker)
        emitPlaybackState(mediaController)
        call.resolve()
    }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val positionMs = call.getLong("positionMs") ?: 0L
        withController(call) { mediaController ->
            mediaController.seekTo(positionMs.coerceAtLeast(0L))
            call.resolve()
        }
    }

    @PluginMethod
    fun next(call: PluginCall) {
        withController(call) { mediaController ->
            if (mediaController.hasNextMediaItem()) mediaController.seekToNextMediaItem()
            call.resolve()
        }
    }

    @PluginMethod
    fun previous(call: PluginCall) {
        withController(call) { mediaController ->
            if (mediaController.currentPosition > PREVIOUS_RESTART_MS) {
                mediaController.seekTo(0L)
            } else if (mediaController.hasPreviousMediaItem()) {
                mediaController.seekToPreviousMediaItem()
            } else {
                mediaController.seekTo(0L)
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        val mediaController = controller
        if (mediaController == null) {
            call.resolve(emptyState())
            return
        }
        call.resolve(statePayload(mediaController))
    }

    // --------------------------------------------------------------- helpers

    private fun withController(call: PluginCall, block: (MediaController) -> Unit) {
        controller?.let {
            block(it)
            return
        }

        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener(
            {
                try {
                    val mediaController = future.get()
                    controller = mediaController
                    mediaController.addListener(playerListener)
                    block(mediaController)
                } catch (error: Exception) {
                    call.reject("Playback service is unavailable", error)
                }
            },
            ContextCompat.getMainExecutor(context),
        )
    }

    private fun updateTicker(playing: Boolean) {
        handler.removeCallbacks(ticker)
        if (playing) handler.postDelayed(ticker, POSITION_TICK_MS)
    }

    private fun emitPlaybackState(player: Player?) {
        val current = player ?: controller ?: return
        notifyListeners("playbackState", statePayload(current))
    }

    private fun statePayload(player: Player): JSObject {
        val item = player.currentMediaItem
        val duration = player.duration
        return JSObject().apply {
            put("trackId", item?.mediaId)
            put("index", player.currentMediaItemIndex)
            put("isPlaying", player.isPlaying)
            put("positionMs", player.currentPosition.coerceAtLeast(0L))
            put("durationMs", if (duration > 0) duration else 0L)
            put("buffering", player.playbackState == Player.STATE_BUFFERING)
            put("ended", player.playbackState == Player.STATE_ENDED)
        }
    }

    private fun emptyState(): JSObject = JSObject().apply {
        put("trackId", null)
        put("index", -1)
        put("isPlaying", false)
        put("positionMs", 0L)
        put("durationMs", 0L)
        put("buffering", false)
        put("ended", false)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val host = bridge?.activity ?: return
        if (
            ContextCompat.checkSelfPermission(host, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        ActivityCompat.requestPermissions(
            host,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            NOTIFICATION_REQUEST_CODE,
        )
    }

    override fun handleOnDestroy() {
        handler.removeCallbacks(ticker)
        controller?.removeListener(playerListener)
        controller?.release()
        controller = null
        super.handleOnDestroy()
    }

    private companion object {
        const val POSITION_TICK_MS = 500L
        const val PREVIOUS_RESTART_MS = 3_000L
        const val NOTIFICATION_REQUEST_CODE = 4101
    }
}
