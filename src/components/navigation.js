import { icon } from './icon.js';
import { href } from '../utils/navigation.js';

const ITEMS = [
  { route: 'home', label: 'Home', path: '/', icon: 'home' },
  { route: 'library', label: 'Library', path: '/library', icon: 'library' },
  { route: 'playlists', label: 'Playlists', path: '/playlists', icon: 'playlists' },
  { route: 'settings', label: 'Settings', path: '/settings', icon: 'settings' },
];

/**
 * One navigation element for both layouts: a bottom bar on phones and a left
 * rail on wide screens. CSS moves it; the markup and semantics stay identical.
 */
export function navigation() {
  return `<nav class="app-nav" aria-label="Primary">
    ${ITEMS.map(
      (item) => `<a class="app-nav__item" href="${href(item.path)}" data-nav="${item.route}">
        <span class="app-nav__icon" aria-hidden="true">${icon(item.icon, { size: 22 })}</span>
        <span class="app-nav__label">${item.label}</span>
      </a>`,
    ).join('')}
  </nav>`;
}

const ACTIVE_BY_ROUTE = {
  home: 'home',
  library: 'library',
  album: 'library',
  playlists: 'playlists',
  playlist: 'playlists',
  settings: 'settings',
};

export function setActiveNavigation(routeName) {
  const active = ACTIVE_BY_ROUTE[routeName] ?? null;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}
