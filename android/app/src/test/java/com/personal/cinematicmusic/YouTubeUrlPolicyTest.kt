package com.personal.cinematicmusic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class YouTubeUrlPolicyTest {

    @Test
    fun acceptsWatchShortAndMusicLinks() {
        val links = listOf(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc123",
        )
        for (link in links) {
            assertTrue("should accept $link", YouTubeUrlPolicy.isSupported(link))
        }
    }

    @Test
    fun trimsWhitespaceAndAddsAMissingScheme() {
        assertEquals(
            "https://youtu.be/dQw4w9WgXcQ",
            YouTubeUrlPolicy.normalise("  youtu.be/dQw4w9WgXcQ  "),
        )
        assertEquals(
            "https://www.youtube.com/watch?v=abc",
            YouTubeUrlPolicy.normalise("https://www.youtube.com/watch?v=abc"),
        )
    }

    @Test
    fun rejectsOtherSitesAndNonHttpSchemes() {
        val rejected = listOf(
            "",
            "   ",
            null,
            "not a url",
            "https://vimeo.com/22439234",
            "https://example.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com.evil.example/watch?v=1",
            "javascript:alert(1)",
            "file:///sdcard/music.mp3",
            "content://media/external/audio/media/1",
            "https://www.youtube.com/",
        )
        for (value in rejected) {
            assertNull("should reject $value", YouTubeUrlPolicy.normalise(value))
            assertFalse(YouTubeUrlPolicy.isSupported(value))
        }
    }

    @Test
    fun theRejectionMessageTellsTheUserWhatToPaste() {
        assertTrue(YouTubeUrlPolicy.INVALID_URL_MESSAGE.contains("https://"))
        assertTrue(YouTubeUrlPolicy.INVALID_URL_MESSAGE.startsWith("Paste"))
    }
}
