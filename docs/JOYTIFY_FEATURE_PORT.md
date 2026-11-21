# Joytify Feature Port — Cinematic Music

This document tracks the Joytify capabilities being adapted into Cinematic Music. The source repository is a full-stack React/Node music platform; Cinematic Music is a vanilla-JS Capacitor Android app with a native Media3 playback service. Feature behavior and compatible source logic can be reused, but UI and integration code must fit the existing app rather than replacing its working Android playback stack.

## Porting principles

- Keep AndroidX Media3 / ExoPlayer as the only real playback engine. Do not replace it with a WebView audio element.
- Keep local music imports and the current content URI permission model working.
- Prefer local-first implementations for a personal music player. Do not display cloud, social, or account features as functional until their services exist.
- Reuse Joytify logic where useful, adapting React/TypeScript components to the existing vanilla-JS modules and CSS.
- Add automated tests for each feature and keep the Android/browser CI green before merging.

## Feature inventory

| Joytify capability | Cinematic Music status | Port approach |
| --- | --- | --- |
| Native audio player and progress | Existing | Keep Media3 and current scrubber fix |
| Queue display and track selection | Implemented in this PR | Play next, move/remove upcoming items and clear upcoming without interrupting the current track |
| Shuffle | Implemented in PR #11 | Map to Media3 shuffle mode and simulation behavior |
| Repeat off / current track / queue | Implemented in PR #11 | Map to Media3 repeat modes |
| Playlist create, edit, delete and assign tracks | Existing local feature | Extend with sort/arrangement options |
| Liked Songs and 5-star ratings | Existing local feature | Retain |
| Recently played | Existing local feature | Expand into listening history and stats |
| Advanced search | Implemented in this PR | Search, per-section filters and sorting across local songs, albums and artists |
| Song, album and artist pages | Album detail exists; artist detail is derived only | Add rich local detail pages and discography |
| Lyrics and song comments | Not implemented | Add local lyrics display and private notes/comments; remote public comments require accounts/backend |
| Music uploads and metadata | Local audio import exists | Add local metadata editing, tags, genres, language and artwork; do not upload without a configured server |
| Personalized recommendations | Not implemented | Build on-device suggestions from local library and listening history |
| Following musicians | Not implemented | Local follow list for artists already in the imported catalogue |
| Notifications | App notices exist | Add local library/artist activity notifications; live cross-user notices need backend |
| Listening analytics / monthly stats | Not implemented | Add on-device play counts, time listened and monthly summaries |
| Dynamic artwork palettes | Fixed fallback palettes exist | Extract palette from imported artwork locally |
| Keyboard shortcuts | Not implemented | Add central shortcut handling and a shortcut reference dialog |
| Languages / localization | English only | Introduce message catalog and Joytify's six language options |
| Playback, interface and notification preferences | Basic settings screen exists | Persist real settings locally and expose the controls |
| Profiles and personal collections | No account/profile system | Add a local profile/preferences page first; shared profiles need backend |
| Authentication, verification and password reset | Not implemented | Requires a trusted backend and email provider |
| Cross-device sessions and synchronization | Not implemented | Requires backend identity, database and session service |
| Real-time social notifications | Not implemented | Requires authenticated backend and socket service |
| Remote music catalogue, uploads and cloud storage | Not implemented | Requires server-side catalogue, storage and moderation |
| Administration / content management | Not implemented | Requires authenticated roles and a server-side management surface |

## Delivery order

### Batch 1 — Playback controls ✅
- Shuffle and repeat modes, including Media3 integration and simulation tests.
- Preserve the existing queue, local import path, background playback and scrubber behavior.

### Batch 2 — Queue and library management (in progress)
- Queue editing implemented in this PR: play next, move upcoming tracks, remove upcoming tracks and clear upcoming tracks while keeping the active track playing.
- Advanced local search implemented in this PR: filter Liked Songs / rated songs / favourite albums and sort songs, albums and artists.
- Edit imported metadata and add tags, genres, language, lyrics and private notes.

### Batch 3 — Discovery and personalisation
- Artist and song detail pages, local following, discographies and local recommendations.
- Monthly listening analytics, artwork palette extraction and richer library management.

### Batch 4 — Experience and settings
- Keyboard shortcuts, localization, notification preferences and complete local playback settings.
- A local profile/preferences surface.

### Batch 5 — Optional networked platform
- Authentication, email verification, synced profiles/playlists/ratings, shared catalogue uploads, cloud storage, real-time notifications and cross-device sessions.
- This batch needs a deployable backend, database, storage provider, email service, credentials, privacy/security design and account/data-deletion flows. It will not be faked with local-only UI.

## Current implementation note

PR #11 merged shuffle/repeat; PR #12 merged queue management after web, browser E2E and Android CI passed. The library filter/sort feature keeps catalogue operations on-device and never mutates the import order. Physical-device verification is still required for native queue editing.
