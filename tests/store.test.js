import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribe, setState, setUi, getState } from '../src/state/store.js';

test('listener added during dispatch does not receive the in-flight event', () => {
  let lateCalls = 0;
  let unsubLate = () => {};
  const unsub = subscribe(() => {
    unsubLate = subscribe(() => { lateCalls += 1; });
  });
  setState({ demo: false });
  assert.equal(lateCalls, 0);
  setState({ demo: false });
  assert.equal(lateCalls, 1);
  unsub();
  unsubLate();
});

test('a throwing listener does not block other listeners', () => {
  const originalError = console.error;
  console.error = () => {};
  let reached = false;
  const a = subscribe(() => { throw new Error('boom'); });
  const b = subscribe(() => { reached = true; });
  setState({ demo: false });
  console.error = originalError;
  a(); b();
  assert.equal(reached, true);
});

test('unsubscribing during dispatch does not skip peers', () => {
  const calls = [];
  let unsubFirst;
  unsubFirst = subscribe(() => { calls.push('first'); unsubFirst(); });
  const second = subscribe(() => calls.push('second'));
  setState({ demo: false });
  second();
  assert.deepEqual(calls, ['first', 'second']);
});

test('setUi with notify:false does not emit', () => {
  let calls = 0;
  const unsub = subscribe(() => { calls += 1; });
  setUi({ search: 'x' }, { notify: false });
  unsub();
  assert.equal(calls, 0);
  assert.equal(getState().ui.search, 'x');
});
