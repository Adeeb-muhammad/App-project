# Cinematic Music

The Android app is based on [InterTune](https://github.com/ItzSkyeYT/InterTune), a complete native Android music player. The app uses InterTune's **Full** build variant, including its FFmpeg-backed media scanner and decoder components.

**YouTube Music search and playback work without you supplying a YouTube Data API key.**

## Get the full source

Fresh clone:

```bash
git clone --recurse-submodules https://github.com/Adeeb-muhammad/App-project.git
cd App-project
```

Existing checkout:

```bash
git submodule update --init --recursive
```

The Android source is pinned to InterTune commit `9f4248d76d04d808a3215427db7a828f38c1a8fd` from its `visionos-fix` branch. Recursive checkout is required for the nested dependencies.

## Build Android

Requirements: Python 3, JDK 21, Android SDK 36, CMake 3.31.6 and NDK 29.0.13113456.

```bash
npm run android:test
npm run android:debug
```

The preparation step patches the pinned source resources/tests and downloads the prebuilt FFmpeg libraries needed by the Full variant. The resulting debug APK is under `android/app/build/outputs/apk/full/debug/`.

## Features

InterTune combines YouTube Music search and streaming with local music, playlists, offline downloads, synced lyrics, queue management, recommendations, song recognition, Chromecast/FCast/DLNA casting, equalizer and spatial-audio options, Android Auto support, widgets and more. See the [upstream feature list](https://github.com/ItzSkyeYT/InterTune#features).

The Full variant is intentional: the lighter Core flavor excludes bundled FFmpeg scanning/decoder components.

## App identity and existing data

The upstream application ID is `dev.skye.intertune` (debug package: `dev.skye.intertune.debug`). It installs as a separate Android app from the previous Cinematic Music package; the old app and its stored data are not overwritten or automatically migrated.

The root Vite project is retained as a separate web prototype and is not packaged into the native APK.

## Licence

InterTune is licensed under **GNU GPL-3.0**. The upstream source, notices, and nested dependency licences are retained. Binary redistribution must meet GPL-3.0 and each dependency's licence conditions.

- [InterTune source](https://github.com/ItzSkyeYT/InterTune)
- [GPL-3.0 licence](https://github.com/ItzSkyeYT/InterTune/blob/visionos-fix/LICENSE)
