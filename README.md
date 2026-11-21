# Cinematic Music

An offline-first personal music player for Android with a cinematic, dark interface.
The frontend is plain HTML5, CSS3 and vanilla JavaScript (ES modules) built with Vite,
packaged for Android with Capacitor 8. Audio plays through AndroidX Media3 ExoPlayer in a
`MediaSessionService`, so it continues in the background and responds to notification and
lock-screen controls.

**Current state: Milestone 2A — real local playback (vertical slice).** The five planned
screens plus album and playlist detail exist, and a file picked with Android’s document
picker is imported, remembered and played for real. The browser build explains that native
playback needs the Android app; the opt-in demo mode (`?demo=1`) still uses a clearly
labelled simulation.

Version: `0.1.0`

## Requirements

- Node.js **22.12+** (tested on Node 26.13.0) and npm.
- For Android builds: **JDK 21**, Android Studio **Otter 2025.2.1+** and Android SDK **36**.
  Capacitor 8 targets minSdk 24 / compileSdk 36 / targetSdk 36.
- No global dependencies are required; everything else is local to the project.

## Install and run

```bash
npm install
npm run dev          # Vite dev server, http://localhost:5173
npm run build        # production build into dist/
npm run preview      # serve the production build locally
```

The dev server respects `--host 0.0.0.0 --port <port>` for preview environments. Vite may
need `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<hostname>` when served through a proxy.

## Demo preview mode

The app never invents music in the user's library. The empty states are the default.
To review the interface with fictional sample content, append **`?demo=1`** to the URL:

```
http://localhost:5173/?demo=1#/
```

- Demo mode is **off by default** and is never persisted to storage.
- A fixed "Dev preview" chip appears while it is active.
- The Now Playing screen states clearly that transport is a simulation.
- All albums, artists, titles and SVG artwork are original and fictional.

## Android / Capacitor

The Android project has already been generated in `android/` and synced.

```bash
npm run build                 # build web assets
npx cap sync android          # copy dist + Capacitor config into the Android project
npx cap open android          # open in Android Studio (requires the native toolchain)
npm run android:debug         # build + sync + ./gradlew assembleDebug
```

With JDK 21 and Android SDK 36 installed, `./gradlew testDebugUnitTest assembleDebug
assembleDebugAndroidTest` succeeds and produces `android/app/build/outputs/apk/debug/app-debug.apk`.
The APK has **not** been installed on a physical device or emulator from this environment, so
picker, audio, background playback and notification/lock-screen controls still need a device
pass. See [docs/TESTING.md](docs/TESTING.md) for exactly what was and was not verified.

### Importing and playing a file

1. Open **Library** and press **Import audio**.
2. Pick one audio file with Android’s document picker.
3. The app takes a persistable read grant for that URI only; no storage permission is used.
4. The track appears in Library and can be played, paused, seeked and stopped.
5. Playback is owned by `PlaybackService` (Media3 `MediaSessionService`), so it continues
   when the app is backgrounded and through the notification / lock-screen controls.

### Tests and CI

```bash
npm test         # unit tests (Node built-in runner, no extra dependencies)
npm run verify   # tests + production build
```

Browser checks (Playwright is test-only, not a project dependency):

- `tests/e2e/now-playing.mjs` — the full demo/player regression flow.
- `tests/e2e/native-playback.mjs` — the Android-only import path and the browser’s honest
  “native playback requires the app” fallback.

GitHub Actions runs `npm ci`, `npm test`, `npm run build`, both browser checks, then on Android:
`cap sync`, `testDebugUnitTest`, `assembleDebug`, `assembleDebugAndroidTest`, and an `aapt2`
inspection of the built APK (package, version, permissions, backup flag).

### Versioning, privacy and security

The app version lives in `package.json` only; Android reads it from there (details in
[docs/SECURITY.md](docs/SECURITY.md)). The app requests only media-playback permissions
(foreground service, media playback type, notifications, wake lock), disables cloud backup
and device transfer, and has no network access by design.

### Renaming the app

1. Edit `capacitor.config.ts` (`appName`, `appId`).
2. Run `npx cap sync android`.
3. For the package id, also update `android/app/build.gradle` (`namespace`,
   `applicationId`) and the package declaration in
   `android/app/src/main/java/com/personal/cinematicmusic/MainActivity.java`.
4. For the display name, update `android/app/src/main/res/values/strings.xml`.

## Project structure

```
index.html                 App shell document
package.json               Scripts and pinned dependency ranges
vite.config.js             Vite build config (ES2020 target for Android WebView)
capacitor.config.ts        Capacitor 8 app identity and webDir
src/
  main.js                  Entry point: styles, demo gate, store, shell
  app/shell.js             Persistent frame, routing glue, delegated actions
  pages/                   home, library, playlists, playlist, album, player, settings, not-found
  components/              navigation, mini-player, album-card, song-row, artwork,
                           empty-state, section-header, icon
  state/store.js           Library + UI state
  state/player.js          Playback boundary: native, demo simulation or unavailable
  native/native-audio.js   Capacitor plugin bridge to Kotlin Media3 service
  native/audio-import.js   Storage Access Framework picker wrapper
  data/imported.js         Imported-track validation, localStorage and view model
  data/demo-data.js        Fictional development-only library
  data/library.js          Library view model, empty by default
  utils/                   navigation (hash router), demo-mode, dom, format, safe (data boundary)
  styles/                  global, layout, components, home, library, playlists, player, settings
public/
  artwork/                 Eight original abstract SVG artworks
  fonts/                   Self-hosted OFL fonts (Instrument Serif, Manrope) + licences
tests/                     Unit tests (npm test) and e2e/ browser scripts
.github/workflows/         Active CI (web, browser E2E, Android build + APK inspection)
docs/                      Product spec, architecture, roadmap, tasks, testing, security
android/                   Capacitor Android project, Media3 plugin + PlaybackService in Kotlin
```

## Documentation

- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) — vision, screens, demo-data policy, design system.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map, routing, state, Capacitor and native plans.
- [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md) — phased plan.
- [docs/TASKS.md](docs/TASKS.md) — exact implementation status and remaining work.
- [docs/TESTING.md](docs/TESTING.md) — commands run, actual results and gaps.
- [docs/SECURITY.md](docs/SECURITY.md) — backup, permissions, FileProvider, signing, versioning.

## Design notes

- Palette tokens: `#08090D` background, `#11131A` secondary, `#191B25` elevated surface,
  `#F4F1F8` primary text, `#A3A0AE` secondary text, `#A78BFA` / `#7C6BFF` accents,
  `#282936` dividers.
- Typography: Instrument Serif for display headings and Manrope for UI text, both
  self-hosted (SIL OFL 1.1) so the app has no runtime network dependency.
- All icons are inline SVG in `src/components/icon.js`; no icon library is used.
- Layouts are mobile-first for 360–430px viewports and adapt to a desktop rail layout.

## Known limitations

- Milestone 2A imports one file at a time and stores the list in `localStorage`, not SQLite.
  There is no automatic scanning of device music and no playlist persistence.
- Device testing is still owed: no picker, audio, background, notification or lock-screen run
  has been performed on real hardware. The APK compiles and its manifest was inspected; that
  is not the same as playback being verified.
- The browser has no audio engine by design. It explains this instead of pretending to play,
  except in the clearly labelled `?demo=1` preview.
- Playlist creation/editing is not implemented.
- No app icon or splash screen has been produced yet.
- Keyboard-only and screen-reader walkthroughs and desktop layout were not inspected.
