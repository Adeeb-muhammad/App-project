# Testing — Cinematic Music

This file records what was actually run and observed. Anything not listed here was not
tested.

## Milestone 2A results (branch `feature/milestone-2a-native-playback`)

Environment: Linux cloud workspace, Node **v26.13.0**, npm **11.20.0**, Temurin JDK
**21.0.13.1**, Android SDK **36** + build-tools **36.0.0**, Gradle wrapper **8.14.3**,
Media3 **1.11.1**, Playwright **1.63** with Chromium 1243. The container has no system fonts,
so browser assertions read `textContent` and wait for attached nodes rather than relying on
text-height-driven `innerText`/visibility; this does not change what the checks assert.

| Command | Result |
| --- | --- |
| `npm ci --no-fund --no-audit` | exit **0** |
| `npm test` | **42 tests, 42 pass, 0 fail** |
| `npm run verify` | exit **0**; 42/42 tests + Vite build |
| `node tests/e2e/native-playback.mjs` (production build, 390×844) | **18/18 checks passed** |
| `node tests/e2e/now-playing.mjs` (production build, 390×844) | **39/39 checks passed** |
| `cd android && ./gradlew clean testDebugUnitTest assembleDebug assembleDebugAndroidTest` | exit **0**, 191 tasks |
| Android host unit tests | **3 passed** (`PlaybackPolicyTest` 2, `VersionPolicyTest` 1), 0 failures |
| `adb devices` | no devices/emulators attached |

Build outputs:

- `android/app/build/outputs/apk/debug/app-debug.apk` — 7,756,895 bytes (final build),
  SHA-256 `531b86ffab097dfccda4b87db96ad8f4…`
- `android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk` — 565,651 bytes
  (compiled, never executed)

APK inspection with `aapt2 dump badging` / `dump xmltree`:

- package `com.personal.cinematicmusic`, versionName `0.1.0`, targetSdk 36.
- permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`,
  `WAKE_LOCK` and the app-private AndroidX dynamic-receiver permission. **No INTERNET,
  ACCESS_NETWORK_STATE or storage permission.**
- `PlaybackService` exported, `foregroundServiceType=0x00000002` (mediaPlayback), with the
  `androidx.media3.session.MediaSessionService` intent filter.
- `allowBackup=false`, data-extraction rules present, no FileProvider.

WHAT THE BROWSER RUN COVERED

- Non-demo Library offers **Import audio**, explains that the browser cannot open device files,
  and leaves the library empty (no invented tracks or fake mini-player).
- Clicking Import shows the Android-required notice; no `<audio>` element is ever created.
- Demo mode still renders tracks, opens Now Playing, shows the “simulated” engine note,
  toggles pause/play, and keeps the mini-player in sync.
- The full regression flow (play → pause → next → previous → seek → queue → Escape → close →
  reopen, 15 open/close cycles, malformed routes, no console errors, no external requests)
  still passes.

**Not tested (must not be reported as working):** real file picking, audible playback, seek
with real media, background playback, notification controls, lock-screen controls, audio focus,
headphone unplugging, and URI-grant revocation. The instrumentation APK was only compiled. A
physical device or emulator is required for those checks:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# then import a file, play it, background the app, use the notification and lock screen
cd android && ./gradlew connectedDebugAndroidTest   # with a device attached
```

## Integration session results (branch `claude/final-hardening-integration`)

Environment: same Linux workspace (Node v22.23.5, npm 10.9.9, Playwright 1.63 + Chromium
1243, OpenJDK 21 *runtime* only). Google Maven, Maven Central, plugins.gradle.org,
services.gradle.org and dl.google.com all returned no response (HTTP 000), so Gradle/AGP and
the Android SDK cannot be obtained. **No Android build of any kind was possible.**

| Command | Result |
| --- | --- |
| `rm -rf node_modules && npm ci` | exit 0, 0 vulnerabilities |
| `npm run verify` (= `npm test` + `npm run build`) | 21 tests, 21 pass, 0 fail; Vite build OK |
| `node tests/e2e/now-playing.mjs` against `vite preview` of the production build | 39/39 checks passed |
| `actionlint docs/ci/build.yml` | exit 0 (and confirmed to report errors on a deliberately broken file) |
| `xmllint --noout` on the manifest and `data_extraction_rules.xml` | well-formed |

