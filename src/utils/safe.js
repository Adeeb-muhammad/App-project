/**
 * Data-boundary helpers for values that end up inside CSS or URL attributes.
 *
 * `escapeHtml` stops attribute breakout but does not stop CSS injection
 * (e.g. `red;background:url(//host)`), so anything placed in a style attribute
 * must be validated here first. Imported metadata is untrusted input.
 */

const DEFAULT_PALETTE = ['#A78BFA', '#7C6BFF', '#191B25'];

const HEX_COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Returns the colour if it is a plain hex colour, otherwise the fallback. */
export function safeColour(value, fallback) {
  return typeof value === 'string' && HEX_COLOUR.test(value.trim()) ? value.trim() : fallback;
}

/** Normalises any palette-like value to exactly three safe colours. */
export function safePalette(palette) {
  const source = Array.isArray(palette) ? palette : [];
  return DEFAULT_PALETTE.map((fallback, index) => safeColour(source[index], fallback));
}

/** `--art-*` custom properties for artwork and the Now Playing screen. */
export function artStyle(palette) {
  const [a, b, c] = safePalette(palette);
  return `--art-1:${a};--art-2:${b};--art-3:${c}`;
}

/** `--glow-*` custom properties for hero and card glows. */
export function glowStyle(palette) {
  const [a, b] = safePalette(palette);
  return `--glow-a:${a};--glow-b:${b}`;
}

/**
 * Accepts only image sources the app can legitimately load offline:
 * same-origin relative paths, blob: URLs and raster data: URLs.
 * Anything else (remote hosts, javascript:, protocol-relative, SVG data) is
 * rejected so artwork can never trigger a network request.
 *
 * Note for the future importer: Capacitor.convertFileSrc() returns
 * `https://localhost/_capacitor_file_/...` URLs, which this function rejects on
 * purpose. When local-file artwork is added, allow exactly that origin+prefix
 * here (and add a test) rather than loosening the scheme check.
 */
export function safeImageSrc(value) {
  if (typeof value !== 'string') return null;
  const src = value.trim();
  if (!src || /[\u0000-\u001f\u007f]/.test(src)) return null;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) return src;
  if (/^blob:/i.test(src)) return src;
  if (src.startsWith('//') || src.includes('\\')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null;
  return src;
}
