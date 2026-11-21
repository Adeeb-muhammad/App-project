package com.personal.cinematicmusic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;

import androidx.core.content.ContextCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.google.common.util.concurrent.ListenableFuture;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Plays a `content://` URI — the only URI type the library accepts — through
 * both halves of the real pipeline: a bare ExoPlayer (does the data source read
 * the provider?) and the real {@link PlaybackService} via a
 * {@link MediaController} (does the production path keep playing?).
 *
 * The URI comes from {@link TestToneProvider} in the test APK, so it crosses an
 * app boundary exactly like a Storage Access Framework grant does.
 *
 * Needs a device or emulator (connectedDebugAndroidTest).
 */
@RunWith(AndroidJUnit4.class)
public class SafContentUriInstrumentedTest {

    private Context context;
    private ExoPlayer player;
    private MediaController controller;

    private Context context() {
        if (context == null) {
            context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        }
        return context;
    }

    @After
    public void tearDown() {
        if (player != null) {
            ExoPlayer current = player;
            player = null;
            onMain(() -> {
                current.release();
                return null;
            });
        }
        if (controller != null) {
            MediaController current = controller;
            controller = null;
            onMain(() -> {
                current.stop();
                current.clearMediaItems();
                current.release();
                return null;
            });
        }
    }

    @Test
    public void theTestProviderServesAReadableContentUri() {
        Uri uri = TestToneProvider.TONE_URI;
        assertEquals("content", uri.getScheme());
        assertEquals("audio/wav", context().getContentResolver().getType(uri));
        assertNotNull("the provider must be installed with the test APK",
            context().getContentResolver().getType(uri));
    }

    @Test
    public void exoPlayerPlaysAContentUriPastOneSecond() {
        player = onMain(() -> new ExoPlayer.Builder(context())
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus= */ false)
            .build());

        onMain(() -> {
            player.setMediaItem(MediaItem.fromUri(TestToneProvider.TONE_URI));
            player.prepare();
            player.play();
            return null;
        });

        await("player becomes ready", () -> player.getPlaybackState() == Player.STATE_READY, 15_000);
        await("player starts playing", player::isPlaying, 15_000);
        await("position passes 1 s", () -> position() > 1_000, 20_000);
        assertTrue("a content:// URI must keep decoding past one second",
            Boolean.TRUE.equals(onMain(player::isPlaying)));
    }

    @Test
    public void theServicePlaysAContentUriPastOneSecond() throws Exception {
        controller = connect();

        onMain(() -> {
            controller.setMediaItem(MediaItem.fromUri(TestToneProvider.TONE_URI));
            controller.prepare();
            controller.play();
            return null;
        });

        await("player becomes ready",
            () -> controller.getPlaybackState() == Player.STATE_READY, 15_000);
        await("player starts playing", controller::isPlaying, 15_000);
        await("position passes 1 s", () -> controllerPosition() > 1_000, 20_000);
        await("position passes 2 s", () -> controllerPosition() > 2_000, 20_000);
        assertTrue("the production path must keep playing a content:// URI",
            Boolean.TRUE.equals(onMain(() -> controller.isPlaying())));
    }

    // ------------------------------------------------------------------ utils

    private MediaController connect() throws Exception {
        SessionToken token = new SessionToken(
            context(), new ComponentName(context(), PlaybackService.class));
        ListenableFuture<MediaController> future =
            new MediaController.Builder(context(), token).buildAsync();
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<MediaController> reference = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        future.addListener(
            () -> {
                try {
                    reference.set(future.get());
                } catch (Throwable error) {
                    failure.set(error);
                } finally {
                    latch.countDown();
                }
            },
            ContextCompat.getMainExecutor(context()));
        assertTrue("timed out connecting to PlaybackService", latch.await(15, TimeUnit.SECONDS));
        if (failure.get() != null) throw new AssertionError(failure.get());
        assertNotNull(reference.get());
        return reference.get();
    }

    private long position() {
        Long value = onMain(player::getCurrentPosition);
        return value == null ? 0L : value;
    }

    private long controllerPosition() {
        Long value = onMain(() -> controller.getCurrentPosition());
        return value == null ? 0L : value;
    }

    private interface Condition {
        boolean isTrue();
    }

    private void await(String what, Condition condition, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            if (Boolean.TRUE.equals(onMain(condition::isTrue))) return;
            sleep(50);
        }
        throw new AssertionError("Timed out waiting for: " + what);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    private <T> T onMain(MainAction<T> action) {
        AtomicReference<T> result = new AtomicReference<>();
        AtomicReference<RuntimeException> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                result.set(action.run());
            } catch (RuntimeException error) {
                failure.set(error);
            }
        });
        if (failure.get() != null) throw failure.get();
        return result.get();
    }

    private interface MainAction<T> {
        T run();
    }
}
