package com.personal.cinematicmusic

import java.net.URI

/**
 * Decides which links the downloader will accept.
 *
 * The rule is intentionally narrow — YouTube video links only, http(s) only —
 * because the input arrives from a text field and is handed to a bundled
 * downloader. Keeping it pure means `testDebugUnitTest` can prove the rejection
 * cases without a device or a network connection.
 */
object YouTubeUrlPolicy {

    const val INVALID_URL_MESSAGE =
        "Paste a full YouTube video link, for example https://www.youtube.com/watch?v=…"

    fun isSupported(raw: String?): Boolean = normalise(raw) != null

    /**
     * Trims the input, adds `https://` when the scheme is missing, and returns
     * the canonical URL — or `null` when this is not a YouTube video link.
     */
    fun normalise(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return null

        val withScheme = when {
            trimmed.startsWith("https://", ignoreCase = true) -> "https://" + trimmed.substring(8)
            trimmed.startsWith("http://", ignoreCase = true) -> "http://" + trimmed.substring(7)
            trimmed.contains("://") -> return null
            else -> "https://$trimmed"
        }

        val uri = try {
            URI(withScheme)
        } catch (error: Exception) {
            return null
        }

        val host = uri.host?.lowercase() ?: return null
        if (!isYouTubeHost(host)) return null
        val path = uri.path.orEmpty()
        if (path.isBlank() || path == "/") return null
        return withScheme
    }

    /** `youtu.be` short links, plus youtube.com and its subdomains. */
    private fun isYouTubeHost(host: String): Boolean =
        host == "youtu.be" || host == "youtube.com" || host.endsWith(".youtube.com")
}
