import { escapeHtml } from '../utils/dom.js';
import { formatTime } from '../utils/format.js';
import { artwork } from './artwork.js';
import { icon } from './icon.js';

/**
 * A song row is a single button: the whole row is the play target, which keeps
 * touch, mouse and keyboard behaviour identical. Whether audio is simulated or
 * native is stated on the Now Playing screen, where the engine is known.
 */
export function songRow(track, { number = null, showArtwork = true } = {}) {
  const title = escapeHtml(track.title);
  const artist = escapeHtml(track.artist);
  const album = escapeHtml(track.albumTitle);
  const label = `Play ${track.title} by ${track.artist}`;

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
  </li>`;
}
