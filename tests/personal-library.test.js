import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  addTrackToPlaylist,
  buildPersonalCollections,
  createPlaylist,
  deletePlaylist,
  getTrackRating,
  isFavourite,
  loadPersonalData,
  recordTrackPlayed,
  removeTrackFromPlaylist,
  renamePlaylist,
  setTrackRating,
  toggleFavourite,
} from '../src/data/personal-library.js';

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};

beforeEach(() => values.clear());

test('personal playlists are validated and persisted locally', () => {
  assert.equal(createPlaylist('   '), null);
  const playlist = createPlaylist(' Night Drive ', 'Late-night favourites');
  assert.ok(playlist.id.startsWith('playlist-'));
  assert.equal(playlist.name, 'Night Drive');
  assert.equal(loadPersonalData().playlists.length, 1);
});

test('tracks can be added once and removed from a custom playlist', () => {
  const playlist = createPlaylist('Focus');
  assert.equal(addTrackToPlaylist(playlist.id, 'track-a'), true);
  assert.equal(addTrackToPlaylist(playlist.id, 'track-a'), false);
  assert.equal(addTrackToPlaylist('liked-songs', 'track-a'), false);
  assert.equal(loadPersonalData().playlists[0].trackIds.length, 1);
  assert.equal(removeTrackFromPlaylist(playlist.id, 'track-a'), true);
  assert.equal(removeTrackFromPlaylist(playlist.id, 'track-a'), false);
});

test('playlists can be renamed and deleted', () => {
  const playlist = createPlaylist('Old name');
  assert.equal(renamePlaylist(playlist.id, 'New name', 'Updated'), true);
  assert.equal(loadPersonalData().playlists[0].name, 'New name');
  assert.equal(deletePlaylist(playlist.id), true);
  assert.equal(deletePlaylist(playlist.id), false);
});

test('favourites toggle and track ratings accept only one to five stars', () => {
  assert.equal(toggleFavourite('track-a'), true);
  assert.equal(isFavourite('track-a'), true);
  assert.equal(toggleFavourite('track-a'), false);
  assert.equal(isFavourite('track-a'), false);
  assert.equal(setTrackRating('track-a', 4), true);
  assert.equal(getTrackRating('track-a'), 4);
  assert.equal(setTrackRating('track-a', 6), false);
  assert.equal(getTrackRating('track-a'), 4);
});

test('personal collections resolve only tracks still present in the library', () => {
  const playlist = createPlaylist('Road trip');
  toggleFavourite('track-a');
  addTrackToPlaylist(playlist.id, 'track-b');
  addTrackToPlaylist(playlist.id, 'missing-track');
  recordTrackPlayed('track-b');
  recordTrackPlayed('track-a');

  const songs = [
    { id: 'track-a', title: 'A', albumId: 'album-a', duration: 100, palette: [] },
    { id: 'track-b', title: 'B', albumId: 'album-b', duration: 120, palette: [] },
  ];
  const collections = buildPersonalCollections(songs);

  assert.equal(collections.playlists[0].id, 'liked-songs');
  assert.deepEqual(collections.likedSongs.map((track) => track.id), ['track-a']);
  assert.deepEqual(collections.playlists[1].tracks.map((track) => track.id), ['track-b']);
  assert.deepEqual(collections.recentlyPlayed.map((track) => track.id), ['track-a', 'track-b']);
});
