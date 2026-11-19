import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/home.css';
import './styles/library.css';
import './styles/playlists.css';
import './styles/player.css';
import './styles/settings.css';

import { isDemoMode } from './utils/demo-mode.js';
import { initStore } from './state/store.js';
import { mountShell } from './app/shell.js';

const root = document.querySelector('#app');

if (root) {
  // Demo mode is opt-in per URL (`?demo=1`) and never persisted.
  initStore({ demo: isDemoMode() });
  mountShell(root);
} else {
  console.error('[app] Missing #app root element.');
}
