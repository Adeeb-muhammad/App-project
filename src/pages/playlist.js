import { escapeHtml } from '../utils/dom.js';
import { glowStyle } from '../utils/safe.js';
import { href } from '../utils/navigation.js';
import { formatRuntime, pluralise } from '../utils/format.js';
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
          description: 'The link may be old, or the playlist has not been created yet.',
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
          <p class="eyebrow">Playlist</p>
          <h1 class="collection-hero__title" tabindex="-1">${escapeHtml(playlist.name)}</h1>
          <p class="collection-hero__meta">${pluralise(playlist.trackCount, 'track')} · ${formatRuntime(playlist.duration)}</p>
          <p class="collection-hero__description">${escapeHtml(playlist.description)}</p>
          ${playlist.tracks.length
            ? `<button class="button button--primary" type="button" data-action="play-playlist" data-playlist-id="${escapeHtml(playlist.id)}" aria-label="Play ${escapeHtml(playlist.name)} (UI preview)">
                ${icon('play', { size: 16 })} Play playlist
              </button>`
            : ''}
        </div>
      </header>

      ${playlist.tracks.length
        ? `<ul class="song-list" data-queue="playlist-tracks">
            ${playlist.tracks.map((track, index) => songRow(track, { number: index + 1 })).join('')}
          </ul>`
        : emptyState({
            iconName: 'music',
            title: 'This playlist is empty',
            description: 'Add tracks once playlist editing is available. Nothing here is pretend music.',
          })}
    </div>`;
  },
};
