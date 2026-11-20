# Cinematic Music

An offline-first personal music player for Android with a cinematic, dark interface.
The frontend is plain HTML5, CSS3 and vanilla JavaScript (ES modules) built with Vite,
packaged for Android with Capacitor 8. Native playback will use AndroidX Media3 in a
later milestone.

**Current state: Milestone 1 — frontend foundation.** All five planned screens plus album
and playlist detail exist, the interface is polished and responsive, a deliberate
development-only demo library can be enabled, and a Capacitor Android project has been
generated. No audio playback, music import or persistence exists yet — deliberately.

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
- The Now Playing screen states clearly that transport is a UI simulation.
- All albums, artists, titles and SVG artwork are original and fictional.

## Android / Capacitor

The Android project has already been generated in `android/` and synced.

```bash
npm run build                 # build web assets
npx cap sync android          # copy dist + Capacitor config into the Android project
npx cap open android          # open in Android Studio (requires the native toolchain)
npm run android:debug         # build + sync + ./gradlew assembleDebug
```

Environment note: the machines used so far had **no JDK and no Android SDK**, so no APK has
been built locally. A `Build` GitHub Actions workflow (web build + Android debug build) is written
but **not yet active**: it sits at `docs/ci/build.yml` because the token used to push has no
permission to create files under `.github/workflows/`. Move it there (instructions in the
file's header) to enable CI; until it has run, no Android build has been verified by anyone. See [docs/TESTING.md](docs/TESTING.md) for exactly what was and was not verified.

### Tests and CI

```bash
npm test         # unit tests (Node built-in runner, no extra dependencies)
npm run verify   # tests + production build
```

Browser flow check for Now Playing: `tests/e2e/now-playing.mjs` (needs Playwright, see the
header of that file). Once enabled, CI runs `npm ci`, `npm test`, `npm run build`, the browser E2E, then on Android:
`cap sync`, `testDebugUnitTest`, `assembleDebug`, `assembleDebugAndroidTest`, and an `aapt2`
inspection of the built APK (package, version, permissions, backup flag).

### Versioning, privacy and security

The app version lives in `package.json` only; Android reads it from there (details in
[docs/SECURITY.md](docs/SECURITY.md)). The app requests no permissions, disables cloud
backup and device transfer, and has no network access by design.

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
  state/player.js          Simulated transport state (no audio)
  data/demo-data.js        Fictional development-only library
  data/library.js          Library view model, empty by default
  utils/                   navigation (hash router), demo-mode, dom, format, safe (data boundary)
  styles/                  global, layout, components, home, library, playlists, player, settings
public/
  artwork/                 Eight original abstract SVG artworks
  fonts/                   Self-hosted OFL fonts (Instrument Serif, Manrope) + licences
tests/                     Unit tests (npm test) and e2e/ browser script
docs/ci/build.yml          CI workflow (inactive until moved to .github/workflows/)
docs/                      Product spec, architecture, roadmap, tasks, testing, security
android/                   Generated Capacitor Android project
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

- No audio playback. The transport is a visual simulation only; Media3 is not connected.
- No music import, database or persistence. The library is empty unless `?demo=1` is used.
- Playlist creation/editing is not implemented.
- No app icon or splash screen has been produced yet.
- No APK has been built or run locally; Android compilation is not verified anywhere yet (CI is written but inactive). The instrumentation test has never been executed on a device or emulator.
- Keyboard-only and screen-reader walkthroughs and desktop layout were not inspected.
