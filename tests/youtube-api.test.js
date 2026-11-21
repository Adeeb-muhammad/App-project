import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearYouTubeApiCache, clearYouTubeApiKey, getYouTubeApiKey,
  getYouTubeVideoDetails, saveYouTubeApiKey, searchYouTube,
} from '../src/data/youtube-api.js';

const originalFetch = globalThis.fetch;
const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
beforeEach(() => {
  values.clear(); clearYouTubeApiCache();
  saveYouTubeApiKey('AIzaSyExamplePersonalDevelopmentKey123');
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('stores and clears the API key locally', () => {
  assert.equal(getYouTubeApiKey(), 'AIzaSyExamplePersonalDevelopmentKey123');
  assert.equal(clearYouTubeApiKey(), true);
  assert.equal(getYouTubeApiKey(), '');
});
test('rejects a too-short API key', () => {
  assert.equal(saveYouTubeApiKey('short'), false);
  assert.equal(getYouTubeApiKey(), 'AIzaSyExamplePersonalDevelopmentKey123');
});
test('search uses strict safe search and filters thumbnails to YouTube hosts', async () => {
  let requestUrl = '';
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return new Response(JSON.stringify({ items: [
      { id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'Sample music video', channelTitle: 'Example', thumbnails: { high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' } } } },
      { id: { videoId: 'abcdefghijk' }, snippet: { title: 'Bad image', channelTitle: 'Example', thumbnails: { high: { url: 'https://example.com/image.jpg' } } } },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const results = await searchYouTube('Example Artist song', 'video');
  const url = new URL(requestUrl);
  assert.equal(url.searchParams.get('type'), 'video');
  assert.equal(url.searchParams.get('safeSearch'), 'strict');
  assert.equal(url.searchParams.get('videoEmbeddable'), 'true');
  assert.equal(url.searchParams.get('regionCode'), 'AE');
  assert.equal(results.length, 2);
  assert.equal(results[0].thumbnail, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(results[1].thumbnail, '');
});
test('searches public playlists', async () => {
  let requestUrl = '';
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return new Response(JSON.stringify({ items: [{ id: { playlistId: 'PL-example' }, snippet: { title: 'Study list', channelTitle: 'Example' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const results = await searchYouTube('study music', 'playlist');
  assert.equal(new URL(requestUrl).searchParams.get('type'), 'playlist');
  assert.equal(results[0].id, 'PL-example');
});
test('caches repeated search queries', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  await searchYouTube('same query', 'video');
  await searchYouTube('same query', 'video');
  assert.equal(calls, 1);
});
test('checks Made for Kids and embeddable status before player rendering', async () => {
  let requestUrl = '';
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return new Response(JSON.stringify({ items: [{ id: 'dQw4w9WgXcQ', snippet: { title: 'Example', channelTitle: 'Example', thumbnails: {} }, status: { madeForKids: true, embeddable: true } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const video = await getYouTubeVideoDetails('dQw4w9WgXcQ');
  assert.equal(new URL(requestUrl).searchParams.get('part'), 'snippet,status');
  assert.equal(video.madeForKids, true);
  assert.equal(video.embeddable, true);
});
test('reports quota exhaustion', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Quota exceeded', errors: [{ reason: 'quotaExceeded' }] } }), { status: 403, headers: { 'content-type': 'application/json' } });
  await assert.rejects(searchYouTube('quota test', 'video'), (error) => error.code === 'quota_exceeded');
});
test('requires a key before network access', async () => {
  clearYouTubeApiKey();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(searchYouTube('missing key', 'video'), (error) => error.code === 'missing_key');
  assert.equal(calls, 0);
});
