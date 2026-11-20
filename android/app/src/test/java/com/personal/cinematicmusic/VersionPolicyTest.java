package com.personal.cinematicmusic;

import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Host-side sanity test: BuildConfig version must be semantic (MAJOR.MINOR.PATCH). */
public class VersionPolicyTest {

    @Test
    public void versionNameIsSemantic() {
        assertTrue(BuildConfig.VERSION_NAME.matches("\\d+\\.\\d+\\.\\d+"));
    }
}
