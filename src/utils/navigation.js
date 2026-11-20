/**
 * Hash-based router.
 *
 * Hash routing is deliberate: the app runs from a Capacitor WebView and from a
 * plain static Vite server, neither of which should need URL rewrite rules.
 * It also keeps Android hardware back / browser back working for free.
 */

export const LIBRARY_TABS = ['songs', 'albums', 'artists'];

function normaliseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const path = raw.length > 0 ? (raw.startsWith('/') ? raw : `/${raw}`) : '/';
  return path.replace(/\/+$/, '') || '/';
}

/**
 * Decodes one route parameter. Malformed escapes (e.g. `%E0%A4%A`) make
 * decodeURIComponent throw; treat those as an invalid route instead of
 * crashing the renderer.
 */
function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseRoute(hash = window.location.hash) {
  const path = normaliseHash(hash);
  const segments = path.split('/').filter(Boolean);
  const [first, second] = segments;

  if (!first) return { name: 'home', path: '/', segments };

  switch (first) {
    case 'library': {
      const tab = LIBRARY_TABS.includes(second) ? second : 'songs';
      return { name: 'library', tab, path: `/library/${tab}`, segments };
    }
    case 'playlists': {
      if (!second) return { name: 'playlists', path, segments };
      const id = decodeParam(second);
      return id === null ? { name: 'notFound', path, segments } : { name: 'playlist', id, path, segments };
    }
    case 'albums': {
      const id = second ? decodeParam(second) : null;
      return id === null ? { name: 'notFound', path, segments } : { name: 'album', id, path, segments };
    }
    case 'now-playing':
      return { name: 'player', path, segments };
    case 'settings':
      return { name: 'settings', path, segments };
    default:
      return { name: 'notFound', path, segments };
  }
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) return;
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function goBack(fallback = '/') {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate(fallback);
  }
}

export function subscribe(handler) {
  const listener = () => handler(parseRoute());
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/** Every internal link points at a real anchor so keyboard and middle-click work. */
export function href(path) {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}
