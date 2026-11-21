import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis; // player timer uses window.setInterval

const player = await import('../src/state/player.js');

const tracks = [1, 2, 3].map((n) => ({ id: `t${n}`, title: `T${n}`, duration: 100 }));

test('playTrack starts the queue and next/previous move the index', () => {
  player.playTrack(tracks, 't1');
  assert.equal(player.getPlayerState().track.id, 't1');
  assert.equal(player.getPlayerState().isPlaying, true);
  player.next();
  assert.equal(player.getPlayerState().index, 1);
  player.previous(); // position <= 3s: goes to previous track
  assert.equal(player.getPlayerState().index, 0);
  player.clear();
});

test('listener added during dispatch does not receive the in-flight event', () => {
  let late = 0;
  let unsubLate = () => {};
  const unsub = player.subscribe(() => { unsubLate = player.subscribe(() => { late += 1; }); });
  player.selectTrack(tracks, 't2');
  assert.equal(late, 0);
  unsub(); unsubLate();
  player.clear();
});

test('a throwing listener does not block others', () => {
  const originalError = console.error;
  console.error = () => {};
  let reached = false;
  const a = player.subscribe(() => { throw new Error('boom'); });
  const b = player.subscribe(() => { reached = true; });
  player.selectTrack(tracks, 't1');
  console.error = originalError;
  a(); b();
  assert.equal(reached, true);
  player.clear();
});

test('shuffle and repeat preferences are exposed in player state', () => {
  player.configurePlayback({ mode: 'simulation' });
  player.playTrack(tracks, 't1');

  assert.equal(player.getPlayerState().shuffleEnabled, false);
  assert.equal(player.getPlayerState().repeatMode, 'off');

  player.setShuffleEnabled(true);
  assert.equal(player.getPlayerState().shuffleEnabled, true);
  assert.equal(player.cycleRepeatMode(), 'track');
  assert.equal(player.getPlayerState().repeatMode, 'track');
  assert.equal(player.cycleRepeatMode(), 'queue');
  assert.equal(player.getPlayerState().repeatMode, 'queue');
  assert.equal(player.cycleRepeatMode(), 'off');
  assert.equal(player.getPlayerState().repeatMode, 'off');

  player.clear();
  assert.equal(player.getPlayerState().shuffleEnabled, true);
  assert.equal(player.getPlayerState().repeatMode, 'off');
  player.setShuffleEnabled(false);
  player.clear();
});

test('queue edits add next, reorder, remove and clear upcoming without losing the current item', () => {
  player.configurePlayback({ mode: 'simulation' });
  player.playTrack(tracks, 't1');
  player.seekRatio(0.42);

  assert.equal(player.enqueueNext(tracks[2]), true);
  let state = player.getPlayerState();
  assert.deepEqual(state.queue.map((track) => track.id), ['t1', 't3', 't2']);
  assert.equal(state.index, 0);
  assert.equal(state.track.id, 't1');
  assert.equal(state.position, 42);

  assert.equal(player.moveQueuedTrack('t2', -1), true);
  state = player.getPlayerState();
  assert.deepEqual(state.queue.map((track) => track.id), ['t1', 't2', 't3']);

  assert.equal(player.removeQueuedTrack('t3'), true);
  assert.deepEqual(player.getPlayerState().queue.map((track) => track.id), ['t1', 't2']);
  assert.equal(player.removeQueuedTrack('t1'), false);
  assert.equal(player.moveQueuedTrack('t1', 1), false);

  assert.equal(player.clearUpcoming(), true);
  state = player.getPlayerState();
  assert.deepEqual(state.queue.map((track) => track.id), ['t1']);
  assert.equal(state.track.id, 't1');
  assert.equal(state.isPlaying, true);
  assert.equal(player.clearUpcoming(), false);
  player.clear();
});

test('seekRatio clamps and toggle pauses/resumes', () => {
  player.selectTrack(tracks, 't1');
  player.seekRatio(5);
  assert.equal(player.getPlayerState().position, 100);
  player.seekRatio(-3);
  assert.equal(player.getPlayerState().position, 0);
  player.seekRatio('nonsense');
  assert.equal(player.getPlayerState().position, 0);
  player.toggle();
  assert.equal(player.getPlayerState().isPlaying, true);
  player.toggle();
  assert.equal(player.getPlayerState().isPlaying, false);
  player.clear();
});
