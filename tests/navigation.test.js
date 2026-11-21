import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../src/utils/navigation.js';

test('parses known routes', () => {
  assert.equal(parseRoute('').name, 'home');
  assert.equal(parseRoute('#/').name, 'home');
  assert.equal(parseRoute('#/library').tab, 'songs');
  assert.equal(parseRoute('#/library/albums').tab, 'albums');
  assert.equal(parseRoute('#/library/bogus').tab, 'songs');
  assert.equal(parseRoute('#/now-playing').name, 'player');
  assert.equal(parseRoute('#/settings/').name, 'settings');
  assert.equal(parseRoute('#/playlists').name, 'playlists');
});

test('decodes encoded ids', () => {
  const route = parseRoute('#/albums/' + encodeURIComponent('a/b c&d'));
  assert.equal(route.name, 'album');
  assert.equal(route.id, 'a/b c&d');
});

test('malformed escapes do not throw and resolve to notFound', () => {
  for (const hash of ['#/albums/%E0%A4%A', '#/playlists/%', '#/albums/%zz', '#/playlists/%C0%AF%']) {
    assert.doesNotThrow(() => parseRoute(hash), hash);
    assert.equal(parseRoute(hash).name, 'notFound', hash);
  }
});

test('invalid routes resolve to notFound', () => {
  assert.equal(parseRoute('#/nope').name, 'notFound');
  assert.equal(parseRoute('#/albums').name, 'notFound');
});


test('parses YouTube discovery and safe video watch routes', () => {
  assert.equal(parseRoute('#/discover').name, 'discover');
  const watch = parseRoute('#/watch/video/dQw4w9WgXcQ');
  assert.equal(watch.name, 'youtubePlayer');
  assert.equal(watch.mediaType, 'video');
  assert.equal(watch.id, 'dQw4w9WgXcQ');
});

test('rejects unsupported YouTube watch routes and malformed video ids', () => {
  for (const hash of ['#/watch', '#/watch/playlist/PLabc', '#/watch/video/short', '#/watch/video/%E0%A4%A']) {
    assert.equal(parseRoute(hash).name, 'notFound', hash);
  }
});
