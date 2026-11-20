/**
 * Transport state for the prototype.
 *
 * IMPORTANT: this module does NOT play audio. It is a UI simulation used by the
 * demo preview so the controls, progress bar and queue can be reviewed. On a
 * real device, playback will be provided by AndroidX Media3 / ExoPlayer through
 * a MediaSessionService exposed over a Capacitor plugin (see
 * docs/ARCHITECTURE.md). Screens only talk to this module's small API, so that
 * native source can replace the simulation without redesigning the UI.
 */

const TICK_MS = 250;
const listeners = new Set();

let state = {
  track: null,
  queue: [],
  index: -1,
  isPlaying: false,
  position: 0,
  duration: 0,
};

let timer = null;

function snapshot() {
  return {
    track: state.track,
    queue: state.queue.slice(),
    index: state.index,
    isPlaying: state.isPlaying,
    position: state.position,
    duration: state.duration,
  };
}

function emit(type) {
  const detail = { type, state: snapshot() };
  // Iterate over a snapshot: a listener may re-render the active screen and
  // subscribe a fresh listener while this event is still being dispatched.
  for (const listener of [...listeners]) {
    try {
      listener(detail);
    } catch (error) {
      console.error('[player] listener failed', error);
    }
  }
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  if (!state.isPlaying || !state.track) return;
  timer = window.setInterval(() => {
    if (!state.isPlaying || !state.track) return;
    const next = state.position + TICK_MS / 1000;
    if (next >= state.duration) {
      step(1, { automatic: true });
      return;
    }
    state.position = next;
    emit('progress');
  }, TICK_MS);
}

function setIndex(index, { autoplay = true } = {}) {
  const track = state.queue[index] ?? null;
  state.index = track ? index : -1;
  state.track = track;
  state.position = 0;
  state.duration = track ? track.duration : 0;
  state.isPlaying = Boolean(track) && autoplay;
  if (state.isPlaying) startTimer();
  else stopTimer();
  emit('track');
}

function step(direction, { automatic = false } = {}) {
  if (state.queue.length === 0) return;

  if (direction < 0 && state.position > 3) {
    state.position = 0;
    emit('progress');
    return;
  }

  const nextIndex = state.index + direction;
  if (nextIndex < 0) {
    state.position = 0;
    emit('progress');
    return;
  }
  if (nextIndex >= state.queue.length) {
    if (automatic) {
      state.isPlaying = false;
      state.position = state.duration;
      stopTimer();
      emit('state');
    }
    return;
  }
  setIndex(nextIndex, { autoplay: true });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlayerState() {
  return snapshot();
}

/** Starts a queue at the given track. `tracks` are library track objects. */
export function playTrack(tracks, trackId) {
  const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
  const index = list.findIndex((track) => track.id === trackId);
  if (index === -1) return;
  state.queue = list;
  setIndex(index, { autoplay: true });
}

/** Selects a track without starting the simulated clock (album "open"). */
export function selectTrack(tracks, trackId) {
  const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
  const index = list.findIndex((track) => track.id === trackId);
  if (index === -1) return;
  state.queue = list;
  setIndex(index, { autoplay: false });
}

export function toggle() {
  if (!state.track) return;
  if (state.position >= state.duration) state.position = 0;
  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) startTimer();
  else stopTimer();
  emit('state');
}

export function next() {
  step(1);
}

export function previous() {
  step(-1);
}

export function seekRatio(ratio) {
  if (!state.track) return;
  const clamped = Math.min(Math.max(Number(ratio) || 0, 0), 1);
  state.position = clamped * state.duration;
  emit('progress');
}

export function clear() {
  stopTimer();
  state = { track: null, queue: [], index: -1, isPlaying: false, position: 0, duration: 0 };
  emit('track');
}
