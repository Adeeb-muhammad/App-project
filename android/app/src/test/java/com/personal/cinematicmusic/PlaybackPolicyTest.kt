package com.personal.cinematicmusic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Host-side tests for the queue rules used by the Capacitor plugin. */
class PlaybackPolicyTest {

    @Test
    fun acceptsOnlyContentUris() {
        assertTrue(
            PlaybackPolicy.isSupportedContentUri(
                "content://com.android.providers.media.documents/document/audio%3A42",
            ),
        )
        assertTrue(PlaybackPolicy.isSupportedContentUri("  content://media/external/audio/media/7 "))
        assertFalse(PlaybackPolicy.isSupportedContentUri("file:///sdcard/song.mp3"))
        assertFalse(PlaybackPolicy.isSupportedContentUri("https://example.com/song.mp3"))
        assertFalse(PlaybackPolicy.isSupportedContentUri(""))
        assertFalse(PlaybackPolicy.isSupportedContentUri(null))
    }

    @Test
    fun clampsTheRequestedStartIndex() {
        assertEquals(0, PlaybackPolicy.startIndex(0, 0))
        assertEquals(0, PlaybackPolicy.startIndex(-4, 3))
        assertEquals(0, PlaybackPolicy.startIndex(0, 3))
        assertEquals(2, PlaybackPolicy.startIndex(2, 3))
        assertEquals(2, PlaybackPolicy.startIndex(99, 3))
    }
}
