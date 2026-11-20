/**
 * Development preview gate.
 *
 * The demo library is only used when the URL explicitly carries `?demo=1`.
 * It is intentionally NOT persisted anywhere, so every normal launch shows the
 * real (empty) library. This keeps demonstration content clearly separate from
 * music the user will import later.
 */
const DEMO_PARAM = 'demo';
const DEMO_VALUE = '1';

export function isDemoMode(search = window.location.search) {
  try {
    return new URLSearchParams(search).get(DEMO_PARAM) === DEMO_VALUE;
  } catch {
    return false;
  }
}

/** The URL that enables the preview, preserving the current hash route. */
export function demoPreviewHref(hash = window.location.hash) {
  const route = hash && hash !== '#' ? hash : '#/';
  return `?demo=1${route}`;
}
