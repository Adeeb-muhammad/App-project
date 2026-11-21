/**
 * Playback boundary.
 *
 * Three engines share one API:
 *
 * - `simulation` — the demo preview (`?demo=1`) and the default in Node tests.
 *   It advances a clock; it never decodes audio and says so in the UI.
 * - `native` — AndroidX Media3 through `CinematicAudioPlugin`. The
 *   `MediaSessionService` owns playback, so the UI is a projection of native
 *   state and keeps working when the WebView is backgrounded.
 * - `unavailable` — a real browser without Capacitor. Selecting a track is
 *   allowed, but pressing play explains that Android is required instead of
 *   pretending audio is playing.
 *
 * Screens only use this module, so the engine can change without touching a
 * page. The listener-dispatch snapshot rule from Milestone 1 still applies.
 */

const TICK_MS = 250;
const listeners = new Set();

let engine = 'simulation';
let bridge = null;
let bridgeUnsubscribe = null;
let bridgeEventsUnsubscribe = null;

let state = {
  track: null,
  queue: [],
  index: -1,
  isPlaying: false,
  position: 0,
  duration: 0,
  shuffleEnabled: false,
  repeatMode: 'off',
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
    shuffleEnabled: state.shuffleEnabled,
    repeatMode: state.repeatMode,
    engine,
  };
}

