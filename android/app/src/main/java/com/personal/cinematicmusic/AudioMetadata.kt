package com.personal.cinematicmusic

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns

data class ImportedAudio(
    val uri: String,
    val fileName: String?,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val mimeType: String?,
)

/**
 * Reads display metadata for a SAF URI. Everything is best-effort: a provider
 * may expose no tags at all, in which case the file name becomes the title and
 * the track still plays.
 */
object AudioMetadataReader {

    fun read(context: Context, uri: Uri): ImportedAudio {
        val fileName = displayName(context, uri)
        var title: String? = null
        var artist: String? = null
        var album: String? = null
        var durationMs = 0L

        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, uri)
            title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
            artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
            album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)
            durationMs = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull()
                ?: 0L
        } catch (error: Exception) {
            // A corrupt or unsupported file still gets a row; ExoPlayer reports
            // the actual playback failure through `playbackError`. Only the
            // provider authority is logged, never the full content URI.
            android.util.Log.w(TAG, "could not read tags from ${safeLabel(uri)}", error)
        } finally {
            runCatching { retriever.release() }
        }

        val fallbackTitle = fileName
            ?.substringBeforeLast('.', fileName)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: "Untitled track"

        return ImportedAudio(
            uri = uri.toString(),
            fileName = fileName,
            title = title?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackTitle,
            artist = artist?.trim()?.takeIf { it.isNotEmpty() } ?: "Unknown artist",
            album = album?.trim()?.takeIf { it.isNotEmpty() } ?: "Imported audio",
            durationMs = durationMs.coerceAtLeast(0L),
            mimeType = context.contentResolver.getType(uri),
        )
    }

    private fun displayName(context: Context, uri: Uri): String? {
        try {
            context.contentResolver
                .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (index >= 0) {
                            val value = cursor.getString(index)
                            if (!value.isNullOrBlank()) return value
                        }
                    }
                }
        } catch (error: Exception) {
            android.util.Log.w(TAG, "could not read display name from ${safeLabel(uri)}", error)
        }
        return uri.lastPathSegment
    }

    /** Loggable form of a content URI: scheme and provider only, no file path. */
    private fun safeLabel(uri: Uri): String = "${uri.scheme}://${uri.authority}"

    private const val TAG = "CinematicAudio"
}
