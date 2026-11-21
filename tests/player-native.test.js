import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;

const player = await import('../src/state/player.js');

const tracks = [
  { id: 't1', title: 'One', duration: 100 },
  { id: 't2', title: 'Two', duration: 100 },
  { id: 't3', title: 'Three', duration: 100 },
];

function fakeBridge(overrides = {}) {
  let listener = null;
  let eventListener = null;
  const calls = [];
  const bridge = {
    calls,
    setQueue(...args) {
      calls.push(['setQueue', ...args]);
    },
    play() {
      calls.push(['play']);
    },
    pause() {
      calls.push(['pause']);
    },
    stop() {
      calls.push(['stop']);
    },
    seek(positionMs) {
      calls.push(['seek', positionMs]);
    },
    next() {
      calls.push(['next']);
    },
    previous() {
      calls.push(['previous']);
    },
    setShuffleEnabled(enabled) {
      calls.push(['setShuffleEnabled', enabled]);
    },
    setRepeatMode(mode) {
      calls.push(['setRepeatMode', mode]);
    },
    getState: async () => null,
    subscribe(handler) {
      listener = handler;
      return () => {
        listener = null;
      };
    },
    subscribeEvents(handler) {
      eventListener = handler;
      return () => {
        eventListener = null;
      };
    },
    emit(state) {
      if (listener) listener(state);
    },
    emitEvent(event) {
      if (eventListener) eventListener(event);
    },
    hasListener: () => listener !== null,
    ...overrides,
  };
  return bridge;
}

test.afterEach(() => {
  player.clear();
});

test('native playTrack hands the whole queue to the MediaController', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  assert.equal(bridge.hasListener(), true);

  const started = player.playTrack(tracks, 't2');

  assert.equal(started, true);
  assert.equal(player.getPlayerState().engine, 'native');
  assert.equal(player.getPlayerState().track.id, 't2');
  assert.deepEqual(bridge.calls.at(-1).slice(0, 3), ['setQueue', tracks, 1]);
  assert.equal(bridge.calls.at(-1)[3], true);
});

test('service state drives playing, position and duration', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  player.playTrack(tracks, 't1');

  bridge.emit({ trackId: 't1', index: 0, isPlaying: true, positionMs: 12_500, durationMs: 100_000 });
  let state = player.getPlayerState();
  assert.equal(state.isPlaying, true);
  assert.equal(state.position, 12.5);
  assert.equal(state.duration, 100);

  bridge.emit({ trackId: 't1', index: 0, isPlaying: false, positionMs: 40_000, durationMs: 100_000 });
  state = player.getPlayerState();
  assert.equal(state.isPlaying, false);
  assert.equal(state.position, 40);

  bridge.emit({ trackId: 't3', index: 2, isPlaying: true, positionMs: 0, durationMs: 60_000 });
  state = player.getPlayerState();
  assert.equal(state.track.id, 't3');
  assert.equal(state.index, 2);
  assert.equal(state.duration, 60);
});

test('track changes from the notification are emitted as track events', () => {
  const bridge = fakeBridge();
  const events = [];
  player.configurePlayback({ mode: 'native', bridge });
  const unsubscribe = player.subscribe(({ type, state }) => events.push([type, state.track?.id]));
  player.playTrack(tracks, 't1');
  bridge.emit({ trackId: 't2', index: 1, isPlaying: true, positionMs: 0, durationMs: 100_000 });
  unsubscribe();

  assert.ok(events.some(([type, id]) => type === 'track' && id === 't2'));
});

test('play, pause, seek and next are forwarded to the native service', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  player.playTrack(tracks, 't1');

  player.toggle();
  assert.equal(player.getPlayerState().isPlaying, false);
  assert.deepEqual(bridge.calls.at(-1), ['pause']);

  player.toggle();
  assert.equal(player.getPlayerState().isPlaying, true);
  assert.deepEqual(bridge.calls.at(-1), ['play']);

  player.seekRatio(0.5);
  assert.equal(player.getPlayerState().position, 50);
  assert.deepEqual(bridge.calls.at(-1), ['seek', 50_000]);

  player.next();
  assert.deepEqual(bridge.calls.at(-1), ['next']);
  player.previous();
  assert.deepEqual(bridge.calls.at(-1), ['previous']);
});

