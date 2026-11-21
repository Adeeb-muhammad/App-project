# Architecture — Cinematic Music

## 1. Overview

```
Vite (build/dev) ──► dist/ ──► Capacitor WebView (Android)
                     │
                     └─ index.html + ES modules + CSS + SVG + fonts
```

- **Frontend:** HTML5, CSS3, vanilla JavaScript ES modules. No framework, no TypeScript
  in application code, no CSS framework, no icon library.
- **Build:** Vite 8 (`vite.config.js`), ES2020 output target for older Android WebViews,
  `__APP_VERSION__` injected from `package.json`.
- **Packaging:** Capacitor 8 (`capacitor.config.ts`), web assets copied from `dist/`.
- **Native:** a Kotlin Capacitor plugin controls AndroidX Media3 ExoPlayer inside a
  `MediaSessionService`; the WebView is only the UI.

## 2. Module map

| Path | Responsibility |
| --- | --- |
| `src/main.js` | Entry point. Imports styles, evaluates demo mode, initialises the store, mounts the shell. |
| `src/app/shell.js` | Persistent frame (header, main outlet, mini-player slot, navigation), route rendering, delegated click actions, player subscriptions. |
| `src/pages/*.js` | One module per screen. Each exports `{ title, render(state, route), mount?(root, ctx) }`. |
| `src/components/*.js` | Pure template functions: navigation, mini-player, album card, song row, artwork, empty state, section header, icon. |
| `src/state/store.js` | Observable app state: `demo`, immutable library snapshot, UI state (library tab, search). |
| `src/state/player.js` | Playback boundary. Projects native Media3 state, runs the demo simulation, or reports that a browser cannot play local audio. |
| `src/native/native-audio.js` | Registers the `CinematicAudio` Capacitor plugin and adapts its listener API. |
| `src/native/audio-import.js` | Opens the Storage Access Framework picker and validates its result. |
| `src/data/imported.js` | Validates `content://` tracks, persists them in `localStorage`, and builds the library view model. |\n| `src/data/personal-library.js` | Stores local playlists, Liked Songs, 1–5 star ratings and recent-play metadata under `cinematic.personal.v1`. |
| `src/data/library.js` | Builds the view model (`albums`, `songs`, `artists`, `playlists`, rails) and selectors/filters. Empty by default. |
| `src/data/demo-data.js` | Fictional development-only catalogue with artwork paths and palettes. |
| `src/utils/navigation.js` | Hash router: `parseRoute`, `navigate`, `goBack`, `subscribe`, `href`. |
| `src/utils/demo-mode.js` | `?demo=1` detection and preview href. |
| `src/utils/dom.js` | `escapeHtml`, query helpers, event delegation. |
| `src/utils/format.js` | Duration and pluralisation formatting. |
| `src/styles/*.css` | Tokens/base, layout, shared components, and per-screen styles. |

## 3. Rendering model

Pages are plain functions returning HTML strings. The shell swaps the contents of
`<main id="app-main">` on route changes and attaches page-specific listeners in `mount`.
All dynamic text passes through `escapeHtml`.

Interaction is handled by **event delegation**: one click listener on the app root reads
`data-action` and `data-id` attributes. This keeps markup simple, works after re-renders and
guarantees every action is reachable from a real `<button>`/`<a>` for keyboard users.

Page contract:

```js
export const page = {
  title: 'Library',
  render(state, route) { /* returns HTML string */ },
  mount(root, { state, route }) { /* optional; returns cleanup function */ },
};
```

`mount` cleanup is invoked before the next route renders, so subscriptions and listeners
never leak between screens.

## 4. Routing

Hash routing is deliberate: Capacitor WebViews and static preview servers need no rewrite
rules, and Android back/browser back work without extra handling.

