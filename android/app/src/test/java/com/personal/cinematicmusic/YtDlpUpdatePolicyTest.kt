package com.personal.cinematicmusic

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class YtDlpUpdatePolicyTest {

    @Test
    fun firstDownloadChecksForAnUpdate() {
        assertTrue(YtDlpUpdatePolicy.isCheckDue(0L, 1_000L))
    }

    @Test
    fun repeatDownloadsWithin24HoursSkipTheReleaseCheck() {
        val lastCheck = 10_000L
        assertFalse(
            YtDlpUpdatePolicy.isCheckDue(
                lastCheck,
                lastCheck + YtDlpUpdatePolicy.CHECK_INTERVAL_MS - 1L,
            ),
        )
    }

    @Test
    fun aCheckBecomesDueAfter24Hours() {
        val lastCheck = 10_000L
        assertTrue(
            YtDlpUpdatePolicy.isCheckDue(
                lastCheck,
                lastCheck + YtDlpUpdatePolicy.CHECK_INTERVAL_MS,
            ),
        )
    }

    @Test
    fun aClockMovingBackwardsDoesNotLockOutFutureChecks() {
        assertTrue(YtDlpUpdatePolicy.isCheckDue(20_000L, 10_000L))
    }
}