function emit(type, extra = {}) {
  const detail = { type, state: snapshot(), ...extra };
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

function notify(message) {
  if (!message) return;
  emit('notice', { message });
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

  // Repeat-one only changes automatic end-of-track behaviour. A manual
  // Next/Previous press still moves through the queue.
  if (automatic && state.repeatMode === 'track') {
    state.position = 0;
    emit('progress');
    return;
  }

  if (direction < 0 && state.position > 3) {
    state.position = 0;
    emit('progress');
    return;
  }

  let nextIndex;
  if (direction > 0 && state.shuffleEnabled && state.queue.length > 1) {
    const candidates = state.queue.map((_, index) => index).filter((index) => index !== state.index);
    nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    nextIndex = state.index + direction;
  }

  if (nextIndex < 0) {
    if (state.repeatMode === 'queue') nextIndex = state.queue.length - 1;
    else {
      state.position = 0;
      emit('progress');
      return;
    }
  }

  if (nextIndex >= state.queue.length) {
    if (state.repeatMode === 'queue') nextIndex = 0;
    else {
      if (automatic) {
        state.isPlaying = false;
        state.position = state.duration;
        stopTimer();
        emit('state');
      }
      return;
    }
  }

  setIndex(nextIndex, { autoplay: true });
}

/**
 * Native call that resolves to `true` when the service accepted it. Failures
 * surface as a notice and as `false`, so callers can undo optimistic state
 * instead of leaving the UI claiming to play.
 */
function invoke(method, args = []) {
  if (!bridge || typeof bridge[method] !== 'function') return Promise.resolve(false);
  try {
    return Promise.resolve(bridge[method](...args)).then(
      () => true,
      (error) => {
        console.error(`[player] native ${method} failed`, error);
        notify('The playback service could not be reached. Try again.');
        return false;
      },
    );
  } catch (error) {
    console.error(`[player] native ${method} failed`, error);
    notify('The playback service could not be reached. Try again.');
    return Promise.resolve(false);
  }
}

/** Errors pushed by the native service. */
function handleNativeEvent(event) {
  if (engine !== 'native' || !event) return;
  if (event.type !== 'error') return;
  // ExoPlayer is the source of truth: it stopped, so the UI must stop too.
  if (state.track) state.isPlaying = false;
  stopTimer();
  emit('state');
  notify(event.message || 'Playback stopped unexpectedly. Try the track again.');
}

function handleNativeState(native) {
  if (engine !== 'native' || !native || typeof native !== 'object') return;
  // The service can outlive the WebView. Without a JS queue there is nothing to
  // map a media id onto, so ignore stale state instead of inventing a track.
  if (state.queue.length === 0) return;

  const previousId = state.track?.id ?? null;
  const previousPlaying = state.isPlaying;

  let index = state.queue.findIndex((track) => track.id === native.trackId);
  if (index === -1 && Number.isInteger(native.index) && native.index >= 0 && native.index < state.queue.length) {
    index = native.index;
  }
  if (index !== -1) {
    state.index = index;
    state.track = state.queue[index];
  }

  const positionMs = Number(native.positionMs);
  if (Number.isFinite(positionMs) && positionMs >= 0) state.position = positionMs / 1000;

  const durationMs = Number(native.durationMs);
  if (Number.isFinite(durationMs) && durationMs > 0) state.duration = durationMs / 1000;
  else if (state.track) state.duration = state.track.duration ?? state.duration;

  state.isPlaying = Boolean(native.isPlaying);

  const trackChanged = (state.track?.id ?? null) !== previousId;
  const playingChanged = state.isPlaying !== previousPlaying;
  emit(trackChanged || playingChanged ? 'track' : 'progress');
}

/**
 * Chooses the engine. Called once from `main.js` before the shell mounts.
 * Tests call it directly with a fake bridge.
 */
export function configurePlayback({ mode = 'simulation', bridge: nextBridge = null } = {}) {
  stopTimer();
  if (typeof bridgeUnsubscribe === 'function') bridgeUnsubscribe();
  bridgeUnsubscribe = null;
  if (typeof bridgeEventsUnsubscribe === 'function') bridgeEventsUnsubscribe();
  bridgeEventsUnsubscribe = null;

  // Native mode without a bridge would silently pretend to play; degrade to
  // the honest browser state instead.
  engine = mode === 'native' && !nextBridge ? 'unavailable' : mode;
  bridge = engine === 'native' ? nextBridge : null;

  if (engine === 'native' && bridge) {
    bridgeUnsubscribe = bridge.subscribe(handleNativeState);
    bridgeEventsUnsubscribe = bridge.subscribeEvents?.(handleNativeEvent) ?? null;
    // The service may already be playing (e.g. WebView recreated while audio
    // continued), so pull the authoritative state once instead of assuming.
    Promise.resolve(bridge.getState?.())
      .then(handleNativeState)
      .catch(() => {});
  }

  emit('state');
}

/** Re-reads native state after the app returns to the foreground. */
export function syncFromNative() {
  if (engine !== 'native' || !bridge) return;
  Promise.resolve(bridge.getState?.())
    .then(handleNativeState)
    .catch((error) => console.warn('[player] could not read native state', error));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlayerState() {
  return snapshot();
}

export function getPlaybackEngine() {
  return engine;
}

/** Starts a queue at the given track. `tracks` are library track objects. */
export function playTrack(tracks, trackId, { autoplay = true } = {}) {
  const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
  const index = list.findIndex((track) => track.id === trackId);
  if (index === -1) return false;

  state.queue = list;
  state.index = index;
  state.track = list[index];
  state.position = 0;
  state.duration = list[index].duration ?? 0;

  if (engine === 'unavailable') {
    state.isPlaying = false;
    stopTimer();
    emit('track');
    notify('Playback requires the Android app. This browser preview cannot play local audio.');
    return false;
  }

  if (engine === 'native') {
    // Optimistic, corrected by the first MediaController event. If the service
    // rejects the queue the optimistic state is rolled back below.
    const startedTrackId = list[index].id;
    state.isPlaying = autoplay;
    stopTimer();
    emit('track');
    invoke('setQueue', [list, index, autoplay]).then((accepted) => {
      if (!accepted && state.track?.id === startedTrackId) {
        state.isPlaying = false;
        emit('state');
      }
    });
    return true;
  }

  state.isPlaying = autoplay;
  if (autoplay) startTimer();
  else stopTimer();
  emit('track');
  return true;
}

/** Selects a track without starting playback (used when opening an album). */
export function selectTrack(tracks, trackId) {
  return playTrack(tracks, trackId, { autoplay: false });
}

export function toggle() {
  if (!state.track) return;

  if (engine === 'unavailable') {
    notify('Playback requires the Android app. This browser preview cannot play local audio.');
    return;
  }

  if (engine === 'native') {
    const desired = !state.isPlaying;
    state.isPlaying = desired;
    emit('state');
    invoke(desired ? 'play' : 'pause').then((accepted) => {
      if (!accepted) {
        state.isPlaying = !desired;
        emit('state');
      }
    });
    return;
  }

  if (state.position >= state.duration) state.position = 0;
  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) startTimer();
  else stopTimer();
  emit('state');
}

export function next() {
  if (engine === 'native') {
    invoke('next');
    return;
  }
  step(1);
}

export function previous() {
  if (engine === 'native') {
    invoke('previous');
    return;
  }
  step(-1);
}

/**
 * Commit a queue edit while retaining the active track, playback state and
 * position. The Android service remains the playback source of truth.
 */
function commitQueueEdit(queue, index) {
  if (!Array.isArray(queue) || queue.length === 0) return false;
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), queue.length - 1);
  const previous = { ...state, queue: state.queue.slice() };
  const previousTrackId = state.track?.id ?? null;
  const track = queue[safeIndex];
  const trackChanged = track?.id !== previousTrackId;

  state.queue = queue;
  state.index = safeIndex;
  state.track = track;
  state.duration = Number(track.duration) || 0;
  state.position = trackChanged
    ? 0
    : Math.min(state.position, state.duration || state.position);

  // Media3's shuffled navigation order is independent of the visible queue
  // order. Turn shuffle off while editing so move/remove/clear match what plays.
  if (state.shuffleEnabled) {
    setShuffleEnabled(false);
    notify('Shuffle turned off so your edited queue plays in the order shown.');
  }

  const queueSnapshot = queue;
  if (engine === 'native') {
    invoke('setQueue', [queue, safeIndex, state.isPlaying, state.position * 1000]).then((accepted) => {
      if (!accepted && state.queue === queueSnapshot) {
        state = previous;
        emit(trackChanged ? 'track' : 'queue');
      }
    });
  } else if (state.isPlaying) {
    startTimer();
  } else {
    stopTimer();
  }

  emit(trackChanged ? 'track' : 'queue');
  return true;
}

