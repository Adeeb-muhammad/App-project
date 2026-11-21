import { delegate, escapeHtml } from '../utils/dom.js';
import {
  goBack,
  navigate,
  parseRoute,
  subscribe as subscribeRoute,
} from '../utils/navigation.js';
import { getState, refreshLibrary, subscribe as subscribeStore } from '../state/store.js';
import { addImportedTrack } from '../data/imported.js';
import {
  addTrackToPlaylist,
  deletePlaylist,
  recordTrackPlayed,
  removeTrackFromPlaylist,
  setTrackRating,
  toggleFavourite,
} from '../data/personal-library.js';
import { pickAudioTrack } from '../native/audio-import.js';
import {
  getPlayerState,
  next,
  playTrack,
  previous,
  setShuffleEnabled,
  cycleRepeatMode,
  subscribe as subscribePlayer,
  toggle,
} from '../state/player.js';
import { findAlbum, findPlaylist, findTrack } from '../data/library.js';
import { miniPlayer } from '../components/mini-player.js';
import { navigation, setActiveNavigation } from '../components/navigation.js';
import { homePage } from '../pages/home.js';
import { libraryPage } from '../pages/library.js';
import { playlistsPage } from '../pages/playlists.js';
import { playlistPage } from '../pages/playlist.js';
import { albumPage } from '../pages/album.js';
import { playerPage } from '../pages/player.js';
import { settingsPage } from '../pages/settings.js';
import { notFoundPage } from '../pages/not-found.js';

const PAGES = {
  home: homePage,
  library: libraryPage,
  playlists: playlistsPage,
  playlist: playlistPage,
  album: albumPage,
  player: playerPage,
  settings: settingsPage,
  notFound: notFoundPage,
};

