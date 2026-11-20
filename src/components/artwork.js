import { escapeHtml } from '../utils/dom.js';
import { artStyle, safeImageSrc } from '../utils/safe.js';

/**
 * Renders artwork for an album/track/playlist. When a record has no artwork the
 * component degrades to a deterministic gradient tile with an initial, so
 * missing art never breaks a layout.
 */
export function artwork(media, { className = '', alt = '', eager = false } = {}) {
  const style = artStyle(media?.palette);
  const src = safeImageSrc(media?.artwork);
  if (src) {
    return `<img class="artwork ${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${style}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
  }
  // Array.from keeps surrogate pairs (emoji, CJK extensions) intact; charAt(0) would not.
  const initial = escapeHtml(Array.from(String(media?.title ?? media?.name ?? '?').trim())[0]?.toUpperCase() || '?');
  return `<span class="artwork artwork--fallback ${className}" style="${style}" aria-hidden="true">${initial}</span>`;
}
