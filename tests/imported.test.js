import test from 'node:test';
import assert from 'node:assert/strict';

const {
  normaliseImportedTrack,
  loadImportedTracks,
  saveImportedTracks,
  addImportedTrack,
  buildImportedLibrary,
  STORAGE_KEY,
} = await import('../src/data/imported.js');

function installStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
  return map;
}

const contentUri = 'content://com.android.providers.media.documents/document/audio%3A42';

test('only content:// URIs from the document picker are accepted', () => {
  assert.equal(normaliseImportedTrack(null), null);
  assert.equal(normaliseImportedTrack({ uri: 'file:///sdcard/song.mp3' }), null);
  assert.equal(normaliseImportedTrack({ uri: 'https://example.com/song.mp3' }), null);
  assert.equal(normaliseImportedTrack({ uri: 'javascript:alert(1)' }), null);
  assert.ok(normaliseImportedTrack({ uri: contentUri }));
});

test('metadata falls back safely and durations convert from milliseconds', () => {
  const track = normaliseImportedTrack({
    uri: `  ${contentUri}  `,
    fileName: 'Midnight Drive.mp3',
    durationMs: 215_400,
    mimeType: 'audio/mpeg',
  });

  assert.equal(track.uri, contentUri);
  assert.equal(track.id, contentUri);
  assert.equal(track.title, 'Midnight Drive');
  assert.equal(track.artist, 'Unknown artist');
  assert.equal(track.albumTitle, 'Imported audio');
  assert.equal(track.duration, 215);
  assert.equal(track.mimeType, 'audio/mpeg');
  assert.deepEqual(track.palette, ['#A78BFA', '#7C6BFF', '#191B25']);
  assert.equal(track.source, 'local');
});

test('titles are trimmed and bounded', () => {
  const track = normaliseImportedTrack({
    uri: contentUri,
    title: `  ${'x'.repeat(400)}  `,
    artist: '   ',
  });
  assert.equal(track.title.length, 300);
  assert.equal(track.artist, 'Unknown artist');
});

test('saved imports round-trip, deduplicate and keep the newest first', () => {
  installStorage();
  const first = normaliseImportedTrack({ uri: contentUri, title: 'First', addedAt: 1000 });
  const second = normaliseImportedTrack({
    uri: 'content://media/external/audio/media/7',
    title: 'Second',
    addedAt: 2000,
  });

  assert.equal(saveImportedTracks([first, second, first]), true);
  const loaded = loadImportedTracks();
  assert.equal(loaded.length, 2);
  assert.deepEqual(loaded.map((track) => track.title), ['First', 'Second']);
  assert.equal(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY)).length, 2);

  const { tracks } = addImportedTrack({ uri: contentUri, title: 'First replacement', addedAt: 3000 });
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].title, 'First replacement');
  assert.equal(new Set(tracks.map((track) => track.id)).size, 2);
});

test('corrupt storage is ignored instead of throwing', () => {
  installStorage();
  globalThis.localStorage.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(loadImportedTracks(), []);
});

test('the imported library groups albums and artists for the existing screens', () => {
  installStorage();
  const library = buildImportedLibrary([
    { uri: contentUri, title: 'One', artist: 'Nova', album: 'Night', durationMs: 60_000, addedAt: 1000 },
    { uri: 'content://media/external/audio/media/8', title: 'Two', artist: 'Nova', album: 'Night', durationMs: 90_000, addedAt: 2000 },
    { uri: 'content://media/external/audio/media/9', title: 'Three', artist: 'Other', album: 'Day', durationMs: 30_000, addedAt: 3000 },
  ]);

  assert.equal(library.hasContent, true);
  assert.equal(library.songs.length, 3);
  assert.equal(library.albums.length, 2);
  assert.equal(library.artists.length, 2);

  const night = library.albums.find((album) => album.title === 'Night');
  assert.equal(night.tracks.length, 2);
  assert.equal(night.artist, 'Nova');
  assert.equal(night.tracks[0].albumId, night.id);
  assert.equal(library.featured, library.albums[0]);
  assert.deepEqual(library.playlists, []);
  assert.equal(buildImportedLibrary([]).hasContent, false);
});