const BRAND_MARK = `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
  <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.55"/>
  <circle cx="16" cy="16" r="3" fill="currentColor"/>
  <path d="M16 4v12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

function shellMarkup({ demo }) {
  return `<div class="app${demo ? ' app--demo' : ''}">
    <header class="app-header">
      <a class="brand" href="#/" aria-label="Cinematic Music — home">
        <span class="brand__mark" aria-hidden="true">${BRAND_MARK}</span>
        <span class="brand__text">
          <span class="brand__name">Cinematic</span>
          <span class="brand__sub">Music</span>
        </span>
      </a>
      ${demo ? `<span class="dev-chip" role="status" title="Development preview: sample albums, no imported music"><span class="dev-chip__dot" aria-hidden="true"></span>Dev preview</span>` : ''}
    </header>

    <p class="app-notice" data-role="notice" role="status" aria-live="polite" hidden></p>

    <main id="app-main" class="app-main" tabindex="-1"></main>

    <div class="mini-player-slot" data-role="mini-player-slot"></div>

    <dialog class="playlist-picker" data-role="playlist-picker" aria-labelledby="playlist-picker-title">
      <div class="playlist-picker__head">
        <div>
          <p class="eyebrow">Your collection</p>
          <h2 id="playlist-picker-title">Add to playlist</h2>
        </div>
        <button class="icon-button" type="button" data-action="close-playlist-picker" aria-label="Close">×</button>
      </div>
      <label class="sr-only" for="playlist-picker-target">Choose a playlist</label>
      <select id="playlist-picker-target" class="search__input" data-role="playlist-picker-target"></select>
      <div class="playlist-picker__actions">
        <button class="button button--ghost button--small" type="button" data-action="close-playlist-picker">Cancel</button>
        <button class="button button--primary button--small" type="button" data-action="confirm-add-to-playlist">Add song</button>
      </div>
    </dialog>

    ${navigation()}
  </div>`;
}

export function mountShell(root) {
  root.innerHTML = shellMarkup(getState());

  const main = root.querySelector('#app-main');
  const miniSlot = root.querySelector('[data-role="mini-player-slot"]');
  const notice = root.querySelector('[data-role="notice"]');

  let cleanup = null;
  let noticeTimer = null;

  function showNotice(message) {
    if (!notice || !message) return;
    notice.textContent = message;
    notice.hidden = false;
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      notice.hidden = true;
    }, 7000);
  }

  function renderMiniPlayer() {
    const playerState = getPlayerState();
    miniSlot.innerHTML = miniPlayer(playerState);
    const bar = miniSlot.querySelector('[data-role="mini-progress"]');
    if (bar && playerState.duration > 0) {
      bar.style.width = `${Math.min(100, (playerState.position / playerState.duration) * 100).toFixed(2)}%`;
    }
  }

  function renderRoute({ focus = true } = {}) {
    const route = parseRoute();
    const state = getState();
    const page = PAGES[route.name] ?? notFoundPage;

    if (typeof cleanup === 'function') cleanup();
    cleanup = null;

    // A render/mount failure must never leave a blank screen or break later
    // navigation: show a recoverable error state instead.
    try {
      main.innerHTML = page.render(state, route);
      cleanup = page.mount?.(main, { state, route }) ?? null;
    } catch (error) {
      console.error('[shell] failed to render route', route.path, error);
      main.innerHTML = `<div class="screen"><h1 class="screen-head__title" tabindex="-1">Something went wrong</h1><p class="screen-head__sub">This screen could not be displayed.</p><a class="button button--ghost" href="#/">Back home</a></div>`;
      cleanup = null;
    }

    setActiveNavigation(route.name);
    const heading = main.querySelector('h1');
    const title = heading?.textContent?.trim() || page.title;
    document.title = title ? `${title} · Cinematic Music` : 'Cinematic Music';
    window.scrollTo(0, 0);

    if (focus) {
      requestAnimationFrame(() => {
        const target = main.querySelector('h1') ?? main;
        target?.focus?.({ preventScroll: true });
      });
    }
  }

  renderMiniPlayer();
  renderRoute({ focus: false });

  subscribeRoute(() => renderRoute({ focus: true }));

  subscribeStore(() => {
    renderMiniPlayer();
    renderRoute({ focus: false });
  });

  subscribePlayer(({ type, state: playerState, message }) => {
    if (type === 'track') {
      renderMiniPlayer();
      // When the full-screen player is open it owns the current track's
      // artwork, title and palette, so re-render that route in place.
      if (parseRoute().name === 'player') renderRoute({ focus: false });
      return;
    }
    if (type === 'state') {
      renderMiniPlayer();
      return;
    }
    if (type === 'notice') {
      showNotice(message ?? 'Something went wrong.');
      return;
    }
    if (type === 'progress') {
      const bar = miniSlot.querySelector('[data-role="mini-progress"]');
      if (bar && playerState.duration > 0) {
        bar.style.width = `${Math.min(100, (playerState.position / playerState.duration) * 100).toFixed(2)}%`;
      }
    }
  });

  delegate(root, 'click', '[data-action]', (event, element) => {
    const action = element.dataset.action;
    if (!action) return;

    if (action === 'toggle-play') {
      event.preventDefault();
      toggle();
      return;
    }
    if (action === 'toggle-shuffle') {
      setShuffleEnabled(!getPlayerState().shuffleEnabled);
      return;
    }
    if (action === 'cycle-repeat') {
      cycleRepeatMode();
      return;
    }
    if (action === 'next') {
      next();
      return;
    }
    if (action === 'previous') {
      previous();
      return;
    }
    if (action === 'close-player') {
      goBack('/');
      return;
    }
    if (action === 'toggle-favourite') {
      const trackId = element.dataset.trackId;
      if (!trackId) return;
      const favourite = toggleFavourite(trackId);
      refreshLibrary();
      showNotice(favourite ? 'Added to Liked Songs.' : 'Removed from Liked Songs.');
      return;
    }
    if (action === 'add-to-playlist') {
      const trackId = element.dataset.trackId;
      const picker = root.querySelector('[data-role="playlist-picker"]');
      const select = root.querySelector('[data-role="playlist-picker-target"]');
      const playlists = getState().library.playlists.filter((playlist) => !playlist.isSystem);
      if (!trackId || !picker || !select) return;
      if (playlists.length === 0) {
        showNotice('Create a playlist first, then add songs from your library.');
        navigate('/playlists');
        return;
      }
      select.innerHTML = playlists.map((playlist) =>
        `<option value="${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)}</option>`,
      ).join('');
      picker.dataset.trackId = trackId;
      picker.showModal?.();
      return;
    }
    if (action === 'close-playlist-picker') {
      root.querySelector('[data-role="playlist-picker"]')?.close?.();
      return;
    }
    if (action === 'confirm-add-to-playlist') {
      const picker = root.querySelector('[data-role="playlist-picker"]');
      const select = root.querySelector('[data-role="playlist-picker-target"]');
      const trackId = picker?.dataset.trackId;
      const playlistId = select?.value;
      if (trackId && playlistId && addTrackToPlaylist(playlistId, trackId)) {
        refreshLibrary();
        showNotice('Added to your playlist.');
      } else {
        showNotice('That song is already in the playlist or could not be added.');
      }
      picker?.close?.();
      return;
    }
    if (action === 'remove-from-playlist') {
      const playlistId = element.dataset.playlistId;
      const trackId = element.dataset.trackId;
      if (playlistId && trackId && removeTrackFromPlaylist(playlistId, trackId)) {
        refreshLibrary();
        showNotice('Removed from playlist.');
      }
      return;
    }
    if (action === 'delete-playlist') {
      const playlistId = element.dataset.playlistId;
      const playlist = getState().library.playlists.find((entry) => entry.id === playlistId);
      if (!playlist || playlist.isSystem) return;
      if (!window.confirm(`Delete "${playlist.name}"?`)) return;
      deletePlaylist(playlistId);
      refreshLibrary();
      if (parseRoute().name === 'playlist') navigate('/playlists');
      showNotice('Playlist deleted.');
      return;
    }
    if (action === 'rate-track') {
      const trackId = element.dataset.trackId;
      const rating = Number(element.dataset.rating);
      if (trackId && setTrackRating(trackId, rating)) {
        refreshLibrary();
        showNotice(`Saved your ${rating}-star rating.`);
      }
      return;
    }
    if (action === 'import-audio') {
      event.preventDefault();
      if (element.dataset.busy === 'true') return;
      element.dataset.busy = 'true';
      element.setAttribute('aria-busy', 'true');
      pickAudioTrack()
        .then((result) => {
          if (!result.ok) {
            if (result.message) showNotice(result.message);
            return;
          }
          const { track } = addImportedTrack(result.track);
          if (!track) return;
          refreshLibrary();
          showNotice(`Added “${track.title}” to your library.`);
          navigate('/library/songs');
        })
        .finally(() => {
          delete element.dataset.busy;
          element.removeAttribute('aria-busy');
        });
      return;
    }
    if (action === 'play-track') {
      const trackId = element.dataset.trackId;
      if (!trackId) return;
      const scope = element.closest('[data-queue]');
      const ids = scope
        ? Array.from(scope.querySelectorAll('[data-action="play-track"][data-track-id]')).map((node) => node.dataset.trackId)
        : [trackId];
      const tracks = ids
        .map((id) => findTrack(getState().library, id))
        .filter(Boolean);
      if (tracks.some((track) => track.id === trackId)) {
        recordTrackPlayed(trackId);
        refreshLibrary();
      }
      playTrack(tracks, trackId);
      navigate('/now-playing');
      return;
    }
    if (action === 'play-album') {
      const album = findAlbum(getState().library, element.dataset.albumId);
      if (!album || album.tracks.length === 0) return;
      recordTrackPlayed(album.tracks[0].id);
      refreshLibrary();
      playTrack(album.tracks, album.tracks[0].id);
      navigate('/now-playing');
      return;
    }
    if (action === 'play-playlist') {
      const playlist = findPlaylist(getState().library, element.dataset.playlistId);
      if (!playlist || playlist.tracks.length === 0) return;
      recordTrackPlayed(playlist.tracks[0].id);
      refreshLibrary();
      playTrack(playlist.tracks, playlist.tracks[0].id);
      navigate('/now-playing');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('dialog[open]')) return;
    if (parseRoute().name === 'player') {
      goBack('/');
    }
  });
}
