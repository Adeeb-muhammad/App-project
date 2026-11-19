import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // The app is packaged into a Capacitor WebView, so the app version shown in
  // Settings is injected at build time instead of being read from package.json
  // in the browser bundle.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Capacitor 8 supports Android 7+ with a Chrome-based WebView. ES2020 keeps
    // the bundle usable on older system WebViews while remaining modern.
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
});
