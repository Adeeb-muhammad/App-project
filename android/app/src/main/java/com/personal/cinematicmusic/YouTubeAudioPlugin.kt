package com.personal.cinematicmusic

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.util.concurrent.Executors

/**
 * Downloads the audio track of a YouTube video as an MP3 and hands it back as a
 * `content://` URI, which is the exact shape the library and the player already
 * understand (the same payload `pickAudio` resolves with).
 *
 * Why an MP3 in app-private storage rather than a streamed link: the rest of the
 * app plays local documents only and keeps working offline, so a download that
 * lands somewhere dependable is the only integration that does not change the
 * playback architecture.
 *
 * The heavy work (yt-dlp's bundled Python, FFmpeg) runs on a single background
 * thread; only progress events and the final resolve touch the WebView.
 */
@CapacitorPlugin(name = "YouTubeAudio")
class YouTubeAudioPlugin : Plugin() {

    private val worker = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    @Volatile
    private var downloading = false

    @Volatile
    private var destroyed = false

    @PluginMethod
    fun download(call: PluginCall) {
        val url = YouTubeUrlPolicy.normalise(call.getString("url"))
        if (url == null) {
            call.reject(YouTubeUrlPolicy.INVALID_URL_MESSAGE)
            return
        }
        if (downloading) {
            call.reject("A download is already running. Wait for it to finish.")
            return
        }

        downloading = true
        val appContext = context.applicationContext
        val targetDir = File(appContext.filesDir, DOWNLOAD_DIR).apply { mkdirs() }

        worker.execute {
            try {
                YoutubeDL.getInstance().init(appContext)
                FFmpeg.getInstance().init(appContext)

                val request = YoutubeDLRequest(url).apply {
                    addOption("--no-mtime")
                    addOption("--no-playlist")
                    // Audio only, then convert to MP3 with the bundled FFmpeg.
                    addOption("-x")
                    addOption("--audio-format", "mp3")
                    addOption("--audio-quality", "0")
                    addOption("-o", File(targetDir, "$FILE_TEMPLATE.%(ext)s").absolutePath)
                }

                YoutubeDL.getInstance().execute(request, PROCESS_ID) { progress, eta, line ->
                    emitProgress(progress, eta, line)
                }

                val produced = newestMp3(targetDir)
                if (produced == null) {
                    handler.post {
                        call.reject("The download finished but no MP3 was produced.")
                    }
                    return@execute
                }

                val uri = FileProvider.getUriForFile(appContext, authority(appContext), produced)
                val audio = AudioMetadataReader.read(appContext, uri)
                val payload = JSObject().apply {
                    put("uri", audio.uri)
                    put("fileName", audio.fileName)
                    put("title", audio.title)
                    put("artist", audio.artist)
                    put("album", audio.album)
                    put("durationMs", audio.durationMs)
                    put("mimeType", audio.mimeType ?: "audio/mpeg")
                }
                Log.i(TAG, "download finished: ${produced.name}")
                handler.post { if (!destroyed) call.resolve(payload) }
            } catch (error: Throwable) {
                // yt-dlp reports its own failures (private video, no network,
                // outdated extractor) as exceptions with a usable line.
                Log.e(TAG, "download failed", error)
                val message = failureMessage(error)
                handler.post { if (!destroyed) call.reject(message) }
            } finally {
                downloading = false
            }
        }
    }

    private fun emitProgress(progress: Float, etaSeconds: Long, line: String) {
        val payload = JSObject().apply {
            put("percent", progress.toInt())
            put("etaSeconds", etaSeconds)
            put("line", line.take(MAX_LINE).trim())
        }
        handler.post { if (!destroyed) notifyListeners("downloadProgress", payload) }
    }

    /**
     * yt-dlp writes `%(title)s.%(ext)s` (plus a temporary `.part` file) into the
     * download directory, so the result is the newest `.mp3` there.
     */
    private fun newestMp3(dir: File): File? = dir
        .listFiles { file -> file.isFile && file.extension.equals("mp3", ignoreCase = true) }
        ?.maxByOrNull { it.lastModified() }

    private fun authority(context: Context): String =
        "${context.packageName}.downloads"

    private fun failureMessage(error: Throwable): String {
        val firstLine = error.message
            ?.lineSequence()
            ?.map { it.trim().removePrefix("ERROR:").trim() }
            ?.firstOrNull { it.isNotEmpty() }
            ?.take(MAX_LINE)
        return firstLine?.takeIf { it.isNotEmpty() }
            ?: "The download failed. Check the link and your connection, then try again."
    }

    override fun handleOnDestroy() {
        destroyed = true
        worker.shutdownNow()
        super.handleOnDestroy()
    }

    private companion object {
        const val TAG = "CinematicDownload"
        const val DOWNLOAD_DIR = "downloads"
        const val PROCESS_ID = "cinematic-youtube-download"
        const val MAX_LINE = 200

        /** Kept short and sanitised so a hostile title cannot escape the folder. */
        const val FILE_TEMPLATE = "%(title).150B [%(id)s]"
    }
}