Negative checks (tests were shown to fail on bad input): `android-policy.test.js` fails
when a `device_sharedpref` exclusion is removed; the emoji-initial test fails against the
previous `artwork.js`.

Not run: any Gradle task, APK build, merged-manifest/APK inspection, lint, instrumentation
tests (never compiled or executed), device or emulator checks, and **GitHub Actions - the
workflow is inactive and has never executed**, so there is no CI result.

## Hardening session results (branch `claude/milestone-1-hardening`)

Environment: Linux cloud workspace, Node v22.23.5, npm 10.9.9, Chromium 1243 via Playwright 1.63.
JDK / Android SDK: **not available**; the Gradle distribution cannot be downloaded from here.

| Command | Result |
| --- | --- |
| `npm ci` | exit 0, 0 vulnerabilities |
| `npm test` | 16 tests, 16 pass, 0 fail (at that time) |
| `npm run build` | exit 0, Vite build succeeds (JS about 52 kB, CSS about 31 kB) |
| `node tests/e2e/now-playing.mjs` (against `vite preview` of the production build, 390x844) | **39/39 checks passed** |

The store listener test was also run against the *original* `store.js` and failed
("listener added during dispatch..."), confirming it detects the vulnerability.

What the browser run covered (the 13-step sequence from the task): demo mode, album,
play, pause, resume, next, previous, seek to 50 percent, open queue, select another queued
track, close queue, close Now Playing, return via the mini-player. It asserted the displayed
title, play/pause labels on both Now Playing and the mini-player, elapsed time and mini
progress after seeking, queue highlighting, responsiveness after each phase, exactly one
re-render per next / queue-select, one active simulated-clock interval after 15 open/close
cycles (no accumulated subscriptions), Escape to close, four malformed/unknown routes
(`#/albums/%E0%A4%A`, `#/playlists/%`, `#/nope`, unknown album id), browser back twice, the
empty Now Playing state without demo mode, zero uncaught/console errors and zero non-local
network requests.

