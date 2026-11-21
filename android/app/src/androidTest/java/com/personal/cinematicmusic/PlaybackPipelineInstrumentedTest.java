package com.personal.cinematicmusic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.net.Uri;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Exercises the real Media3 playback pipeline with a generated audio file, not a
 * fake: ExoPlayer must open the asset, advance, pause, resume, finish and report
 * a failure for a missing file. The MediaSession must mirror the player state.
 *
 * Requires a device or emulator (`connectedDebugAndroidTest`); compiling this
 * class is not proof that playback works.
 */
@RunWith(AndroidJUnit4.class)
public class PlaybackPipelineInstrumentedTest {

    private interface Condition {
        boolean isTrue();
    }

    private Context context;
    private ExoPlayer player;
    private MediaSession session;
    private File toneFile;

    @Before
    public void setUp() throws IOException {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        toneFile = writeTone(context, "cinematic-test-tone.wav", 8_000, 1_000);
        player = onMain(() -> new ExoPlayer.Builder(context)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus= */ false)
            .build());
        session = onMain(() -> new MediaSession.Builder(context, player).build());
    }

    @After
    public void tearDown() {
        onMain(() -> {
            if (session != null) {
                player.release();
                session.release();
                session = null;
            }
            return null;
        });
        player = null;
        if (toneFile != null) {
            //noinspection ResultOfMethodCallIgnored
            toneFile.delete();
        }
    }

    @Test
    public void generatedTonePreparesPlaysPausesResumesAndFinishes() {
        onMain(() -> {
            player.setMediaItem(MediaItem.fromUri(Uri.fromFile(toneFile)));
            player.prepare();
            player.play();
            return null;
        });

        await("player becomes ready", () -> player.getPlaybackState() == Player.STATE_READY, 10_000);
        await("player starts playing", player::isPlaying, 10_000);

        long firstPosition = awaitPositionAdvance(300);
        long laterPosition = awaitPositionAdvance(600);
        assertTrue(
            "position must keep advancing (was " + firstPosition + " then " + laterPosition + ")",
            laterPosition > firstPosition
        );

        onMain(() -> {
            player.pause();
            return null;
        });
        await("pause takes effect", () -> !player.isPlaying(), 5_000);
        long pausedPosition = currentPosition();
        sleep(400);
        assertTrue(
            "position must not advance while paused",
            Math.abs(currentPosition() - pausedPosition) < 250
        );

        onMain(() -> {
            player.play();
            return null;
        });
        await("playback resumes", player::isPlaying, 5_000);

        await("playback reaches the end", () -> player.getPlaybackState() == Player.STATE_ENDED, 15_000);
        assertFalse("a finished track is no longer playing", Boolean.TRUE.equals(onMain(() -> player.isPlaying())));
    }

    @Test
    public void mediaSessionMirrorsThePlayer() {
        onMain(() -> {
            player.setMediaItem(MediaItem.fromUri(Uri.fromFile(toneFile)));
            player.prepare();
            player.play();
            return null;
        });
        await("player starts playing", player::isPlaying, 10_000);

        assertEquals(player, onMain(() -> session.getPlayer()));
        assertTrue(
            "the session must expose the playing state",
            Boolean.TRUE.equals(onMain(() -> session.getPlayer().isPlaying()))
        );
        assertTrue(currentPosition() >= 0);
    }

    @Test
    public void missingFileIsReportedAsAPlaybackError() {
        AtomicReference<PlaybackException> failure = new AtomicReference<>();
        onMain(() -> {
            player.addListener(new Player.Listener() {
                @Override
                public void onPlayerError(PlaybackException error) {
                    failure.set(error);
                }
            });
            File missing = new File(context.getCacheDir(), "does-not-exist.mp3");
            player.setMediaItem(MediaItem.fromUri(Uri.fromFile(missing)));
            player.prepare();
            return null;
        });

        await("a playback error reaches the listener", () -> failure.get() != null, 10_000);
        PlaybackException error = failure.get();
        assertNotNull(error);
        assertFalse(
            "the user message must not be empty",
            PlaybackErrors.INSTANCE.userMessage(error.errorCode).isEmpty()
        );
        assertFalse(PlaybackErrors.INSTANCE.codeName(error.errorCode).isEmpty());
    }

    // ------------------------------------------------------------------ utils

    private long awaitPositionAdvance(long fromMs) {
        await("position passes " + fromMs + "ms", () -> currentPosition() > fromMs, 10_000);
        return currentPosition();
    }

    private long currentPosition() {
        Long position = onMain(player::getCurrentPosition);
        return position == null ? 0L : position;
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

    /** Runs [action] on the main thread, which is where the player lives. */
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

    /** Writes a mono 16-bit PCM sine tone so the test never ships copyrighted audio. */
    private static File writeTone(Context context, String name, int sampleRate, int durationMs)
        throws IOException {
        File file = new File(context.getCacheDir(), name);
        int samples = (sampleRate * durationMs) / 1000;
        int dataBytes = samples * 2;
        try (DataOutputStream out = new DataOutputStream(
            new BufferedOutputStream(new FileOutputStream(file)))) {
            out.writeBytes("RIFF");
            writeLittleEndianInt(out, 36 + dataBytes);
            out.writeBytes("WAVE");
            out.writeBytes("fmt ");
            writeLittleEndianInt(out, 16);
            writeLittleEndianShort(out, 1); // PCM
            writeLittleEndianShort(out, 1); // mono
            writeLittleEndianInt(out, sampleRate);
            writeLittleEndianInt(out, sampleRate * 2);
            writeLittleEndianShort(out, 2);
            writeLittleEndianShort(out, 16);
            out.writeBytes("data");
            writeLittleEndianInt(out, dataBytes);
            for (int index = 0; index < samples; index += 1) {
                double value = Math.sin(2.0 * Math.PI * 440.0 * index / sampleRate);
                writeLittleEndianShort(out, (int) Math.round(value * 8000));
            }
        }
        return file;
    }

    private static void writeLittleEndianInt(DataOutputStream out, int value) throws IOException {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
        out.write((value >> 16) & 0xff);
        out.write((value >> 24) & 0xff);
    }

    private static void writeLittleEndianShort(DataOutputStream out, int value) throws IOException {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
    }
}