test('shuffle and repeat modes are forwarded to Media3 bridge', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  player.playTrack(tracks, 't1');

  player.setShuffleEnabled(true);
  player.cycleRepeatMode();
  player.cycleRepeatMode();

  assert.deepEqual(bridge.calls.filter(([name]) => name === 'setShuffleEnabled'), [
    ['setShuffleEnabled', true],
  ]);
  assert.deepEqual(bridge.calls.filter(([name]) => name === 'setRepeatMode'), [
    ['setRepeatMode', 'track'],
    ['setRepeatMode', 'queue'],
  ]);
  assert.equal(player.getPlayerState().shuffleEnabled, true);
  assert.equal(player.getPlayerState().repeatMode, 'queue');
});

test('syncFromNative pulls service state without a playback event', async () => {
  const bridge = fakeBridge({
    getState: async () => ({
      trackId: 't2',
      index: 1,
      isPlaying: true,
      positionMs: 7_000,
      durationMs: 90_000,
    }),
  });
  player.configurePlayback({ mode: 'native', bridge });
  player.playTrack(tracks, 't2');

  player.syncFromNative();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const state = player.getPlayerState();
  assert.equal(state.track.id, 't2');
  assert.equal(state.position, 7);
  assert.equal(state.isPlaying, true);
});

test('a failing native call surfaces a notice instead of throwing', async () => {
  const bridge = fakeBridge({ setQueue: () => Promise.reject(new Error('service down')) });
  const notices = [];
  player.configurePlayback({ mode: 'native', bridge });
  const unsubscribe = player.subscribe(({ type, message }) => {
    if (type === 'notice') notices.push(message);
  });
  const originalError = console.error;
  console.error = () => {};
  player.playTrack(tracks, 't1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  console.error = originalError;
  unsubscribe();

  assert.equal(notices.length, 1);
  assert.match(notices[0], /playback service/i);
});

test('an ExoPlayer failure stops the UI and explains why', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  const notices = [];
  const unsubscribe = player.subscribe(({ type, message }) => {
    if (type === 'notice') notices.push(message);
  });

  player.playTrack(tracks, 't1');
  assert.equal(player.getPlayerState().isPlaying, true);

  bridge.emitEvent({ type: 'error', codeName: 'IO_NO_PERMISSION', message: 'Android can no longer open this file.' });

  assert.equal(player.getPlayerState().isPlaying, false);
  assert.deepEqual(notices, ['Android can no longer open this file.']);
  unsubscribe();
});

test('a rejected setQueue does not leave the UI pretending to play', async () => {
  const bridge = fakeBridge({ setQueue: () => Promise.reject(new Error('service down')) });
  player.configurePlayback({ mode: 'native', bridge });
  const originalError = console.error;
  console.error = () => {};

  player.playTrack(tracks, 't1');
  await new Promise((resolve) => setTimeout(resolve, 0));

  console.error = originalError;
  assert.equal(player.getPlayerState().isPlaying, false);
  assert.equal(player.getPlayerState().track.id, 't1');
});

test('starting native playback asks for nothing else', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  player.playTrack(tracks, 't1');

  // No permission prompt and no extra round trip: the only native call that
  // starting playback makes is the queue itself.
  assert.deepEqual(bridge.calls.map(([name]) => name), ['setQueue']);
  assert.equal(typeof bridge.requestNotificationPermission, 'undefined');
});

test('native playWhenReady and buffering snapshots are applied', () => {
  const bridge = fakeBridge();
  player.configurePlayback({ mode: 'native', bridge });
  player.playTrack(tracks, 't1');

  bridge.emit({
    trackId: 't1',
    playbackState: 'buffering',
    playWhenReady: true,
    isPlaying: false,
    positionMs: 0,
    durationMs: 100_000,
  });

  const state = player.getPlayerState();
  assert.equal(state.isPlaying, false);
  assert.equal(state.duration, 100);
});

test('a browser without native audio explains instead of pretending', () => {
  let notices = [];
  player.configurePlayback({ mode: 'unavailable' });
  const unsubscribe = player.subscribe(({ type, message }) => {
    if (type === 'notice') notices.push(message);
  });

  const started = player.playTrack(tracks, 't1');
  let state = player.getPlayerState();
  assert.equal(started, false);
  assert.equal(state.isPlaying, false);
  assert.equal(state.position, 0);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /Android app/);

  player.toggle();
  assert.equal(notices.length, 2);
  unsubscribe();
});

test('simulation remains available for demo mode', () => {
  player.configurePlayback({ mode: 'simulation' });
  const started = player.playTrack(tracks, 't1');
  assert.equal(started, true);
  assert.equal(player.getPlayerState().engine, 'simulation');
  assert.equal(player.getPlayerState().isPlaying, true);
  player.toggle();
  assert.equal(player.getPlayerState().isPlaying, false);
});
