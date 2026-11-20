import { escapeHtml } from '../utils/dom.js';
import { href } from '../utils/navigation.js';
import { artwork } from './artwork.js';

/**
 * Album tile used in rails and grids. The palette drives a soft, per-album glow
 * behind the artwork instead of a hard border.
 */
export function albumCard(album, { eager = false } = {}) {
  const palette = Array.isArray(album?.palette) ? album.palette : [];
  const style = `--glow-a:${escapeHtml(palette[0] ?? '#A78BFA')};--glow-b:${escapeHtml(palette[1] ?? '#7C6BFF')}`;
  const title = escapeHtml(album?.title ?? 'Untitled album');
  const artist = escapeHtml(album?.artist ?? 'Unknown artist');

  return `<a class="album-card" href="${href(`/albums/${encodeURIComponent(album?.id ?? '')}`)}" style="${style}">
    <span class="album-card__art">${artwork(album, { className: 'album-card__image', eager })}</span>
    <span class="album-card__title">${title}</span>
    <span class="album-card__meta">${artist}</span>
  </a>`;
}
