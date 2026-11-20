import { escapeHtml } from '../utils/dom.js';

const FALLBACK_PALETTE = ['#A78BFA', '#7C6BFF', '#191B25'];

function paletteStyle(media) {
  const palette = Array.isArray(media?.palette) && media.palette.length >= 3
    ? media.palette
    : FALLBACK_PALETTE;
  return `--art-1:${escapeHtml(palette[0])};--art-2:${escapeHtml(palette[1])};--art-3:${escapeHtml(palette[2])}`;
}

/**
 * Renders artwork for an album/track/playlist. When a record has no artwork the
 * component degrades to a deterministic gradient tile with an initial, so
 * missing art never breaks a layout.
 */
export function artwork(media, { className = '', alt = '', eager = false } = {}) {
  const style = paletteStyle(media);
  if (media?.artwork) {
    return `<img class="artwork ${className}" src="${escapeHtml(media.artwork)}" alt="${escapeHtml(alt)}" style="${style}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
  }
  const initial = escapeHtml((media?.title ?? media?.name ?? '?').trim().charAt(0).toUpperCase() || '?');
  return `<span class="artwork artwork--fallback ${className}" style="${style}" aria-hidden="true">${initial}</span>`;
}
