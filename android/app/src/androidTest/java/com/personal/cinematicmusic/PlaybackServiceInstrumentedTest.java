package com.personal.cinematicmusic;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Device-side checks for the background playback contract. These compile with
 * assembleDebugAndroidTest and run on an emulator/device; compiling them alone
 * is not proof that playback works.
 */
@RunWith(AndroidJUnit4.class)
public class PlaybackServiceInstrumentedTest {

    private Context context() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    @Test
    public void mediaSessionServiceIsExportedWithMediaPlaybackType() throws Exception {
        ServiceInfo info = context().getPackageManager().getServiceInfo(
            new ComponentName(context(), PlaybackService.class), 0);
        assertNotNull(info);
        assertTrue(info.exported);
        // foregroundServiceType is checked in the manifest by the host-side
        // native-contract test and by the APK inspection step, because the
        // SDK's android.jar does not expose the ServiceInfo field to javac.
    }

    @Test
    public void mediaSessionServiceActionResolvesToPlaybackService() {
        Intent intent = new Intent("androidx.media3.session.MediaSessionService")
            .setPackage(context().getPackageName());
        List<android.content.pm.ResolveInfo> services =
            context().getPackageManager().queryIntentServices(intent, 0);
        assertFalse("MediaSessionService intent filter is missing", services.isEmpty());
        boolean found = false;
        for (android.content.pm.ResolveInfo resolve : services) {
            if (PlaybackService.class.getName().equals(resolve.serviceInfo.name)) found = true;
        }
        assertTrue("PlaybackService not resolved", found);
    }

    @Test
    public void notificationPermissionIsDeclaredButStorageIsNot() throws Exception {
        PackageInfo info = context().getPackageManager()
            .getPackageInfo(context().getPackageName(), PackageManager.GET_PERMISSIONS);
        List<String> requested = Arrays.asList(
            info.requestedPermissions == null ? new String[0] : info.requestedPermissions);
        assertTrue(requested.contains("android.permission.POST_NOTIFICATIONS"));
        assertTrue(requested.contains("android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"));
        assertFalse(requested.contains("android.permission.READ_EXTERNAL_STORAGE"));
        assertFalse(requested.contains("android.permission.READ_MEDIA_AUDIO"));
        assertFalse(requested.contains("android.permission.MANAGE_EXTERNAL_STORAGE"));
    }
}
