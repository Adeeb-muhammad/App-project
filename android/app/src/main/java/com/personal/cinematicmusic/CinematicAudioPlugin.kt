package com.personal.cinematicmusic

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
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
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.Executors

/**
 * JS ↔ Kotlin bridge for local playback.
 *
 * File access uses ACTION_OPEN_DOCUMENT and takes a persistable read grant, so
 * no storage permission is requested and the app can only open the exact files
 * the user picked.
 *
 * The plugin owns exactly one [MediaController] connection. Every call waits for
 * (or reuses) that same connection instead of opening a new one, so overlapping
 * JS calls cannot create duplicate controllers or talk to a released player.
 *
 * The media notification is posted by Media3 inside [PlaybackService]. The app
 * never asks for POST_NOTIFICATIONS at runtime: a denied permission only hides
 * the notification, it does not affect playback, so prompting (or warning about
 * it) would be noise. Users who want the notice can enable it in system
 * settings.
 */
@CapacitorPlugin(name = "CinematicAudio")
class CinematicAudioPlugin : Plugin() {

    private var controller: MediaController? = null

    /**
     * The single in-flight connection. Memoising it is what makes overlapping
     * calls (tap a song, then immediately pause) share one controller.
     */
    private var pendingController: ListenableFuture<MediaController>? = null

    private var destroyed = false

    /**
     * The last queue handed to the service. Android may destroy and recreate
     * [PlaybackService] (low memory, task removal, an OEM killing the process'
     * service); the recreated player is empty, so without this the transport
     * buttons would silently do nothing. The queue is re-applied as soon as a
     * fresh controller connects.
     */
    private var lastItems: List<MediaItem> = emptyList()
    private var lastIndex = 0
    private var lastPositionMs = 0L
    private var lastWasPlaying = false

    private val handler = Handler(Looper.getMainLooper())
    private val metadataExecutor = Executors.newSingleThreadExecutor()

