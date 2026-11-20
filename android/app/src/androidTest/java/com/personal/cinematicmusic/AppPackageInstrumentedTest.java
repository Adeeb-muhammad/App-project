package com.personal.cinematicmusic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented checks that run on a device/emulator against the installed app.
 * They guard the identity and privacy policy documented in docs/SECURITY.md.
 */
@RunWith(AndroidJUnit4.class)
public class AppPackageInstrumentedTest {

    private Context context() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    @Test
    public void packageNameMatchesApplicationId() {
        assertEquals("com.personal.cinematicmusic", context().getPackageName());
    }

    @Test
    public void cloudBackupIsDisabled() {
        int flags = context().getApplicationInfo().flags;
        assertEquals(0, flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
    }

    @Test
    public void appDoesNotRequestInternetPermission() throws Exception {
        PackageInfo info = context().getPackageManager()
            .getPackageInfo(context().getPackageName(), PackageManager.GET_PERMISSIONS);
        String[] requested = info.requestedPermissions == null ? new String[0] : info.requestedPermissions;
        assertFalse(
            "Offline-first app must not request INTERNET: " + Arrays.toString(requested),
            Arrays.asList(requested).contains("android.permission.INTERNET")
        );
    }

    @Test
    public void versionNameIsPresent() throws Exception {
        PackageInfo info = context().getPackageManager().getPackageInfo(context().getPackageName(), 0);
        assertTrue(info.versionName != null && info.versionName.matches("\\d+\\.\\d+\\.\\d+"));
    }
}
