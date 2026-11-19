# Testing — Cinematic Music

This file records what was actually run and observed. Anything not listed here was not
tested.

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

The production build passed after the fix. **The corrected Now Playing flow was not
re-tested in the browser before the session ended** — the cloud tab was still unresponsive
and the workspace moved runners. This is the highest-priority follow-up.

## Not tested

- Real audio playback — none exists; the transport is a simulation.
- Android runtime, WebView, back button, safe areas, status bar.
- Install or launch of an APK.
- Desktop layout at ≥960px (CSS implemented, not visually reviewed).
- Keyboard-only navigation, focus order and screen-reader output.
- Queue open/select/close after the fix.
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
