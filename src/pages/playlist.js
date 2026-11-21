import { escapeHtml } from '../utils/dom.js';
import { glowStyle } from '../utils/safe.js';
import { href } from '../utils/navigation.js';
import { formatRuntime, pluralise } from '../utils/format.js';
import { refreshLibrary } from '../state/store.js';
import { renamePlaylist } from '../data/personal-library.js';
import { findPlaylist } from '../data/library.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';
import { songRow } from '../components/song-row.js';

export const playlistPage = {
  title: 'Playlist',
  render(state, route) {
    const playlist = findPlaylist(state.library, route.id);

    if (!playlist) {
      return `<div class="screen">
        <a class="back-link" href="${href('/playlists')}">${icon('arrowLeft', { size: 16 })} All playlists</a>
        <header class="screen-head">
          <h1 class="screen-head__title" tabindex="-1">Playlist not found</h1>
        </header>
        ${emptyState({
          iconName: 'info',
          title: 'This playlist is not here',
          description: 'The link may be old, or the playlist has been deleted.',
          action: `<a class="button button--ghost" href="${href('/playlists')}">Back to playlists</a>`,
        })}
      </div>`;
    }

    return `<div class="screen screen--playlist">
      <a class="back-link" href="${href('/playlists')}">${icon('arrowLeft', { size: 16 })} All playlists</a>

      <header class="collection-hero" style="${glowStyle(playlist.palette)}">
        <span class="collection-hero__cover" aria-hidden="true">
          <span class="collection-hero__ring"></span>
          ${icon('playlists', { size: 30 })}
        </span>
        <div class="collection-hero__body">
          <p class="eyebrow">${playlist.isSystem ? 'Your collection' : 'Your playlist'}</p>
          <h1 class="collection-hero__title" tabindex="-1">${escapeHtml(playlist.name)}</h1>
          <p class="collection-hero__meta">${pluralise(playlist.trackCount, 'track')} · ${formatRuntime(playlist.duration)}</p>
          <p class="collection-hero__description">${escapeHtml(playlist.description)}</p>
          ${playlist.tracks.length
            ? `<button class="button button--primary" type="button" data-action="play-playlist" data-playlist-id="${escapeHtml(playlist.id)}">
                ${icon('play', { size: 16 })} Play playlist
              </button>`
            : ''}
        </div>
      </header>

      ${state.demo || playlist.isSystem ? '' : `<form class="playlist-edit" data-role="rename-playlist-form" data-playlist-id="${escapeHtml(playlist.id)}">
        <label class="sr-only" for="edit-playlist-name">Playlist name</label>
        <input id="edit-playlist-name" name="name" class="search__input" maxlength="40" required value="${escapeHtml(playlist.name)}" />
        <label class="sr-only" for="edit-playlist-description">Playlist description</label>
        <input id="edit-playlist-description" name="description" class="search__input" maxlength="180" value="${escapeHtml(playlist.description)}" placeholder="Description" />
        <button class="button button--ghost button--small" type="submit">Save details</button>
        <a class="button button--ghost button--small" href="${href('/library/songs')}">Add songs</a>
      </form>`}

      ${playlist.tracks.length
        ? `<ul class="song-list" data-queue="playlist-tracks">
            ${playlist.tracks.map((track, index) => songRow(track, { number: index + 1, playlistId: playlist.id, showUtilities: !state.demo })).join('')}
          </ul>`
        : emptyState({
            iconName: 'music',
            title: 'This playlist is empty',
            description: playlist.isSystem
              ? 'Like songs in your library and they will appear here automatically.'
              : 'Add songs from your library to start building this playlist.',
            action: `<a class="button button--ghost" href="${href('/library/songs')}">Browse the library</a>`,
          })}
    </div>`;
  },

  mount(root) {
    const form = root.querySelector('[data-role="rename-playlist-form"]');
    if (!form) return undefined;
    const onSubmit = (event) => {
      event.preventDefault();
      const id = form.dataset.playlistId;
      const name = form.elements.namedItem('name')?.value ?? '';
      const description = form.elements.namedItem('description')?.value ?? '';
      if (!renamePlaylist(id, name, description)) {
        form.elements.namedItem('name')?.focus();
        return;
      }
      refreshLibrary();
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  },
};
