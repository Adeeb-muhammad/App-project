import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { lookupLyrics, plainFromSyncedLyrics } from '../src/data/lyrics-provider.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('uses title, artist and duration for a direct lyrics match', async () => {
  let requestedUrl = '';
  let requestedHeaders = null;
  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return new Response(JSON.stringify({
      trackName: 'Midnight Drive',
      artistName: 'Example Artist',
      instrumental: false,
      plainLyrics: 'First sample line\nSecond sample line',
      syncedLyrics: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await lookupLyrics({
    title: 'Midnight Drive',
    artist: 'Example Artist',
    albumTitle: 'Night EP',
    duration: 184,
  });

  assert.match(requestedUrl, /track_name=Midnight\+Drive/);
  assert.match(requestedUrl, /artist_name=Example\+Artist/);
  assert.match(requestedUrl, /duration=184/);
  assert.ok(requestedHeaders['X-User-Agent'].includes('Cinematic Music'));
  assert.equal(result.lyrics, 'First sample line\nSecond sample line');
});

test('falls back to search and strips timestamps from synced lyrics', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response('', { status: 404 });
    return new Response(JSON.stringify([{
      trackName: 'Midnight Drive',
      artistName: 'Example Artist',
      duration: 184,
      instrumental: false,
      plainLyrics: null,
      syncedLyrics: '[00:01.00]First sample line\n[00:04.50]Second sample line',
    }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await lookupLyrics({
    title: 'Midnight Drive',
    artist: 'Example Artist',
    duration: 184,
  });

  assert.equal(calls, 2);
  assert.equal(result.lyrics, 'First sample line\nSecond sample line');
});

test('does not select a result with a different title or a distant duration', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify([{
    trackName: 'Midnight Ride',
    artistName: 'Example Artist',
    duration: 184,
    plainLyrics: 'Wrong song',
  }]), { status: 200, headers: { 'content-type': 'application/json' } });

  const result = await lookupLyrics({
    title: 'Midnight Drive',
    artist: 'Example Artist',
    duration: 184,
  });
  assert.equal(result, null);
});

test('recognises instrumental records without inventing lyrics', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    trackName: 'Quiet Intro',
    artistName: 'Example Artist',
    instrumental: true,
    plainLyrics: null,
    syncedLyrics: null,
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const result = await lookupLyrics({
    title: 'Quiet Intro',
    artist: 'Example Artist',
    duration: 75,
  });
  assert.equal(result.instrumental, true);
  assert.equal(result.lyrics, '');
});

test('plain conversion removes multiple LRC timestamps on one line', () => {
  assert.equal(
    plainFromSyncedLyrics('[00:01.00][00:02.00]A sample line\n[00:05.50]Another line'),
    'A sample line\nAnother line',
  );
});
