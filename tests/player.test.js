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
