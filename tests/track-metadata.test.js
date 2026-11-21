import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTrackMetadata,
  deleteTrackMetadata,
  getTrackMetadata,
  loadTrackMetadata,
  saveTrackMetadata,
  STORAGE_KEY,
} from '../src/data/track-metadata.js';
import { filterSongs } from '../src/data/library.js';
import {
  addImportedTrack,
  buildImportedLibrary,
  STORAGE_KEY as IMPORTED_STORAGE_KEY,
} from '../src/data/imported.js';

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
const trackId = 'content://media/external/audio/media/42';

beforeEach(() => values.clear());

test('metadata edits are saved separately from the original imported file record', () => {
  const imported = addImportedTrack({
    uri: trackId,
    title: 'Original title',
    artist: 'Original artist',
    album: 'Original album',
    addedAt: 1000,
  });
  assert.ok(imported.track);

  assert.equal(saveTrackMetadata(trackId, {
    title: ' New title ',
    artist: ' New artist ',
    albumTitle: ' New album ',
    genre: 'Ambient',
    language: 'English',
    tags: 'dreamy, late night, Dreamy',
    notes: 'First line\nSecond line',
  }), true);

  const storedImport = JSON.parse(values.get(IMPORTED_STORAGE_KEY))[0];
  assert.equal(storedImport.title, 'Original title');
  assert.equal(storedImport.artist, 'Original artist');
  assert.equal(storedImport.album, 'Original album');
  assert.equal(values.has(STORAGE_KEY), true);

  const metadata = getTrackMetadata(trackId);
  assert.equal(metadata.title, 'New title');
  assert.equal(metadata.artist, 'New artist');
  assert.equal(metadata.albumTitle, 'New album');
  assert.deepEqual(metadata.tags, ['dreamy', 'late night']);
  assert.equal(metadata.notes, 'First line\nSecond line');
});

test('metadata overlays update library grouping without mutating the source record', () => {
  addImportedTrack({
    uri: trackId,
    title: 'File title',
    artist: 'File artist',
    album: 'File album',
    addedAt: 1000,
  });
  saveTrackMetadata(trackId, {
    title: 'Edited title',
    artist: 'Edited artist',
    albumTitle: 'Edited album',
    genre: 'Electronic',
    language: 'English',
    tags: ['night'],
    notes: '',
  });

  const library = buildImportedLibrary();
  assert.equal(library.songs[0].title, 'Edited title');
  assert.equal(library.songs[0].artist, 'Edited artist');
  assert.equal(library.songs[0].albumTitle, 'Edited album');
  assert.equal(library.songs[0].genre, 'Electronic');
  assert.equal(library.albums[0].title, 'Edited album');
  assert.equal(library.albums[0].artist, 'Edited artist');
  assert.equal(library.artists[0].name, 'Edited artist');

  const sourceRecord = JSON.parse(values.get(IMPORTED_STORAGE_KEY))[0];
  assert.equal(sourceRecord.title, 'File title');
});

test('metadata values are bounded and tags are unique and capped', () => {
  const tags = Array.from({ length: 15 }, (_, index) => `tag-${index}`);
  assert.equal(saveTrackMetadata(trackId, {
    title: 'Title',
    artist: 'Artist',
    albumTitle: 'Album',
    genre: 'g'.repeat(200),
    language: 'l'.repeat(200),
    tags,
    notes: 'n'.repeat(2000),
  }), true);
  const saved = getTrackMetadata(trackId);
  assert.equal(saved.genre.length, 80);
  assert.equal(saved.language.length, 80);
  assert.equal(saved.tags.length, 12);
  assert.equal(saved.notes.length, 1200);
});

test('invalid track ids or blank required fields are rejected', () => {
  const value = { title: 'Title', artist: 'Artist', albumTitle: 'Album' };
  assert.equal(saveTrackMetadata('https://example.com/song.mp3', value), false);
  assert.equal(saveTrackMetadata('', value), false);
  assert.equal(saveTrackMetadata(trackId, { ...value, title: '  ' }), false);
  assert.equal(getTrackMetadata('file:///song.mp3'), null);
});

test('applying metadata returns a copy and provides defaults for unedited tracks', () => {
  const original = { id: trackId, title: 'Source', artist: 'Artist', albumTitle: 'Album' };
  const untouched = applyTrackMetadata(original, {});
  assert.notEqual(untouched, original);
  assert.deepEqual(untouched.tags, []);
  assert.equal(untouched.notes, '');
  assert.equal(original.genre, undefined);
  assert.equal(original.title, 'Source');
});

test('edited genre, language and tags are included in local song search', () => {
  const song = {
    title: 'Track',
    artist: 'Artist',
    albumTitle: 'Album',
    genre: 'Ambient',
    language: 'Japanese',
    tags: ['late night', 'dreamy'],
  };
  assert.equal(filterSongs([song], 'ambient').length, 1);
  assert.equal(filterSongs([song], 'japanese').length, 1);
  assert.equal(filterSongs([song], 'late night').length, 1);
});

test('metadata can be reset and malformed storage is ignored safely', () => {
  saveTrackMetadata(trackId, { title: 'Title', artist: 'Artist', albumTitle: 'Album' });
  assert.equal(deleteTrackMetadata(trackId), true);
  assert.equal(deleteTrackMetadata(trackId), false);
  assert.equal(getTrackMetadata(trackId), null);
  values.set(STORAGE_KEY, '{bad json');
  assert.deepEqual(loadTrackMetadata(), {});
});
