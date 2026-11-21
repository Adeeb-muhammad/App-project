import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/home.css';
import './styles/library.css';
import './styles/playlists.css';
import './styles/player.css';
import './styles/settings.css';
import './styles/discover.css';

import { isDemoMode } from './utils/demo-mode.js';
import { initStore } from './state/store.js';
import { configurePlayback, syncFromNative } from './state/player.js';
import { createNativeBridge, isAndroidNative } from './native/native-audio.js';
import { mountShell } from './app/shell.js';

const root = document.querySelector('#app');

if (root) {
  // Demo mode is opt-in per URL (`?demo=1`) and never persisted.
  const demo = isDemoMode();
  const native = isAndroidNative();

  initStore({ demo });

  // Demo mode always uses the simulation so the preview never claims audio.
  // A real Android build talks to Media3; any other browser explains why it
  // cannot play instead of faking transport.
  configurePlayback({
    mode: demo ? 'simulation' : native ? 'native' : 'unavailable',
    bridge: native ? createNativeBridge() : null,
  });

  mountShell(root);

  // The MediaSessionService keeps playing while the WebView is paused; when
  // the user returns, pull the authoritative state so the UI catches up.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFromNative();
  });
} else {
  console.error('[app] Missing #app root element.');
}
