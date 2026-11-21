# Cinematic Music

The Android app is now based on [InterTune](https://github.com/ItzSkyeYT/InterTune), a complete native Android music player. The pinned upstream checkout is brought in as the `android/` Git submodule, including its own nested dependencies.

**The Android app does not require you to create or paste a YouTube Data API key.** InterTune has its own YouTube Music search and playback implementation.

## Get the full source

For a fresh clone:

```bash
git clone --recurse-submodules https://github.com/Adeeb-muhammad/App-project.git
cd App-project
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

The submodule is pinned to InterTune commit `9f4248d76d04d808a3215427db7a828f38c1a8fd` from its `visionos-fix` branch. Recursive checkout is required because InterTune itself uses three submodules.

## Build Android

Requirements: JDK 21 and Android SDK 36.

```bash
cd android
./gradlew :app:assembleCoreDebug
```

Run native unit tests:

```bash
./gradlew :app:testCoreDebugUnitTest
```

The debug APK is written under `android/app/build/outputs/apk/core/debug/`. GitHub Actions builds it and uploads an artifact for each passing pull request or main-branch run.

## What the Android app includes

InterTune's upstream project provides YouTube Music search and playback, local music, playlists, downloads, synced lyrics, queue management, recommendations and other native Android music-player features. See the [upstream feature list](https://github.com/ItzSkyeYT/InterTune#features) for the complete list.

YouTube Music playback is provided by InterTune's own implementation, not Spotify's API and not a YouTube Data API key configured by the user. Network access is needed for online search and streaming; local music remains available from the device.

## Retained web prototype

The root Vite project and its browser tests are retained as a separate prototype. They are not packaged into the native Android APK. The Android build is the InterTune project in `android/`.

## Licensing

InterTune is licensed under **GNU GPL version 3.0**. Its source and licence remain in the submodule. Any redistribution of a binary built from this Android project must comply with GPL-3.0, including providing the corresponding source and preserving required notices. InterTune's nested dependencies retain their own licence terms.

- [InterTune source repository](https://github.com/ItzSkyeYT/InterTune)
- [InterTune GPL-3.0 licence](https://github.com/ItzSkyeYT/InterTune/blob/visionos-fix/LICENSE)