    private val playerListener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            rememberPosition(player)
            emitPlaybackState(player)
            updateTicker(player.isPlaying)
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            emitPlaybackState(controller)
        }

        override fun onPlayerError(error: PlaybackException) {
            // Without this the WebView kept showing "playing" after ExoPlayer had
            // already stopped.
            Log.e(
                PlaybackErrors.TAG,
                "playback error ${error.errorCodeName} (${error.errorCode})",
                error.cause,
            )
            updateTicker(false)
            val payload = JSObject().apply {
                put("code", error.errorCode)
                put("codeName", PlaybackErrors.codeName(error.errorCode))
                put("message", PlaybackErrors.userMessage(error.errorCode))
                put("trackId", controller?.currentMediaItem?.mediaId)
            }
            notifyListeners("playbackError", payload)
            emitPlaybackState(controller)
        }
    }

    private val ticker = object : Runnable {
        override fun run() {
            val player = controller ?: return
            if (!player.isPlaying) return
            rememberPosition(player)
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

        // A readable tag block does not prove the file can be read later, so the
        // descriptor is opened once before the track is offered to the library.
        if (!canRead(uri)) {
            call.reject("Android could not open that file. Try another audio file.")
            return
        }

        val appContext = context.applicationContext
        // MediaMetadataRetriever reads the whole tag block. Doing that on the
        // main thread is what makes imports of large files hang the WebView.
        metadataExecutor.execute {
            val audio = try {
                AudioMetadataReader.read(appContext, uri)
            } catch (error: Exception) {
                Log.w(PlaybackErrors.TAG, "metadata read failed", error)
                handler.post { call.reject("That file could not be read as audio.") }
                return@execute
            }
            if (destroyed) return@execute
            val payload = JSObject().apply {
                put("uri", audio.uri)
                put("fileName", audio.fileName)
                put("title", audio.title)
                put("artist", audio.artist)
                put("album", audio.album)
                put("durationMs", audio.durationMs)
                put("mimeType", audio.mimeType)
            }
            handler.post { if (!destroyed) call.resolve(payload) }
        }
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

        val safeIndex = PlaybackPolicy.startIndex(startIndex, items.size)
        lastItems = items
        lastIndex = safeIndex
        lastPositionMs = 0L

        withController(call) { mediaController ->
            mediaController.setMediaItems(items, safeIndex, 0L)
            mediaController.prepare()
            if (autoplay) mediaController.play() else mediaController.pause()
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
        lastItems = emptyList()
        lastIndex = 0
        lastPositionMs = 0L
        lastWasPlaying = false
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
        lastPositionMs = positionMs.coerceAtLeast(0L)
        withController(call) { mediaController ->
            mediaController.seekTo(lastPositionMs)
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
        if (mediaController?.isConnected == true) {
            call.resolve(statePayload(mediaController))
            return
        }
        if (mediaController == null && pendingController == null) {
            // Nothing is connected and nothing is connecting: report "no
            // playback" instead of waking the service.
            call.resolve(emptyState())
            return
        }
        withController(call) { connected ->
            call.resolve(statePayload(connected))
        }
    }

    // ------------------------------------------------------------ connection

    /**
     * Runs [block] with the one connected controller, connecting first if needed.
     * Concurrent callers share the same connection future, so only one
     * MediaController is ever created.
     */
    private fun withController(call: PluginCall, block: (MediaController) -> Unit) {
        controller?.let { existing ->
            if (existing.isConnected) {
                restoreQueueIfNeeded(existing)
                block(existing)
                return
            }
            // The service went away: drop the dead connection and reconnect
            // instead of sending commands into a released controller.
            Log.w(PlaybackErrors.TAG, "controller disconnected, reconnecting")
            existing.removeListener(playerListener)
            existing.release()
            controller = null
        }

        if (destroyed) {
            call.reject(UNAVAILABLE_MESSAGE)
            return
        }

        val future = pendingController ?: run {
            val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
            MediaController.Builder(context, token)
                .buildAsync()
                .also { pendingController = it }
        }

        future.addListener(
            {
                if (destroyed) {
                    call.reject(UNAVAILABLE_MESSAGE)
                    return@addListener
                }
                try {
                    val mediaController = future.get()
                    if (pendingController === future) pendingController = null
                    val current = controller
                    if (current == null) {
                        controller = mediaController
                        mediaController.addListener(playerListener)
                    } else if (current !== mediaController) {
                        // A second connection raced the first one; keep the
                        // player that commands are already going to.
                        mediaController.release()
                    }
                    val connected = controller ?: mediaController
                    restoreQueueIfNeeded(connected)
                    block(connected)
                } catch (error: Exception) {
                    if (pendingController === future) pendingController = null
                    Log.e(PlaybackErrors.TAG, "could not connect to the playback service", error)
                    call.reject(UNAVAILABLE_MESSAGE, error)
                }
            },
            ContextCompat.getMainExecutor(context),
        )
    }

    /**
     * Pushes the remembered queue back into a player that has none.
     *
     * A recreated [PlaybackService] starts with an empty `ExoPlayer`, so after a
     * reconnect every transport command would be a no-op and the UI would look
     * like it was playing while nothing happened. Restoring the queue — and the
     * position the user was at — keeps playback controllable across a service
     * restart.
     */
    private fun restoreQueueIfNeeded(mediaController: MediaController) {
        if (lastItems.isEmpty()) return
        if (mediaController.mediaItemCount > 0) return
        if (mediaController.playbackState != Player.STATE_IDLE) return

        Log.i(
            PlaybackErrors.TAG,
            "restoring ${lastItems.size} queued item(s) after a service reconnect",
        )
        mediaController.setMediaItems(lastItems, lastIndex, lastPositionMs)
        mediaController.prepare()
        if (lastWasPlaying) mediaController.play()
    }

    private fun rememberPosition(player: Player) {
        if (lastItems.isEmpty()) return
        if (player.mediaItemCount == 0) return
        lastIndex = player.currentMediaItemIndex
        lastPositionMs = player.currentPosition.coerceAtLeast(0L)
        lastWasPlaying = player.playWhenReady
    }

    private fun updateTicker(playing: Boolean) {
        handler.removeCallbacks(ticker)
        if (playing) handler.postDelayed(ticker, POSITION_TICK_MS)
    }

    private fun emitPlaybackState(player: Player?) {
        if (destroyed) return
        val current = player ?: controller ?: return
        notifyListeners("playbackState", statePayload(current))
    }

    private fun statePayload(player: Player): JSObject {
        val item = player.currentMediaItem
        val duration = player.duration
        val error = player.playerError
        return JSObject().apply {
            put("trackId", item?.mediaId)
            put("index", player.currentMediaItemIndex)
            put("isPlaying", player.isPlaying)
            put("playWhenReady", player.playWhenReady)
            put("playbackState", playbackStateName(player.playbackState))
            put("positionMs", player.currentPosition.coerceAtLeast(0L))
            put("durationMs", if (duration > 0) duration else 0L)
            put("buffering", player.playbackState == Player.STATE_BUFFERING)
            put("ended", player.playbackState == Player.STATE_ENDED)
            put("errorCode", error?.let { PlaybackErrors.codeName(it.errorCode) })
        }
    }

    private fun emptyState(): JSObject = JSObject().apply {
        put("trackId", null)
        put("index", -1)
        put("isPlaying", false)
        put("playWhenReady", false)
        put("playbackState", "idle")
        put("positionMs", 0L)
        put("durationMs", 0L)
        put("buffering", false)
        put("ended", false)
        put("errorCode", null)
    }

    private fun playbackStateName(state: Int): String = when (state) {
        Player.STATE_IDLE -> "idle"
        Player.STATE_BUFFERING -> "buffering"
        Player.STATE_READY -> "ready"
        Player.STATE_ENDED -> "ended"
        else -> "unknown"
    }

    // --------------------------------------------------------------- helpers

    private fun canRead(uri: Uri): Boolean = try {
        context.contentResolver.openInputStream(uri)?.use { it.read() } != null
    } catch (error: Exception) {
        Log.w(PlaybackErrors.TAG, "content URI is not readable after the picker", error)
        false
    }

    override fun handleOnDestroy() {
        destroyed = true
        handler.removeCallbacks(ticker)
        pendingController?.cancel(true)
        pendingController = null
        controller?.removeListener(playerListener)
        controller?.release()
        controller = null
        metadataExecutor.shutdownNow()
        super.handleOnDestroy()
    }

    companion object {
        private const val POSITION_TICK_MS = 500L
        private const val PREVIOUS_RESTART_MS = 3_000L
        private const val UNAVAILABLE_MESSAGE = "Playback service is unavailable"
    }
}