/** Insert a library track immediately after the current item. */
export function enqueueNext(track) {
  if (!track || typeof track.id !== 'string' || !track.id) return false;
  if (!state.track || state.index < 0 || state.queue.length === 0) {
    return playTrack([track], track.id);
  }
  if (track.id === state.track.id) return false;

  const queue = state.queue.slice();
  const existingIndex = queue.findIndex((item) => item.id === track.id);
  if (existingIndex === state.index + 1) return false;
  if (existingIndex >= 0) queue.splice(existingIndex, 1);

  const currentIndex = queue.findIndex((item) => item.id === state.track.id);
  if (currentIndex < 0) return false;
  queue.splice(currentIndex + 1, 0, track);

  // Media3's shuffle order can otherwise skip a deliberately pinned next
  // track. Turn shuffle off for this explicit "Play next" action.
  if (state.shuffleEnabled) {
    setShuffleEnabled(false);
    notify('Shuffle turned off so this track plays next.');
  }
  return commitQueueEdit(queue, currentIndex);
}

/** Remove an upcoming item; the active and already-played items are protected. */
export function removeQueuedTrack(trackId) {
  const index = state.queue.findIndex((item) => item.id === trackId);
  if (index <= state.index || index < 0) return false;
  const queue = state.queue.slice();
  queue.splice(index, 1);
  return commitQueueEdit(queue, state.index);
}

/** Move an upcoming item one place up (-1) or down (+1). */
export function moveQueuedTrack(trackId, direction) {
  const index = state.queue.findIndex((item) => item.id === trackId);
  const delta = Number(direction);
  const target = index + (delta < 0 ? -1 : delta > 0 ? 1 : 0);
  if (index <= state.index || index < 0 || (delta !== -1 && delta !== 1)) return false;
  if (target <= state.index || target >= state.queue.length) return false;

  const queue = state.queue.slice();
  [queue[index], queue[target]] = [queue[target], queue[index]];
  return commitQueueEdit(queue, state.index);
}

/** Remove every upcoming item while leaving the current track playing. */
export function clearUpcoming() {
  if (state.index < 0 || state.queue.length <= state.index + 1) return false;
  return commitQueueEdit(state.queue.slice(0, state.index + 1), state.index);
}

/** Enables/disables queue shuffling in the active playback engine. */
export function setShuffleEnabled(enabled) {
  const nextValue = Boolean(enabled);
  if (state.shuffleEnabled === nextValue) return;
  state.shuffleEnabled = nextValue;
  if (engine === 'native') invoke('setShuffleEnabled', [nextValue]);
  emit('state');
}

/** Cycles repeat behaviour: off → current track → whole queue → off. */
export function cycleRepeatMode() {
  const nextMode = {
    off: 'track',
    track: 'queue',
    queue: 'off',
  }[state.repeatMode] ?? 'off';
  state.repeatMode = nextMode;
  if (engine === 'native') invoke('setRepeatMode', [nextMode]);
  emit('state');
  return nextMode;
}

export function seekRatio(ratio) {
  if (!state.track) return;
  const clamped = Math.min(Math.max(Number(ratio) || 0, 0), 1);
  state.position = clamped * state.duration;
  if (engine === 'native') invoke('seek', [state.position * 1000]);
  emit('progress');
}

export function clear() {
  stopTimer();
  if (engine === 'native') invoke('stop');
  state = {
    track: null,
    queue: [],
    index: -1,
    isPlaying: false,
    position: 0,
    duration: 0,
    // Playback preferences survive stopping the current queue.
    shuffleEnabled: state.shuffleEnabled,
    repeatMode: state.repeatMode,
  };
  emit('track');
}
