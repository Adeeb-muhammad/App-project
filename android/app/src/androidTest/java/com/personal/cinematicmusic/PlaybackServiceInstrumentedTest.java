package com.personal.cinematicmusic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;

import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Device-side checks for the real background playback pipeline: the actual
 * {@link PlaybackService}, a real {@link MediaController} bound to it with the
 * same {@link SessionToken} the plugin uses, and real audio decoded until well
 * past the one-second mark that was reported as "audio starts and then dies".
 *
 * These need a device or emulator (`connectedDebugAndroidTest`). Compiling them
 * is not proof that playback works.
 */
@RunWith(AndroidJUnit4.class)
public class PlaybackServiceInstrumentedTest {

    private Context context;
    private MediaController controller;
    private File toneFile;

    @Before
    public void setUp() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        toneFile = TestAudio.writeTone(context, "service-test-tone.wav", 8_000, 6_000);
    }

    @After
    public void tearDown() {
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
        if (toneFile != null) {
            //noinspection ResultOfMethodCallIgnored
            toneFile.delete();
        }
    }

    // ------------------------------------------------------- manifest contract

    @Test
    public void mediaSessionServiceIsExportedWithMediaPlaybackType() throws Exception {
        ServiceInfo info = context.getPackageManager().getServiceInfo(
            new ComponentName(context, PlaybackService.class), 0);
        assertNotNull(info);
        assertTrue(info.exported);
    }

    @Test
    public void mediaSessionServiceActionResolvesToPlaybackService() {
        Intent intent = new Intent("androidx.media3.session.MediaSessionService")
            .setPackage(context.getPackageName());
        List<android.content.pm.ResolveInfo> services =
            context.getPackageManager().queryIntentServices(intent, 0);
        assertFalse("MediaSessionService intent filter is missing", services.isEmpty());
        boolean found = false;
        for (android.content.pm.ResolveInfo resolve : services) {
            if (PlaybackService.class.getName().equals(resolve.serviceInfo.name)) found = true;
        }
        assertTrue("PlaybackService not resolved", found);
    }

    @Test
    public void mediaNotificationIsDeclaredButStorageIsNot() throws Exception {
        PackageInfo info = context.getPackageManager()
            .getPackageInfo(context.getPackageName(), PackageManager.GET_PERMISSIONS);
        List<String> requested = Arrays.asList(
            info.requestedPermissions == null ? new String[0] : info.requestedPermissions);
        // Declared only so Media3's notification can be shown if the user allows it.
        assertTrue(requested.contains("android.permission.POST_NOTIFICATIONS"));
        assertTrue(requested.contains("android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"));
        assertFalse(requested.contains("android.permission.READ_EXTERNAL_STORAGE"));
        assertFalse(requested.contains("android.permission.READ_MEDIA_AUDIO"));
        assertFalse(requested.contains("android.permission.MANAGE_EXTERNAL_STORAGE"));
    }

    // --------------------------------------------------- real service binding

    @Test
    public void mediaControllerConnectsToTheRealService() throws Exception {
        controller = connect();
        assertTrue("the controller must bind to the real PlaybackService", controller.isConnected());
        assertNotNull(controller.getAvailableSessionCommands());
    }

    /**
     * The regression this fix exists for: the reported failure was audio that
     * starts and then stops about a second in. A real service, a real
     * controller and a real file must stay playing well past that point.
     */
    @Test
    public void playbackKeepsAdvancingPastOneSecond() throws Exception {
        controller = connect();

        onMain(() -> {
            controller.setMediaItem(MediaItem.fromUri(Uri.fromFile(toneFile)));
            controller.prepare();
            controller.play();
            return null;
        });

        await("player becomes ready", () -> controller.getPlaybackState() == Player.STATE_READY, 15_000);
        await("player starts playing", controller::isPlaying, 15_000);

        await("position passes 1 s", () -> position() > 1_000, 20_000);
        assertTrue("audio must still be playing one second in", Boolean.TRUE.equals(onMain(() -> controller.isPlaying())));

        await("position passes 3 s", () -> position() > 3_000, 20_000);
        assertTrue("audio must still be playing three seconds in", Boolean.TRUE.equals(onMain(() -> controller.isPlaying())));
        assertEquals("the player must not have reported an error", null, onMain(() -> controller.getPlayerError()));
    }

    /**
     * Regression for the Capacitor thread model: Builder is invoked on a
     * dedicated plugin thread while Player methods stay on the main looper.
     */
    @Test
    public void controllerCreatedFromPluginThreadUsesMainApplicationLooper() throws Exception {
        HandlerThread pluginThread = new HandlerThread("CapacitorPluginsTest");
        pluginThread.start();
        try {
            CountDownLatch buildLatch = new CountDownLatch(1);
            AtomicReference<ListenableFuture<MediaController>> futureRef = new AtomicReference<>();
            AtomicReference<Throwable> buildFailure = new AtomicReference<>();
            Handler pluginHandler = new Handler(pluginThread.getLooper());
            SessionToken token = new SessionToken(
                context, new ComponentName(context, PlaybackService.class));

            pluginHandler.post(() -> {
                try {
                    futureRef.set(new MediaController.Builder(context, token)
                        .setApplicationLooper(Looper.getMainLooper())
                        .buildAsync());
                } catch (Throwable error) {
                    buildFailure.set(error);
                } finally {
                    buildLatch.countDown();
                }
            });

            assertTrue("plugin thread did not finish building the controller",
                buildLatch.await(10, TimeUnit.SECONDS));
            if (buildFailure.get() != null) throw new AssertionError(buildFailure.get());
            controller = awaitController(futureRef.get());

            onMain(() -> {
                controller.setMediaItem(MediaItem.fromUri(Uri.fromFile(toneFile)));
                controller.prepare();
                controller.play();
                return null;
            });
            await("position passes 1 s from plugin-thread-created controller",
                () -> position() > 1_000, 20_000);
            assertTrue("controller remains playing after 1 s",
                Boolean.TRUE.equals(onMain(() -> controller.isPlaying())));
            await("position passes 3 s from plugin-thread-created controller",
                () -> position() > 3_000, 20_000);
            assertTrue("controller remains playing after 3 s",
                Boolean.TRUE.equals(onMain(() -> controller.isPlaying())));
            assertEquals(null, onMain(() -> controller.getPlayerError()));
        } finally {
            pluginThread.quitSafely();
            pluginThread.join(5_000);
        }
    }
    /**
     * The service owns the queue, so destroying the WebView side of the
     * connection must not lose it. This is what lets a reconnected controller
     * (and the restore logic in the plugin) pick playback back up.
     */
    @Test
    public void queueSurvivesAControllerReconnect() throws Exception {
        controller = connect();
        onMain(() -> {
            controller.setMediaItem(MediaItem.fromUri(Uri.fromFile(toneFile)));
            controller.prepare();
            controller.pause();
            return null;
        });
        await("queue is accepted", () -> mediaItemCount() == 1, 10_000);

        MediaController first = controller;
        controller = null;
        onMain(() -> {
            first.release();
            return null;
        });

        controller = connect();
        await("the reconnected controller still sees the queue", () -> mediaItemCount() == 1, 15_000);
        assertTrue(
            "the reconnected controller must be on the first item",
            onMain(() -> controller.getCurrentMediaItemIndex()) == 0
        );
    }

    // ------------------------------------------------------------------ utils

    /** Binds a controller exactly like the Capacitor plugin does. */
    private MediaController connect() throws Exception {
        SessionToken token = new SessionToken(
            context, new ComponentName(context, PlaybackService.class));
        ListenableFuture<MediaController> future =
            new MediaController.Builder(context, token)
                .setApplicationLooper(Looper.getMainLooper())
                .buildAsync();
        return awaitController(future);
    }

    private MediaController awaitController(ListenableFuture<MediaController> future) throws Exception {
        assertNotNull("controller future was not created", future);
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
            ContextCompat.getMainExecutor(context));
        assertTrue("timed out connecting to PlaybackService", latch.await(15, TimeUnit.SECONDS));
        if (failure.get() != null) throw new AssertionError(failure.get());
        assertNotNull(reference.get());
        return reference.get();
    }

    private long position() {
        Long value = onMain(() -> controller.getCurrentPosition());
        return value == null ? 0L : value;
    }

    private int mediaItemCount() {
        Integer value = onMain(() -> controller.getMediaItemCount());
        return value == null ? 0 : value;
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