Limits of that run: artwork "updates" were checked only as the `src` being present (the
first tracks share one album's artwork); listener counts were inferred from render and
interval counts, not by inspecting module internals; Chromium only, no real Android WebView.

**Not run / not verified:**

- `./gradlew` anything (`assembleDebug`, `testDebugUnitTest`, `assembleDebugAndroidTest`).
  The new Java tests and the Gradle version wiring have **not been compiled by us**.
- `connectedDebugAndroidTest` on an emulator/device was never executed.
- CI: the workflow is written (`docs/ci/build.yml`) but **inactive and never run** (push token
  has no workflow permission). There is no CI result.
- The merged-manifest check for INTERNET/backup exists only in that inactive workflow.

## Milestone 1 session (historical)

## Environment

| Item | Value |
| --- | --- |
| Date | 19 November 2026 |
| Node.js | v26.13.0 |
| npm | 11.20.0 |
| Java / JDK | not installed (`java: command not found`, `JAVA_HOME` unset) |
| Android SDK | not installed (`ANDROID_HOME` / `ANDROID_SDK_ROOT` unset) |
| OS | Linux cloud workspace |

Because there is no JDK or Android SDK, no APK or Gradle build could be produced.

## Dependency install

```bash
npm install --no-fund --no-audit
```

- Exit status: **0**
- Output: `added 114 packages`
- Resolved versions (`npm ls --depth=0`):
  - `@capacitor/android@8.6.2`
  - `@capacitor/cli@8.6.2`
  - `@capacitor/core@8.6.2`
  - `typescript@5.9.3`
  - `vite@8.3.8`

## Production build

```bash
npm run build
```

- Exit status: **0**
- Vite: 8.3.8, 39 modules transformed
- Output (final build after all fixes):

```
dist/index.html                  1.10 kB │ gzip:  0.59 kB
dist/assets/index-BvtPEShj.css  31.10 kB │ gzip:  6.84 kB
dist/assets/index-BE9h1FgQ.js   51.90 kB │ gzip: 15.76 kB
✓ built in 247ms
```

Earlier builds passed both before and after the Now Playing fix. No build warnings or
errors were recorded.

## Capacitor / Android

```bash
npx cap add android
npx cap sync android
```

- `cap add`: exit **0**; created `android/`.
- `cap sync`: exit **0**; copied `dist` to `android/app/src/main/assets/public` and wrote
  `capacitor.config.json`.
- Verified generated values:
  - `android/variables.gradle`: `minSdkVersion = 24`, `compileSdkVersion = 36`,
    `targetSdkVersion = 36`.
  - `android/app/build.gradle`: `namespace = "com.personal.cinematicmusic"`,
    `applicationId "com.personal.cinematicmusic"`.
  - Synced assets present: `index.html`, `assets/`, `artwork/`, `fonts/`, `favicon.svg`.
- **Not run:** `./gradlew assembleDebug`, because Java and the Android SDK are absent.
  No APK exists. Command to run on a prepared machine:

```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug
```

## Browser checks (cloud browser, pre-fix)

The app was served with Vite (`vite --host 0.0.0.0 --port 3000`) and loaded through the
cloud preview hostname. Checks that completed:

| Check | Result |
| --- | --- |
| Default launch without `?demo=1` | Pass — home rendered with the empty state; no dev chip; no mini-player; no album cards. |
| Demo mode `?demo=1#/` | Pass — dev chip visible; 14 album cards across 3 rails; 3 playlist shortcuts; featured album "Aurora Drift". |
| Album detail | Pass — opened from a home card; 4 track rows; header and navigation correct. |
| Bottom navigation / active state | Pass — Home active on home; Library became active after navigation. |
| No console errors during initial load | Pass — console empty; all module, font and artwork requests returned 200. |
| Artwork and fonts | Pass — all eight SVGs and both woff2 fonts requested successfully. |

## Failure found during browser testing

Opening **Now Playing** froze the renderer (screenshots and accessibility snapshots timed
out; the tab stayed on the album document while the URL changed to `#/now-playing`).

Cause: the player page called `refresh()` from inside the player event listener; each
re-render subscribed a new listener while `Set` iteration continued, so the new listener
received the same `track` event and re-rendered again — an infinite loop.

Fix applied:

1. `state/player.js` now dispatches events over a snapshot of listeners.
2. Track-change re-rendering moved to `app/shell.js`, which re-renders the player route only
   when it is active; the player page only handles progress and play/pause state.

The production build passed after the fix. The flow was re-tested in the hardening session
(see the top of this file).

## Not tested

- Real audio playback — Milestone 2A adds it, but only compilation/APK inspection ran here;
  no device playback was performed.
- Android runtime, WebView, back button, safe areas, status bar.
- Install or launch of an APK.
- Desktop layout at ≥960px (CSS implemented, not visually reviewed).
- Keyboard-only navigation, focus order and screen-reader output.
- Search interactions beyond the earlier manual checks (pre-fix checks passed for filtering
  and the no-match state in an earlier partial run, but the final consolidated pass did not
  complete).
- Performance on low-end hardware.
- Offline behaviour inside the Capacitor shell.

## Suggested verification commands for the next session

```bash
npm install
npm run build
npm run dev -- --host 0.0.0.0 --port 3000
```

Then walk: default empty home → Library tabs and search → Playlists empty state → demo home
(`?demo=1`) → album → play → pause → next → queue → Escape → close player → Settings.
Capture console output and confirm `#/now-playing` renders the new track title and artwork.

With JDK 21 and SDK 36 available:

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Android playback reliability fix (`fix/android-playback-reliability`)

Branch base: `main` after PR #4. This revision drops the notification-permission prompt that the
first pass added and treats the one-second playback stop as the real bug.

What changed, and why:

- **No runtime notification prompt and no warning about it.** Media3 posts the media
  notification itself, and a denied `POST_NOTIFICATIONS` only hides that notification. It does
  not stop playback. The Capacitor permission alias, `requestNotificationPermission`, the
  `playbackWarning` event and the JavaScript caller are gone. The permission stays *declared* in
  the manifest so the system can show the notification once the user allows it in settings.
- **The queue belongs to the service, and the plugin puts it back.** Android may destroy and
  recreate `PlaybackService`; the recreated player is empty, so every transport button became a
  silent no-op and the UI still looked like it was playing. The plugin now remembers the queue,
  the current index and the position, and re-applies them as soon as a fresh `MediaController`
  connects.
- **One source of truth for "should the service stay alive".** `onTaskRemoved` no longer
  re-implements Media3's keep-or-stop decision and calls `stopSelf()` on its own narrower
  verdict; the decision is delegated to `MediaSessionService` and the service is declared
  `android:stopWithTask="false"`.
- **Stops that raise no error are now visible in logcat.** `CinematicPlayback` logs
  `playWhenReady` together with its change reason, including `AUDIO_FOCUS_LOSS` and
  `AUDIO_BECOMING_NOISY` — the two ways ExoPlayer stops audio without ever producing a
  `PlaybackException`, which is exactly what a "the music just stopped" report looks like.

Verified in this environment (JDK 21, Android SDK 36, Node 26):

```bash
npm test
npm run build
npx cap sync android
cd android && ./gradlew testDebugUnitTest assembleDebug assembleDebugAndroidTest
```

- `npm test`: JavaScript and source-contract suites pass, including the new contracts that the
  permission prompt is gone, that task removal is delegated to Media3, and that a reconnected
  service gets its queue back.
- `testDebugUnitTest`, `assembleDebug` and `assembleDebugAndroidTest`: pass locally.
- The device tests below are **compiled, not executed** here: this environment has no emulator
  (no KVM access) and no attached phone.

### Device tests added

Run these on the phone with `cd android && ./gradlew connectedDebugAndroidTest`, or selectively:

```bash
adb shell am instrument -w -e class com.personal.cinematicmusic.PlaybackServiceInstrumentedTest \
  com.personal.cinematicmusic.test/androidx.test.runner.AndroidJUnitRunner
adb shell am instrument -w -e class com.personal.cinematicmusic.SafContentUriInstrumentedTest \
  com.personal.cinematicmusic.test/androidx.test.runner.AndroidJUnitRunner
adb shell am instrument -w -e class com.personal.cinematicmusic.PlaybackPipelineInstrumentedTest \
  com.personal.cinematicmusic.test/androidx.test.runner.AndroidJUnitRunner
```

- `PlaybackServiceInstrumentedTest` binds a real `MediaController` to the real `PlaybackService`
  with the same `SessionToken` the plugin uses. `playbackKeepsAdvancingPastOneSecond` is the
  regression test for the reported failure: a generated six-second tone must keep advancing and
  stay playing past one and three seconds with no `PlaybackException`.
  `queueSurvivesAControllerReconnect` releases the controller, reconnects, and asserts the
  service still holds the queue.
- `SafContentUriInstrumentedTest` plays a real `content://` URI served by a test-only
  `ContentProvider` (crossing an app boundary like a SAF grant does), once through a bare
  `ExoPlayer` and once through the production controller → service path, both past one second.
- `PlaybackPipelineInstrumentedTest` covers prepare/play/pause/resume/end, the MediaSession
  mirror and the missing-file error.

### Capturing the one-second stop on the phone

```bash
adb logcat -c
adb logcat -v time > cinematic-music-full.txt      # full buffers
adb logcat -s CinematicPlayback CinematicAudio     # filtered, second shell
```

The line to look for is `playWhenReady=false reason=…` in `CinematicPlayback`:

- `AUDIO_FOCUS_LOSS` — another app or the system took audio focus.
- `AUDIO_BECOMING_NOISY` — the audio route was lost (unplugged headset, route switch).
- `isPlaying=false state=…` with no `playback error` from `CinematicAudio` — the player paused
  rather than failed, so the cause is above the decoder and not in the file.

Scenarios: play a local file for 30 s, press Home, switch apps, lock the screen, open the
notification shade, return to the app, then dismiss the task.