| Route | Screen |
| --- | --- |
| `#/` | Home |
| `#/library/songs` `#/library/albums` `#/library/artists` | Library tabs |
| `#/albums/:id` | Album detail |
| `#/playlists` | Playlists |
| `#/playlists/:id` | Playlist detail |
| `#/now-playing` | Full-screen player |
| `#/settings` | Settings |
| anything else | Not found |

Query parameters are independent of the hash, so `?demo=1#/library/albums` keeps demo mode
while navigating.

## 5. State

### `store.js`

Holds `{ demo, library, ui }`. The imported library view model merges audio metadata with the separate on-device personal-library record. `subscribe` drives a re-render of the active route.
`setUi(patch, { notify: false })` is used by the library search so typing filters the result
container locally instead of rebuilding the screen and losing focus.

### `player.js` — the playback boundary

The transport state is a deliberately small API:

```
playTrack(tracks, trackId) · toggle() · next() · previous()
seekRatio(ratio) · getPlayerState() · subscribe(listener)
```

The API is unchanged from Milestone 1, but it now has three engines:

| Mode | Used by | Behaviour |
| --- | --- | --- |
| `native` | Android app, non-demo | Sends the queue to Media3 and mirrors `MediaController` events. The service is authoritative. |
| `simulation` | `?demo=1` preview and Node tests | Advances a clock. No audio is decoded; the UI says so. |
| `unavailable` | A browser without Capacitor | Selecting a track is allowed, but play explains that the Android app is required. |

`main.js` chooses the mode once before mounting the shell. A native track change emitted by
the service is re-rendered by the shell, preserving the listener-snapshot rule below.

### Native playback (Milestone 2A)

```
WebView (player.js)
   │  setQueue / play / pause / seekTo / next / previous / stop
   ▼
CinematicAudioPlugin.kt  ──MediaController──►  PlaybackService (MediaSessionService)
   ▲                                              │
   └──── playbackState events (500 ms) ◄──────────┘  ExoPlayer · audio focus · notification
```

- **Plugin** (`CinematicAudioPlugin.kt`, name `CinematicAudio`): one method per transport
  action plus `pickAudio()` and `getState()`. It builds `MediaItem`s from the JS queue and
  rejects anything that is not a `content://` URI.
- **Service** (`PlaybackService.kt`): owns the single `ExoPlayer`, sets music audio attributes,
  handles audio-becoming-noisy and a local wake mode, and exposes a `MediaSession` whose
  activity reopens `MainActivity`. `MediaSessionService` publishes the media notification and
  routes lock-screen/Bluetooth controls to the same player.
- **State** is projected, not simulated: `playbackState` carries `trackId`, `index`,
  `isPlaying`, `positionMs`, `durationMs`, `buffering` and `ended`. The UI only reflects it.
- **Foreground service:** the manifest declares `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS` and `WAKE_LOCK`. The service is
  exported with the `androidx.media3.session.MediaSessionService` action so system media
  controls can bind to it. `POST_NOTIFICATIONS` is requested at the first playback on API 33+.
- **Background behaviour:** the WebView may be paused by Android; the service keeps playing.
  On `visibilitychange` the page calls `syncFromNative()` to re-read authoritative state.
- **File access:** `ACTION_OPEN_DOCUMENT` with `audio/*` and
  `FLAG_GRANT_PERSISTABLE_URI_PERMISSION`; the plugin calls
  `takePersistableUriPermission(uri, FLAG_GRANT_READ_URI_PERMISSION)` before returning metadata.
  No storage permission and no whole-library scan exist.
- **Persistence:** `localStorage` key `cinematic.imported.v1` stores only normalised metadata
  keyed by URI; the actual access right is the Android URI grant. SQLite is intentionally not
  part of this milestone.

### Event-flow rule (important)

`player.emit` iterates over a **snapshot** of listeners. A listener may cause a re-render,
which subscribes a new listener; iterating the live `Set` would dispatch the same event to
the new listener and create an infinite render loop. Track-change re-rendering is owned by
the shell (only when the player route is active), not by the player page. Keep this
invariant when adding listeners.

## 6. Data

