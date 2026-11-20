# Product Specification — Cinematic Music

## 1. Vision

A premium, cinematic, offline-first personal music player for Android. It plays music the
user already owns, stored locally on the device. The experience should feel like a
commercial flagship music application without copying any existing product: deep AMOLED
blacks, large original artwork, editorial serif display type, restrained neon accents and
smooth, quiet motion.

The application is for personal use.

## 2. Non-goals

There will be no:

- online music streaming or catalogue;
- user registration or accounts;
- subscriptions, payments or advertising;
- cloud storage or backend server;
- social features, sharing or recommendations based on personal data;
- collection of analytics or telemetry.

Everything the app does must eventually work with no network connection.

## 3. Product principles

1. **Local first.** Imported audio stays on the device. Nothing is uploaded.
2. **Honest UI.** The interface never claims a feature works before it does. Placeholders
   are labelled "Planned"; simulated transport is labelled as a preview.
3. **Quiet luxury.** Atmosphere comes from artwork, colour and type, not from clutter,
   excessive borders or dense dashboards.
4. **Accessible by default.** Semantic HTML, labelled controls, visible focus, keyboard
   operation, reduced-motion support.
5. **Built to grow.** The foundation separates presentation, state and data so native
   playback and local import can be added without rewriting screens.

## 4. Screens (Milestone 1)

### Home (`#/`)

- Time-aware greeting and an editorial headline.
- Featured album hero with large artwork, metadata and preview actions.
- Recently played, Recently added and Favourite albums rails.
- Playlist shortcuts.
- Persistent mini-player when a preview track is selected.
- Bottom navigation (left rail on wide screens).
- Empty state when the library has no content: explains that local import is coming and
  lists what the foundation already includes.

### Library (`#/library/songs|albums|artists`)

- Songs, Albums and Artists sections via a segmented control (each tab is a real route).
- Songs: artwork row, title, artist · album, duration, play target.
- Albums: responsive grid of album cards.
- Artists: derived artist rows with album and track counts.
- Search field filtering the active section, with a live result announcement and a
  "No matches" state.
- Per-section empty states when the library is empty.

### Playlists (`#/playlists`)

- Playlist cards with generated gradient covers, name, track count and description.
- Designed empty state explaining that playlist creation arrives with local import.
- Playlist detail (`#/playlists/:id`): collection hero, play action, track list.

### Album detail (`#/albums/:id`)

- Large artwork, title, artist, year, track count and runtime.
- Play album action and numbered track list.

### Now Playing (`#/now-playing`)

- Full-screen overlay with a dynamic gradient derived from the album palette.
- Large artwork, album name and year, track title, artist.
- Scrubber with elapsed and total time.
- Previous, play/pause and next controls; queue button opens a bottom-sheet queue.
- Clear note that transport is a UI simulation and no audio engine is connected.
- Empty state when nothing is playing, with different copy for demo and real mode.

### Settings (`#/settings`)

- Library: music folders (Planned), imported track count (real value, currently 0).
- Playback: audio engine (Planned, Media3), playback settings (Planned).
- About: application name, version, platform (via Capacitor), library mode.
- Developer section visible only in development builds, with a demo-preview toggle.
- Demo banner when the preview library is active.

### Not found

- Safe fallback for unknown routes, with a route back home.

## 5. Demo data policy

- Demo content lives in `src/data/demo-data.js` and is isolated from the real data path.
- It is enabled only by the URL query `?demo=1`; it is never persisted.
- The header shows a "Dev preview" chip while active; Settings shows a banner; Now Playing
  states that playback is simulated.
- Album, artist and track names are fictional. Artwork is original SVG created for this
  project; no third-party or copyrighted covers are used.
- With demo mode off, the app shows the real (currently empty) library and its empty states.

## 6. Design system

### Colour tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#08090D` | app background |
| `--bg-secondary` | `#11131A` | secondary background |
| `--surface` | `#191B25` | elevated surface |
| `--text` | `#F4F1F8` | primary text |
| `--text-muted` | `#A3A0AE` | secondary text |
| `--accent` | `#A78BFA` | primary accent |
| `--accent-strong` | `#7C6BFF` | secondary accent |
| `--divider` | `#282936` | dividers |

Each album also carries a three-colour palette used for card glows and the Now Playing
gradient. In a later phase these palettes will be extracted from artwork at runtime.

### Typography

- Display: **Instrument Serif** (headlines, album titles, player title).
- Interface: **Manrope** (body, labels, controls).
- Both are self-hosted woff2 files with system fallbacks and `font-display: swap`.

### Shape, depth and motion

- Radii: 14 / 20 / 28 / 34 px plus pills.
- Low-contrast hairline borders; depth through soft shadows and coloured glows.
- One easing curve, short screen transitions, `prefers-reduced-motion` respected.
- Mobile-first: 360–430px priority; desktop breaks at 720px and 960px.

## 7. Milestone 1 success criteria

- Vite dev server and production build both succeed.
- Home, Library, Playlists, Now Playing and Settings exist, plus album and playlist detail.
- Bottom navigation, library tabs, search, album/playlist opening and mini-player work.
- Demo mode is opt-in, clearly labelled and visually complete.
- Empty states are designed and explain the future import path.
- Capacitor configuration is correct and the Android project is generated.
- Documentation records what was verified and what was not.

## 8. Future capability outline

- Local file import (Android Storage Access Framework), metadata and artwork extraction.
- Native playback with AndroidX Media3 / ExoPlayer and a MediaSessionService.
- Local database (SQLite) for tracks, playlists, favourites and playback state.
- Playlist creation and editing, queue reordering, gapless/crossfade settings.
- Artwork-derived palette extraction for the player gradient.
- App icon, splash screen, release signing and a personal distribution build.
