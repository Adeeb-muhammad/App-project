# Development Roadmap — Cinematic Music

Phases are sequential. Each phase ends with a review before the next begins.

## Phase 0 — Foundation ✅ (this milestone)

**Delivered**

- Vite + vanilla JS project with modular structure and design tokens.
- Five screens plus album/playlist detail and not-found route.
- Hash router, delegated actions, store, simulated transport, mini-player.
- Demo mode (`?demo=1`) isolated from the real library; designed empty states.
- Original SVG artwork and self-hosted fonts.
- Capacitor 8 config and generated Android project.
- Documentation.

**Exit criteria:** production build passes; navigation works; demo mode is opt-in;
Capacitor project is generated and synced.

**Carry-over:** build the APK on a machine with JDK 21 + Android SDK 36 (CI attempts it; see
docs/TASKS.md). Now Playing was re-verified in a browser during the hardening session.

## Phase 1 — Hardening and identity

- App icon (adaptive), splash screen, status-bar styling.
- Add a small QA checklist and scripted smoke checks (optional Playwright, not a dependency
  of the app).
- Confirm performance on a low-end Android device.
- Verify edge-to-edge insets on a real device and gesture navigation.
- ~~Add `android:allowBackup` / security review decisions.~~ Done in the hardening session; see SECURITY.md.

**Exit:** installed debug APK reviewed on a physical device; no layout collisions with
system bars; icon and splash look correct.

## Phase 2 — Local import and persistence

**Milestone 2A delivered a subset:** single-file Storage Access Framework import, persistable
URI grants, metadata read with `MediaMetadataRetriever`, `localStorage` metadata (not SQLite)
and a live library view model. Folder/multi-file import, embedded artwork, scanning and database
migrations remain.

- Storage Access Framework import flow (folder or multi-file picker).
- Metadata parsing (title, artist, album, track number, duration) and embedded artwork.
- Local database (SQLite through a Capacitor-compatible plugin) and schema migrations.
- Incremental scan, duplicate handling, missing-file handling.
- Library queries replace the demo selector; empty states become live.

**Exit:** imported tracks survive app restarts; library screens read from the database;
demo data remains separate.

## Phase 3 — Native playback (Media3)

**Milestone 2A delivered the core:** Kotlin Capacitor plugin, Media3 ExoPlayer in a
`MediaSessionService`, notification/lock-screen session, audio focus, seek, next/previous and
background playback. Queue editing, repeat/shuffle, gapless behaviour and a device verification
pass remain.

- Kotlin Capacitor plugin wrapping ExoPlayer.
- `MediaSessionService` with notification, lock screen, audio focus and headset controls.
- Queue, repeat/shuffle, seek and gapless behaviour.
- Replace `src/state/player.js` internals with a bridge adapter; screens unchanged.
- Remove the "UI simulation" notes only when audio genuinely works.

**Exit:** audio plays with the screen off, survives app backgrounding, and responds to
media buttons.

## Phase 4 — Library features

**Delivered in the Joytify-inspired local collection milestone:**

- Create, rename and delete personal playlists; add/remove tracks.
- Liked Songs and favourites persisted on-device.
- Personal 1–5 star ratings and recently played album rail.
- Existing Library search continues to filter songs, albums and artists.

**Still open:** sorting, multi-select, SQLite migration/export and richer listening statistics.

## Phase 5 — Cinematic polish

- Palette extraction from artwork for the Now Playing gradient and card glows.
- Shared-element transitions between album art and player.
- Virtualised long lists; image caching and thumbnails.
- Optional landscape/tablet refinements.

## Phase 6 — Personal release

- Release keystore and signed AAB/APK (kept out of the repository).
- Changelog (versioning policy is in SECURITY.md).
- Backup/export of playlists and settings.
- Install on the owner's device; no store listing required.

## Deferred / out of scope

Streaming, accounts, cloud sync, social features, ads, subscriptions, remote backend.