`getLibrary({ demo })` returns the complete view model. With demo off it returns empty
arrays and `hasContent: false`, which is the production default. Demo data is never merged
into the real library and is never persisted.

`demo-data.js` supplies each album's three-colour `palette`. The player currently consumes
that palette directly; artwork-based extraction is a later enhancement, and the CSS custom
properties (`--art-1..3`) already provide the seam.

## 7. Styling

- Tokens and reset live in `global.css`; the layout shell in `layout.css`; reusable UI in
  `components.css`; screen-specific rules in `home.css`, `library.css`, `playlists.css`,
  `player.css`, `settings.css`.
- Mobile-first. Bottom navigation and mini-player become a left rail and floating player at
  `≥960px`; grids expand at `720px` and `1100px`.
- Safe-area insets (`env(safe-area-inset-*)`) are respected because Capacitor 8 is
  edge-to-edge by default; the viewport uses `viewport-fit=cover`.
- Focus rings are visible, hit targets are ≥40px, and motion respects
  `prefers-reduced-motion`.
- Artwork is displayed through `<img>` with a deterministic gradient fallback for records
  without art.

## 8. Capacitor integration

`capacitor.config.ts`:

```ts
appId: 'com.personal.cinematicmusic'
appName: 'Cinematic Music'
webDir: 'dist'
backgroundColor: '#08090D'
server.androidScheme: 'https'
```

`capacitor.config.ts` requires a local `typescript` devDependency because the Capacitor CLI
loads TS config files through the project's TypeScript installation
(`Could not find installation of TypeScript` otherwise). TypeScript is used only for that
config file; no application code is TypeScript.

Generated Android project facts (verified):

- `android/variables.gradle`: minSdk 24, compileSdk 36, targetSdk 36, AGP 8.13.0 family.
- `android/app/build.gradle`: `namespace` and `applicationId` = `com.personal.cinematicmusic`.
- `android/app/src/main/assets/public/` contains the built web app after `npx cap sync`.
- `android/app/src/main/java/com/personal/cinematicmusic/` contains `MainActivity`,
  `CinematicAudioPlugin`, `PlaybackService`, `AudioMetadataReader` and `PlaybackPolicy`.
- Media3 is pinned once in `android/variables.gradle` (`media3Version = '1.11.1'`).

Not yet done: device/emulator playback verification, app icon, splash screen, signing
configuration, release build.

## 9. Dependency policy

| Package | Range | Why |
| --- | --- | --- |
| `vite` | `^8.3.8` | build tooling |
| `@capacitor/core` | `^8.6.0` | required runtime (installed 8.6.2) |
| `@capacitor/android` | `^8.6.0` | Android platform (installed 8.6.2) |
| `@capacitor/cli` | `^8.6.0` | sync/add/open (installed 8.6.2) |
| `typescript` | `^5.9.0` | Capacitor TS config loader only |
| `androidx.media3:media3-exoplayer` | `1.11.1` | native audio engine |
| `androidx.media3:media3-session` | `1.11.1` | `MediaSessionService`, notification and lock-screen controls |
| Kotlin Gradle plugin | `2.2.20` | compiles the native plugin and service |

No runtime UI, state, routing or icon dependencies were added. Capacitor requires Node 22+;
Vite requires Node 20.19+/22.12+.

## 10. Foreseeable risks

- Media3 adds `ACCESS_NETWORK_STATE` through its datasource manifest; the app removes it
  explicitly and remains offline. Keep the merged-manifest inspection in CI.
- Persistable URI grants can be revoked by the user or lost if the provider is uninstalled;
  playback must fail gracefully and the library should eventually prune dead entries.
- The service can outlive the WebView. A cold WebView restart has no JS queue to map media
  ids onto, so the current session is not restored into the UI yet.
- Large libraries need virtualised lists; the current DOM lists are fine for prototype scale
  only.
- Artwork SVG filters are inexpensive at current sizes but should be profiled on low-end
  devices.
