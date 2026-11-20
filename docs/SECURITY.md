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
real device actually skips this app during `bmgr` cloud backup or D2D migration, and that the
Android toolchain accepts the file (never compiled). `adb shell bmgr` / a D2D migration on
Android 12+ hardware is the check still owed.

Consequence: reinstalling or migrating to a new phone does **not** restore the library
database or playlists. A deliberate, user-initiated local export/import is planned for a
later release. Future persistent data must stay inside these exclusions unless that feature
is designed explicitly.

## Permissions

- **`INTERNET` removed.** Capacitor serves the bundled app from `https://localhost` through
  an in-process WebView request interceptor (`androidScheme: 'https'` in
  `capacitor.config.ts`); no socket is opened. The product has no streaming, accounts,
  analytics, remote artwork or backend. Fonts and artwork are bundled.
  Trade-off: `cap run --live-reload` against a dev server needs a temporary INTERNET
  permission in a *debug-only* manifest; do not add it to `main`.
- The **source** manifest declares no `uses-permission`. Storage/audio permissions will be
  added with the import feature (prefer the Storage Access Framework, which needs none).
  The **merged** manifest may still contain an app-private
  `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` entry that AndroidX Core adds; that is
  expected and is not network or storage access. This is from knowledge of AndroidX, not yet
  observed in a built APK here; the CI APK-inspection step fails on any other permission.
- Guarded by `AppPackageInstrumentedTest` (device; never run yet) and an `aapt2` inspection of the
  built debug APK in the CI workflow (`docs/ci/build.yml`, inactive until moved to
  `.github/workflows/`).

## FileProvider

The template `FileProvider` and `file_paths.xml` (which exposed all of external storage via
`<external-path path="."/>`) were **removed**. Capacitor core only references it for
(a) camera capture through an HTML `<input type=file capture>` and (b) notification-asset
helpers in plugins. The app uses neither and has no file inputs. If a future plugin needs
it, re-add a provider restricted to a single sub-directory of `cache-path`, never
`external-path` with `path="."`.

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
