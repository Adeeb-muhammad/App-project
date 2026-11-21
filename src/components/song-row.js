import { escapeHtml } from '../utils/dom.js';
import { formatTime } from '../utils/format.js';
import { artwork } from './artwork.js';
import { icon } from './icon.js';

/** A playable track row with independent personal-library actions. */
export function songRow(track, { number = null, showArtwork = true, playlistId = null } = {}) {
  const title = escapeHtml(track.title);
  const artist = escapeHtml(track.artist);
  const album = escapeHtml(track.albumTitle);
  const label = `Play ${track.title} by ${track.artist}`;
  const favourite = Boolean(track.isFavourite);
  const removeAction = playlistId && playlistId !== 'liked-songs'
    ? `<button class="song-row__utility" type="button" data-action="remove-from-playlist" data-track-id="${escapeHtml(track.id)}" data-playlist-id="${escapeHtml(playlistId)}" aria-label="Remove ${title} from playlist" title="Remove from playlist">−</button>`
    : '';

  return `<li class="song-row-item">
    <button class="song-row" type="button" data-action="play-track" data-track-id="${escapeHtml(track.id)}" aria-label="${escapeHtml(label)}">
      ${number !== null
        ? `<span class="song-row__number" aria-hidden="true">${String(number).padStart(2, '0')}</span>`
        : ''}
      ${showArtwork ? artwork(track, { className: 'song-row__art' }) : ''}
      <span class="song-row__text">
        <span class="song-row__title">${title}</span>
        <span class="song-row__meta">${artist} · ${album}</span>
      </span>
      <span class="song-row__duration">${formatTime(track.duration)}</span>
      <span class="song-row__play" aria-hidden="true">${icon('play', { size: 15 })}</span>
    </button>
    <div class="song-row__utilities">
      <button class="song-row__utility${favourite ? ' is-active' : ''}" type="button"
        data-action="toggle-favourite" data-track-id="${escapeHtml(track.id)}"
        aria-label="${favourite ? 'Remove from' : 'Add to'} Liked Songs" aria-pressed="${favourite}"
        title="${favourite ? 'Remove from Liked Songs' : 'Add to Liked Songs'}">${favourite ? '♥' : '♡'}</button>
      <button class="song-row__utility" type="button" data-action="add-to-playlist"
        data-track-id="${escapeHtml(track.id)}" aria-label="Add ${title} to a playlist"
        title="Add to playlist">＋</button>
      ${removeAction}
    </div>
  </li>`;
}
