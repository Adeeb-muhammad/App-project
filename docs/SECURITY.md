# Security, privacy and versioning decisions (V1)

Cinematic Music is a personal, offline-first player. Users will eventually import private
music and keep private playlists, so V1 defaults to **nothing leaves the device**.

## Backup policy

| Mechanism | What it covers | Setting | Where |
|---|---|---|---|
| `android:allowBackup` | All backup on API 24-30; documented by Android as disabling cloud backup **and** device-to-device (D2D) transfer on every version, but Android also warns some OEMs cannot disable D2D migration | `"false"` | `AndroidManifest.xml` |
| `android:dataExtractionRules` (API 31+) | Cloud backup (`<cloud-backup>`) and D2D transfer (`<device-transfer>`), configured separately | every domain excluded in both sections | `res/xml/data_extraction_rules.xml` |
| `android:fullBackupContent` | Legacy cloud backup rules (API <= 30) | **not set** - redundant once `allowBackup="false"` | - |

The rules file excludes all nine documented domains (`root`, `file`, `database`,
`sharedpref`, `external`, `device_root`, `device_file`, `device_database`,
`device_sharedpref`), each with `path="."` (the documented "whole domain" form), in both
sections, and contains no `<include>`. The `device_*` domains are device-protected storage
and are only defined by the Android 12+ `data-extraction-rules` format, not by the legacy
`full-backup-content` format, which is why they appear here and nowhere else. This app does
not use device-protected storage (no `directBootAware` components), so those four lines are
defence in depth, not a fix for a known leak.

Why both layers: Lint documents `allowBackup`/`fullBackupContent` as applying only to cloud
backup on Android 12+, while the manifest reference says `allowBackup="false"` also stops D2D.
The sources disagree, so the rules file states the policy explicitly instead of relying on
either reading.

What is verified: the XML is well-formed and `tests/android-policy.test.js` asserts the
source files (every domain excluded in both sections, no `<include>`, `allowBackup="false"`,
rules referenced). It was confirmed to fail when a line is removed. **Not verified:** that a
real device actually skips this app during `bmgr` cloud backup or D2D migration. The file is
accepted by the Android toolchain now that the debug APK builds, but `adb shell bmgr` / a D2D
migration on Android 12+ hardware is the runtime check still owed.

Consequence: reinstalling or migrating to a new phone does **not** restore the library
database or playlists. A deliberate, user-initiated local export/import is planned for a
later release. Future persistent data must stay inside these exclusions unless that feature
is designed explicitly.

## Permissions

Milestone 2A adds real playback, so the source manifest now declares exactly four permissions:

| Permission | Why |
| --- | --- |
| `FOREGROUND_SERVICE` | `MediaSessionService` keeps playing while the app is backgrounded. |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Declares the foreground-service type required on API 34+. |
| `POST_NOTIFICATIONS` | Media3’s playback notification on API 33+; requested at first playback. |
| `WAKE_LOCK` | ExoPlayer’s local wake mode so audio is not cut off with the screen off. |
| `INTERNET` | Used **only** by the optional “save a YouTube link as MP3” download. The rest of the app is local and works with no connection. |

**No storage permission is requested.** File access is the Storage Access Framework
(`ACTION_OPEN_DOCUMENT`, `audio/*`) plus a persistable read grant for the one URI the user
picked. There is no `READ_EXTERNAL_STORAGE`, `READ_MEDIA_AUDIO` or `MANAGE_EXTERNAL_STORAGE`,
and no scanning of the device library.

- **`INTERNET` is limited to downloads.** Capacitor still serves the bundled app from
  `https://localhost` through an in-process WebView request interceptor
  (`androidScheme: 'https'`), so the UI itself opens no socket. The permission is declared
  because the optional download runs yt-dlp against a URL the user pasted; nothing is sent
  anywhere else, there is no analytics or telemetry, and playback remains fully offline once
  a file is saved. Media3’s datasource manifest contributes `ACCESS_NETWORK_STATE`; the
  manifest removes it with `tools:node="remove"` because only local documents are played
  (yt-dlp opens sockets directly and does not need the connectivity state).
- The **merged** manifest may still contain an app-private
  `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` entry that AndroidX Core adds.
  The `aapt2` inspection of the built debug APK confirmed exactly the five permissions above
  plus that app-private entry, and no storage permission.
- `PlaybackService` is exported because `MediaSessionService` must be bindable by system media
  components; it has no other exported surface beyond `MainActivity`.
- Guarded by `AppPackageInstrumentedTest` and `PlaybackServiceInstrumentedTest` (compiled, not
  yet run on a device), `tests/native-contract.test.js`, `tests/android-policy.test.js`, and an
  `aapt2` inspection in CI.

## FileProvider

The template `FileProvider` and `file_paths.xml` (which exposed all of external storage via
`<external-path path="."/>`) were **removed**, then reintroduced deliberately for the download
feature — scoped as that note required, to a single app-private folder:

- one provider, `androidx.core.content.FileProvider`, authority `${applicationId}.downloads`,
  `android:exported="false"`, `grantUriPermissions="true"`;
- `res/xml/download_paths.xml` contains exactly `<files-path name="youtube-downloads"
  path="downloads/" />` — no `external-path`, `root-path` or `external-files-path`;
- it exists so a downloaded MP3 can be handed to the library as a `content://` URI, keeping
  the player’s rule that only content URIs are ever enqueued. Files stay inside the app’s
  private `files/downloads/` directory and are removed with the app.

`tests/android-policy.test.js` asserts the authority, `exported="false"` and the absence of
external paths, so widening it later fails the suite.

## Signing credentials

The root `.gitignore` excludes `*.jks`, `*.keystore`, `keystore.properties`, `*.p12`,
`*.pfx`, `*.pem`, `*.key`, `signing.properties` and `google-services.json`. No signing
configuration exists in the repository yet, and no key was created. `gradle-wrapper.jar`,
Gradle files and sources remain tracked. Release signing is a later task; supply
credentials through an untracked `keystore.properties` or CI secrets.

## Data safety in the UI

All text goes through `escapeHtml`. Values that reach CSS or URLs are additionally
validated in `src/utils/safe.js`: colours must be hex (`safeColour`), artwork must be a
local path/`blob:`/raster `data:` URL (`safeImageSrc`, which blocks remote hosts so artwork
can never trigger a network request). Route parameters are decoded defensively. Future
importer code must pass metadata through these helpers or store it already sanitised.

## Versioning policy

- `package.json` `version` is the **single source of truth**, using SemVer
  (`0.x.y` = pre-release; `1.0.0` = first release with real playback and import).
- Android `versionName` is read from `package.json` in `android/app/build.gradle`; the
  Settings screen shows the same value (injected as `__APP_VERSION__` by Vite).
- Android `versionCode` is an independent integer in `android/app/build.gradle`; increase it
  by 1 for every build that is distributed. It is not derived from the version string.
- To release: bump `package.json` (and `package-lock.json` via `npm version`), bump
  `versionCode`, tag `vX.Y.Z`.
