package com.personal.cinematicmusic

import androidx.media3.common.PlaybackException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Host-side tests for the playback failure messages the WebView receives.
 * A failure must always produce a readable, path-free explanation.
 */
class PlaybackErrorsTest {

    @Test
    fun missingFileAndPermissionLossesAskTheUserToImportAgain() {
        assertEquals(
            "Android can no longer open this file. Import it again to restore access.",
            PlaybackErrors.userMessage(PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND),
        )
        assertEquals(
            "Cinematic no longer has permission to read this file. Import it again to restore access.",
            PlaybackErrors.userMessage(PlaybackException.ERROR_CODE_IO_NO_PERMISSION),
        )
    }

    @Test
    fun codecAndParserFailuresAreDistinguished() {
        val unsupported = PlaybackErrors.userMessage(
            PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
        )
        val malformed = PlaybackErrors.userMessage(
            PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
        )
        assertNotEquals(unsupported, malformed)
        assertTrue(unsupported.contains("not supported"))
        assertTrue(malformed.contains("damaged"))
    }

    @Test
    fun messagesNeverContainAFileOrContentUri() {
        for (code in intArrayOf(
            PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
            PlaybackException.ERROR_CODE_IO_NO_PERMISSION,
            PlaybackException.ERROR_CODE_IO_UNSPECIFIED,
            PlaybackException.ERROR_CODE_DECODING_FAILED,
            PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED,
            PlaybackException.ERROR_CODE_UNSPECIFIED,
        )) {
            val message = PlaybackErrors.userMessage(code)
            assertTrue(message.isNotBlank())
            assertFalse(message.contains("content://"))
            assertFalse(message.contains("file://"))
        }
    }

    @Test
    fun codeNamesAreStableForLogcat() {
        assertEquals(
            "IO_FILE_NOT_FOUND",
            PlaybackErrors.codeName(PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND),
        )
        assertEquals(
            "DECODING_FAILED",
            PlaybackErrors.codeName(PlaybackException.ERROR_CODE_DECODING_FAILED),
        )
        assertEquals("ERROR_123456", PlaybackErrors.codeName(123456))
    }
}
