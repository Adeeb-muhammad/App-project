# Tasks — Cinematic Music

Last updated at the end of the Milestone 1 session (project version 0.1.0).

## Completed

### Repository and scaffold

- [x] Inspected the repository: only a placeholder `README.md` existed; no `AGENTS.md`,
      no existing code, no unrelated files to preserve.
- [x] Initialised the Vite project manually (no starter template matched the required
      vanilla JS + Capacitor stack).
- [x] `package.json` with scripts: `dev`, `build`, `preview`, `cap:sync`, `cap:open`,
      `android:debug`; Node engine constraint `>=22.12`.
- [x] Installed dependencies: Vite 8.3.8, Capacitor core/android/cli 8.6.2, TypeScript 5.9.3
      (config loader only). Lockfile committed.
- [x] `.gitignore` for dependencies, build output, local env files, Android build output and
      QA artefacts.
- [x] `index.html`, `vite.config.js` (ES2020 target, `__APP_VERSION__`), `capacitor.config.ts`.

### Design system and assets

- [x] Design tokens for the agreed palette, spacing, radii, shadows and motion.
- [x] Self-hosted Instrument Serif + Manrope woff2 files and OFL licence files.
- [x] Eight original abstract SVG artworks in `public/artwork/`.
- [x] Inline SVG icon set with consistent stroke weight.
- [x] Mobile-first layout with bottom navigation; desktop rail layout at ≥960px.
- [x] Safe-area insets, focus-visible rings, reduced-motion support.

### Application

- [x] Hash router with routes for home, library tabs, album, playlists, playlist, player,
      settings and not-found.
- [x] Observable store for the library view model and UI state.
- [x] Simulated transport module with play/pause/next/previous/seek/queue.
- [x] Shell with persistent header, mini-player slot, navigation and delegated actions.
- [x] Home: greeting, featured hero, recently played / recently added / favourites rails,
      playlist shortcuts, empty state.
- [x] Library: songs, albums, artists tabs, search with live result count, per-tab empty
      states, no-match state.
- [x] Album detail: hero, metadata, play action, numbered track list.
- [x] Playlists: cards and empty state; playlist detail with hero and track list.
- [x] Now Playing: full-screen overlay, palette gradient, artwork, scrubber, transport,
      queue dialog, simulation note, empty state.
- [x] Settings: library/playback placeholders, about values, development-only demo toggle,
      demo banner.
- [x] Demo mode gated behind `?demo=1`, never persisted, labelled in the UI.
- [x] Fictional demo catalogue with palettes and artwork paths.

### Capacitor / Android

- [x] Capacitor config with temporary name `Cinematic Music` and id
      `com.personal.cinematicmusic`, `webDir: 'dist'`.
- [x] Generated the Android platform with `npx cap add android`.
- [x] Synced web assets with `npx cap sync android`; verified generated
      `variables.gradle` (minSdk 24 / compileSdk 36 / targetSdk 36) and the package id.

### Documentation

- [x] `README.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `DEVELOPMENT_ROADMAP.md`,
      `TASKS.md`, `TESTING.md`.

## Fixed during this session

- [x] **Infinite render loop when opening Now Playing.** The per-track refresh was triggered
      from the player page's own event listener; each refresh subscribed a new listener that
      the same `Set` iteration then invoked, freezing the renderer. Fixed by iterating a
      listener snapshot in `state/player.js` and moving track-change re-rendering into the
      shell (only when the player route is active). Production build re-run successfully
      after the fix.

## Not verified / incomplete

- [ ] **Re-verify Now Playing in a browser after the loop fix.** The cloud browser tab became
      unresponsive during the pre-fix test and the session moved runners before the post-fix
      walkthrough could run. The fix is implemented and builds, but the full interaction flow
      has not been replayed.
- [ ] Android APK build and device run. This machine has no JDK and no Android SDK, so
      `./gradlew assembleDebug` could not be attempted.
- [ ] Desktop responsive layout not inspected visually (CSS is implemented; mobile layouts
      were reviewed).
- [ ] Keyboard-only walkthrough and screen-reader spot check not performed.
- [ ] Queue interactions (open, select, close with Escape) not re-tested after the fix.

## Remaining work (next sessions)

### Immediate

- [ ] Run the post-fix browser pass: album → play → pause → next → queue → close, with
      console error capture; record results in `TESTING.md`.
- [ ] Build and install a debug APK on a machine with JDK 21 + SDK 36; verify safe areas.
- [ ] Add adaptive app icon and splash screen.
- [ ] Confirm `npx cap sync` output after any asset changes.

### Phase 2 candidates

- [ ] Storage Access Framework import flow.
- [ ] Metadata and embedded-artwork parsing.
- [ ] SQLite schema, queries and migrations.
- [ ] Replace the demo selector with database-backed queries.

### Phase 3 candidates

- [ ] Kotlin Media3 plugin and `MediaSessionService`.
- [ ] Playback adapter compatible with the existing player API.
- [ ] Notification, audio focus, headset and lock-screen controls.

### Phase 4+

- [ ] Playlist editing, favourites persistence, queue reordering.
- [ ] Artwork palette extraction and shared-element transitions.
- [ ] Virtualised lists for large libraries.
- [ ] Release signing (keystore never committed).

## Notes for the next engineer

- The player event-flow invariant is documented in `ARCHITECTURE.md` §5; do not re-render
  the player route from inside a player event listener.
- Demo data must remain isolated and opt-in; never merge it into the real library.
- The demo preview link in Settings is rendered only in dev builds (`import.meta.env.DEV`).
- Capacitor's TS config requires the `typescript` devDependency; application code stays
  vanilla JS.
