package com.personal.cinematicmusic

/**
 * Throttles yt-dlp's release lookup so repeat downloads do not make a needless
 * network request before every track. A failed check is not recorded by the
 * caller, so the next download can retry it.
 */
internal object YtDlpUpdatePolicy {
    const val CHECK_INTERVAL_MS = 24L * 60L * 60L * 1000L

    fun isCheckDue(lastSuccessfulCheckMs: Long, nowMs: Long): Boolean {
        if (lastSuccessfulCheckMs <= 0L || nowMs < lastSuccessfulCheckMs) return true
        return nowMs - lastSuccessfulCheckMs >= CHECK_INTERVAL_MS
    }
}
