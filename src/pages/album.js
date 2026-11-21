import { escapeHtml } from '../utils/dom.js';
import { glowStyle } from '../utils/safe.js';
import { href } from '../utils/navigation.js';
import { formatRuntime, pluralise, totalDuration } from '../utils/format.js';
import { findAlbum } from '../data/library.js';
import { artwork } from '../components/artwork.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';
import { songRow } from '../components/song-row.js';

export const albumPage = {
  title: 'Album',
  render(state, route) {
    const album = findAlbum(state.library, route.id);

    if (!album) {
      return `<div class="screen">
        <a class="back-link" href="${href('/library/albums')}">${icon('arrowLeft', { size: 16 })} All albums</a>
        <header class="screen-head">
          <h1 class="screen-head__title" tabindex="-1">Album not found</h1>
        </header>
        ${emptyState({
          iconName: 'info',
          title: 'This album is not here',
          description: 'It may have been removed, or the link is out of date.',
          action: `<a class="button button--ghost" href="${href('/library/albums')}">Back to albums</a>`,
        })}
      </div>`;
    }

    const runtime = formatRuntime(totalDuration(album.tracks));

    return `<div class="screen screen--album">
      <a class="back-link" href="${href('/library/albums')}">${icon('arrowLeft', { size: 16 })} All albums</a>

      <header class="album-hero" style="${glowStyle(album.palette)}">
        <div class="album-hero__art">
          ${artwork(album, { className: 'album-hero__image', eager: true, alt: `Artwork for ${album.title}` })}
        </div>
        <div class="album-hero__body">
          <p class="eyebrow">Album</p>
          <h1 class="album-hero__title" tabindex="-1">${escapeHtml(album.title)}</h1>
          <p class="album-hero__artist">${escapeHtml(album.artist)}</p>
          <p class="album-hero__meta">${escapeHtml(album.year)} · ${pluralise(album.tracks.length, 'track')} · ${runtime}</p>
          <button class="button button--primary" type="button" data-action="play-album" data-album-id="${escapeHtml(album.id)}" aria-label="Play ${escapeHtml(album.title)} (UI preview)">
            ${icon('play', { size: 16 })} Play album
          </button>
        </div>
      </header>

      <ul class="song-list" data-queue="album-tracks">
        ${album.tracks.map((track) => songRow(track, { number: track.trackNumber, showArtwork: false, showUtilities: !state.demo })).join('')}
      </ul>
    </div>`;
  },
};
