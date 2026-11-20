package com.personal.cinematicmusic

/**
 * Pure playback rules shared by the plugin and the host unit tests.
 * Keeping these decisions out of the Android classes lets `testDebugUnitTest`
 * verify them without an emulator.
 */
object PlaybackPolicy {

    /** Only Storage Access Framework content URIs may enter the media queue. */
    fun isSupportedContentUri(uri: String?): Boolean {
        if (uri == null) return false
        val value = uri.trim()
        return value.startsWith("content://", ignoreCase = true)
    }

    /** Clamps a requested queue position to a valid index. */
    fun startIndex(requested: Int, size: Int): Int = when {
        size <= 0 -> 0
        requested < 0 -> 0
        requested >= size -> size - 1
        else -> requested
    }
}
