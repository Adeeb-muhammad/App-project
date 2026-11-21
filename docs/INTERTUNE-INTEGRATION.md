# InterTune Android source integration

The Android app is the complete native [InterTune](https://github.com/ItzSkyeYT/InterTune) project, checked out under `android/` as a pinned Git submodule. The build includes the full native app and all of its nested source dependencies; it is not a web mockup or a port of selected screens.

- Upstream: https://github.com/ItzSkyeYT/InterTune
- Branch at import: `visionos-fix`
- Pinned upstream commit: `9f4248d76d04d808a3215427db7a828f38c1a8fd`
- Licence: GPL-3.0
- Nested submodules: `ffMetadataEx`, `taglib`, and `innertubex`

A fresh checkout must initialise nested submodules:

```bash
git clone --recurse-submodules https://github.com/Adeeb-muhammad/App-project.git
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

## Prepare and build

Use the repository-level scripts. They apply the checked-in, commit-pinned compatibility patch before running Gradle:

```bash
npm run android:test
npm run android:debug
```

Requirements: Python 3, JDK 21 and Android SDK 36.

The patch is in `scripts/prepare-intertune.py`. It refuses to run against any InterTune commit other than the pinned one, makes the minimal resource/test corrections required by the current source, and is safe to run repeatedly. GitHub Actions uses the same script, so local and CI builds use the same preparation.

The debug APK is produced under `android/app/build/outputs/apk/core/debug/`.

## App identity and data

The upstream Android application ID is `dev.skye.intertune` (the debug build is `dev.skye.intertune.debug`). It installs as a separate app from the original Cinematic Music package. It does not automatically migrate the old app's local library or app data.

## Licensing

Do not remove or replace the upstream `LICENSE`, copyright notices, or nested dependency licences. If distributing modified binaries, follow GPL-3.0 requirements for corresponding source and notices.
