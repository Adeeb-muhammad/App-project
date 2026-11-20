import { escapeHtml } from '../utils/dom.js';
import { artwork } from './artwork.js';
import { icon } from './icon.js';

/**
 * Persistent mini-player. It only renders when a preview track is selected; in
 * the real (empty) library it stays out of the way entirely.
 */
export function miniPlayer(playerState) {
  const { track, isPlaying, position, duration } = playerState;
  if (!track) return '';

  const percent = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const title = escapeHtml(track.title);
  const artist = escapeHtml(track.artist);

  return `<div class="mini-player" data-role="mini-player" aria-label="Mini player">
    <a class="mini-player__open" href="#/now-playing" aria-label="Open Now Playing: ${title} by ${artist}">
      ${artwork(track, { className: 'mini-player__art' })}
      <span class="mini-player__text">
        <span class="mini-player__title">${title}</span>
        <span class="mini-player__artist">${artist}</span>
      </span>
    </a>
    <button class="mini-player__toggle" type="button" data-action="toggle-play" aria-label="${isPlaying ? 'Pause' : 'Play'}">
      ${icon(isPlaying ? 'pause' : 'play', { size: 18 })}
    </button>
    <span class="mini-player__progress" aria-hidden="true">
      <span class="mini-player__progress-bar" data-role="mini-progress" style="width:${percent.toFixed(2)}%"></span>
    </span>
  </div>`;
}
