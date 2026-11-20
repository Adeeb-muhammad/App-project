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
- **Native:** the Android project is generated; Kotlin playback code is intentionally not
  part of this milestone.

## 2. Module map

| Path | Responsibility |
| --- | --- |
| `src/main.js` | Entry point. Imports styles, evaluates demo mode, initialises the store, mounts the shell. |
| `src/app/shell.js` | Persistent frame (header, main outlet, mini-player slot, navigation), route rendering, delegated click actions, player subscriptions. |
| `src/pages/*.js` | One module per screen. Each exports `{ title, render(state, route), mount?(root, ctx) }`. |
| `src/components/*.js` | Pure template functions: navigation, mini-player, album card, song row, artwork, empty state, section header, icon. |
| `src/state/store.js` | Observable app state: `demo`, immutable library snapshot, UI state (library tab, search). |
| `src/state/player.js` | Simulated transport state and timer. Explicitly **not** an audio engine. |
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

Holds `{ demo, library, ui }`. `subscribe` drives a re-render of the active route.
`setUi(patch, { notify: false })` is used by the library search so typing filters the result
container locally instead of rebuilding the screen and losing focus.

### `player.js` — the playback boundary

The transport state is a deliberately small API:

```
playTrack(tracks, trackId) · toggle() · next() · previous()
seekRatio(ratio) · getPlayerState() · subscribe(listener)
```

A timer advances a simulated position while "playing". **No `<audio>` element exists and no
audio is decoded.** Every screen talks only to this API.

The future native implementation should keep the same surface:

1. Kotlin Capacitor plugin wrapping AndroidX Media3 `ExoPlayer`.
2. A `MediaSessionService` owning playback, audio focus and notifications.
3. A JS adapter that forwards these calls over the Capacitor bridge and emits state events.
4. Screens remain unchanged; only `state/player.js` is replaced.

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

Not yet done: app icon, splash screen, signing configuration, release build, device testing.

## 9. Dependency policy

| Package | Range | Why |
| --- | --- | --- |
| `vite` | `^8.3.8` | build tooling |
| `@capacitor/core` | `^8.6.0` | required runtime (installed 8.6.2) |
| `@capacitor/android` | `^8.6.0` | Android platform (installed 8.6.2) |
| `@capacitor/cli` | `^8.6.0` | sync/add/open (installed 8.6.2) |
| `typescript` | `^5.9.0` | Capacitor TS config loader only |

No runtime UI, state, routing or icon dependencies were added. Capacitor requires Node 22+;
Vite requires Node 20.19+/22.12+.

## 10. Foreseeable risks

- Native playback may require a foreground service and `POST_NOTIFICATIONS` /
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permissions; plan the MediaSessionService early.
- Scoped storage: importing local audio should use the Storage Access Framework and
  persistable URI permissions, not raw filesystem paths.
- Large libraries need virtualised lists; the current DOM lists are fine for prototype scale
  only.
- Artwork SVG filters are inexpensive at current sizes but should be profiled on low-end
  devices.
