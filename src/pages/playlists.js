import { escapeHtml } from '../utils/dom.js';
import { glowStyle } from '../utils/safe.js';
import { href } from '../utils/navigation.js';
import { formatRuntime, pluralise } from '../utils/format.js';
import { refreshLibrary } from '../state/store.js';
import { createPlaylist, deletePlaylist } from '../data/personal-library.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';

function playlistCard(playlist, editable = true) {
  const style = glowStyle(playlist.palette);
  return `<li class="playlist-card-item">
    <div class="playlist-card-wrap">
      <a class="playlist-card" href="${href(`/playlists/${encodeURIComponent(playlist.id)}`)}" style="${style}">
        <span class="playlist-card__cover" aria-hidden="true">
          <span class="playlist-card__ring"></span>
          ${icon('playlists', { size: 24 })}
        </span>
        <span class="playlist-card__body">
          <span class="playlist-card__name">${escapeHtml(playlist.name)}</span>
          <span class="playlist-card__meta">${pluralise(playlist.trackCount, 'track')} · ${formatRuntime(playlist.duration)}</span>
          <span class="playlist-card__description">${escapeHtml(playlist.description || (playlist.isSystem ? 'Your saved tracks, all in one place.' : 'A playlist made by you.'))}</span>
        </span>
        <span class="playlist-card__chevron" aria-hidden="true">${icon('chevronRight', { size: 18 })}</span>
      </a>
      ${!editable || playlist.isSystem ? '' : `<button class="playlist-card__delete" type="button" data-action="delete-playlist" data-playlist-id="${escapeHtml(playlist.id)}" aria-label="Delete playlist ${escapeHtml(playlist.name)}">Delete</button>`}
    </div>
  </li>`;
}

export const playlistsPage = {
  title: 'Playlists',
  render(state) {
    const { playlists } = state.library;
    return `<div class="screen screen--playlists">
      <header class="screen-head">
        <p class="eyebrow">Curated by you</p>
        <h1 class="screen-head__title" tabindex="-1">Playlists</h1>
        <p class="screen-head__sub">Build your own collections and keep them on this device.</p>
      </header>

      ${state.demo ? '<p class="playlist-readonly">Demo preview is read-only. Create playlists in your real library.</p>' : `<form class="playlist-create" data-role="create-playlist-form">`
        <label class="sr-only" for="new-playlist-name">Playlist name</label>
        <input id="new-playlist-name" name="name" class="search__input" maxlength="40" required
          placeholder="Name your playlist" autocomplete="off" />
        <label class="sr-only" for="new-playlist-description">Playlist description</label>
        <input id="new-playlist-description" name="description" class="search__input"
          maxlength="180" placeholder="Description (optional)" autocomplete="off" />
        <button class="button button--primary button--small" type="submit">Create playlist</button>
      </form>`}

      ${playlists.length
        ? `<ul class="playlist-list">${playlists.map((playlist) => playlistCard(playlist, !state.demo)).join('')}</ul>`
        : `<div class="intro-panel">${emptyState({
            iconName: 'playlists',
            title: 'No playlists yet',
            description: 'Create a playlist above, then add songs from your library.',
            action: `<a class="button button--ghost" href="${href('/library/songs')}">Browse the library</a>`,
          })}</div>`}
    </div>`;
  },

  mount(root) {
    const form = root.querySelector('[data-role="create-playlist-form"]');
    if (!form) return undefined;
    const onSubmit = (event) => {
      event.preventDefault();
      const name = form.elements.namedItem('name')?.value ?? '';
      const description = form.elements.namedItem('description')?.value ?? '';
      const playlist = createPlaylist(name, description);
      if (!playlist) {
        form.elements.namedItem('name')?.focus();
        return;
      }
      refreshLibrary();
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  },
};
