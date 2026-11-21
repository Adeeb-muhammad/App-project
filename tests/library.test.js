import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterLibraryItems,
  getLibraryItems,
  sortLibraryItems,
} from '../src/data/library.js';

const songs = [
  { id: 'c', title: 'Track 10', artist: 'Beta', albumTitle: 'Album', duration: 240, isFavourite: true, rating: 0, addedAt: 3 },
  { id: 'a', title: 'Track 2', artist: 'Alpha', albumTitle: 'Album', duration: 120, isFavourite: false, rating: 5, addedAt: 1 },
  { id: 'b', title: 'Another', artist: 'Alpha', albumTitle: 'Album', duration: 180, isFavourite: true, rating: 3, addedAt: 2 },
];

test('song filters return liked and rated tracks without changing the input', () => {
  assert.deepEqual(filterLibraryItems(songs, 'songs', 'liked').map((track) => track.id), ['c', 'b']);
  assert.deepEqual(filterLibraryItems(songs, 'songs', 'rated').map((track) => track.id), ['a', 'b']);
  assert.deepEqual(songs.map((track) => track.id), ['c', 'a', 'b']);
});

test('album favourite filter only returns favourite albums', () => {
  const albums = [
    { id: 'a', favourite: false },
    { id: 'b', favourite: true },
    { id: 'c', favourite: true },
  ];
  assert.deepEqual(filterLibraryItems(albums, 'albums', 'favourites').map((album) => album.id), ['b', 'c']);
});

test('song sorting supports numeric-aware title, artist and duration order', () => {
  assert.deepEqual(sortLibraryItems(songs, 'songs', 'title-asc').map((track) => track.id), ['b', 'a', 'c']);
  assert.deepEqual(sortLibraryItems(songs, 'songs', 'artist-asc').map((track) => track.id), ['b', 'a', 'c']);
  assert.deepEqual(sortLibraryItems(songs, 'songs', 'duration-asc').map((track) => track.id), ['a', 'b', 'c']);
  assert.deepEqual(sortLibraryItems(songs, 'songs', 'duration-desc').map((track) => track.id), ['c', 'b', 'a']);
});

test('recently-added song sorting and album sorting use timestamps', () => {
  assert.deepEqual(sortLibraryItems(songs, 'songs', 'added-desc').map((track) => track.id), ['c', 'b', 'a']);
  const albums = [
    { id: 'old', title: 'Zed', artist: 'Beta', addedAt: 1 },
    { id: 'new', title: 'Alpha', artist: 'Alpha', addedAt: 9 },
  ];
  assert.deepEqual(sortLibraryItems(albums, 'albums', 'added-desc').map((album) => album.id), ['new', 'old']);
  assert.deepEqual(sortLibraryItems(albums, 'albums', 'title-asc').map((album) => album.id), ['new', 'old']);
});

test('artist sorting supports name and track count', () => {
  const artists = [
    { id: 'b', name: 'Beta', trackCount: 8 },
    { id: 'a', name: 'Alpha', trackCount: 3 },
    { id: 'c', name: 'Gamma', trackCount: 12 },
  ];
  assert.deepEqual(sortLibraryItems(artists, 'artists', 'name-asc').map((artist) => artist.id), ['a', 'b', 'c']);
  assert.deepEqual(sortLibraryItems(artists, 'artists', 'tracks-desc').map((artist) => artist.id), ['c', 'b', 'a']);
});

test('combined library query, filter and sort are applied in that order', () => {
  const library = { songs, albums: [], artists: [] };
  const result = getLibraryItems(library, 'songs', 'track', 'rated', 'title-asc');
  assert.deepEqual(result.map((track) => track.id), ['a']);
});

test('unknown sort and filter values safely retain the source order', () => {
  assert.deepEqual(filterLibraryItems(songs, 'songs', 'unknown').map((track) => track.id), ['c', 'a', 'b']);
  assert.deepEqual(sortLibraryItems(songs, 'songs', 'unknown').map((track) => track.id), ['c', 'a', 'b']);
});
