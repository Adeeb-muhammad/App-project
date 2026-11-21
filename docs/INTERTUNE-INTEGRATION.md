# InterTune Android source integration

This repository tracks the full Android app through a Git submodule at `android/`.

- Upstream: https://github.com/ItzSkyeYT/InterTune
- Branch at import: `visionos-fix`
- Pinned upstream commit: `9f4248d76d04d808a3215427db7a828f38c1a8fd`
- Licence: GPL-3.0
- Nested submodules: `ffMetadataEx`, `taglib`, and `innertubex`

The Git submodule is the complete upstream project, not a hand-written port. Use `git submodule update --init --recursive` after checking out the parent repository. CI uses `actions/checkout` with recursive submodules.

Build the default core debug variant with:

```bash
cd android
./gradlew :app:assembleCoreDebug
```

The native Android app is built from InterTune. The root Vite/Capacitor app is retained only as a separate web prototype and is not copied into the InterTune APK.

Do not remove or replace the upstream `LICENSE`, copyright notices, or nested dependency licences. If distributing modified binaries, follow GPL-3.0 requirements for corresponding source and notices.
