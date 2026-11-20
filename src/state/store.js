import { buildDemoLibrary, buildEmptyLibrary } from '../data/library.js';
import { buildImportedLibrary, loadImportedTracks } from '../data/imported.js';

/**
 * Minimal observable store. Pages receive an immutable snapshot and the shell
 * re-renders the active route when the store changes.
 */

const listeners = new Set();

let state = {
  demo: false,
  library: buildEmptyLibrary(),
  ui: {
    libraryTab: 'songs',
    search: '',
  },
};

export function getState() {
  return state;
}

function emit() {
  // Dispatch over a snapshot so a listener that subscribes (or unsubscribes)
  // during dispatch neither receives the in-flight event nor skips a peer.
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch (error) {
      console.error('[store] listener failed', error);
    }
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * `notify: false` is used for high-frequency input state (the library search)
 * where the page updates its own results container instead of re-rendering.
 */
export function setState(patch, { notify = true } = {}) {
  state = { ...state, ...patch };
  if (notify) emit();
}

export function setUi(patch, options) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  if (options?.notify !== false) emit();
}

export function initStore({ demo }) {
  state = {
    ...state,
    demo,
    library: demo ? buildDemoLibrary() : buildImportedLibrary(loadImportedTracks()),
  };
  emit();
}

/** Rebuilds the real library after an import. Demo data stays isolated. */
export function refreshLibrary() {
  if (state.demo) return;
  state = { ...state, library: buildImportedLibrary(loadImportedTracks()) };
  emit();
}

export function getLibraryState() {
  return state.library;
}
