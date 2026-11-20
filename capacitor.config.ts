import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration.
 *
 * The app name and id are intentionally easy to change. After editing them run
 * `npx cap sync android`; the generated Android project keeps its own copies in
 * android/app/build.gradle and strings.xml (see docs/ARCHITECTURE.md).
 */
const config: CapacitorConfig = {
  appId: 'com.personal.cinematicmusic',
  appName: 'Cinematic Music',
  webDir: 'dist',
  backgroundColor: '#08090D',
  android: {
    backgroundColor: '#08090D',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
