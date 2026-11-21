import { demoAlbums, demoPlaylists, demoRecentlyPlayed } from './demo-data.js';
import { totalDuration } from '../utils/format.js';

/**
 * The library view model is the only shape the screens read.
 *
 * With demo mode off it is completely empty: the application never invents
 * music in the user's library. Importing local audio arrives in a later
 * milestone, which is exactly what the empty states explain.
 */

function emptyLibrary() {
  return {
    albums: [],
    songs: [],
    artists: [],
    playlists: [],
    recentlyPlayed: [],
    recentlyAdded: [],
    favourites: [],
    featured: null,
    hasContent: false,
  };
}

function artistId(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function buildEmptyLibrary() {
  return emptyLibrary();
}

export function buildDemoLibrary() {
  const albums = demoAlbums.map((album) => {
    const tracks = album.tracks.map((track) => ({
      id: `${album.id}-${track.number}`,
      title: track.title,
      duration: track.duration,
      trackNumber: track.number,
      albumId: album.id,
      albumTitle: album.title,
      artist: album.artist,
      artwork: album.artwork,
      palette: album.palette,
    }));
    return { ...album, tracks };
  });

  const songs = albums.flatMap((album) => album.tracks);
  const songById = new Map(songs.map((song) => [song.id, song]));
  const albumById = new Map(albums.map((album) => [album.id, album]));

  const artists = [...new Set(albums.map((album) => album.artist))].map((name) => {
    const artistAlbums = albums.filter((album) => album.artist === name);
    return {
      id: artistId(name),
      name,
      albumCount: artistAlbums.length,
      trackCount: artistAlbums.reduce((count, album) => count + album.tracks.length, 0),
      artwork: artistAlbums[0]?.artwork ?? null,
      palette: artistAlbums[0]?.palette ?? ['#A78BFA', '#7C6BFF', '#191B25'],
    };
  });

  const playlists = demoPlaylists.map((playlist) => {
    const tracks = playlist.trackIds.map((id) => songById.get(id)).filter(Boolean);
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      palette: playlist.palette,
      tracks,
      trackCount: tracks.length,
      duration: totalDuration(tracks),
    };
  });

  return {
    albums,
    songs,
    artists,
    playlists,
    recentlyPlayed: demoRecentlyPlayed
      .map((id) => albumById.get(id))
      .filter(Boolean),
    recentlyAdded: [...albums].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5),
    favourites: albums.filter((album) => album.favourite),
    featured: albums[0] ?? null,
    hasContent: albums.length > 0,
  };
}

export function getLibrary({ demo = false } = {}) {
  return demo ? buildDemoLibrary() : buildEmptyLibrary();
}

export function findAlbum(library, id) {
  return library.albums.find((album) => album.id === id) ?? null;
}

export function findPlaylist(library, id) {
  return library.playlists.find((playlist) => playlist.id === id) ?? null;
}

export function findTrack(library, id) {
  return library.songs.find((song) => song.id === id) ?? null;
}

function normalise(query) {
  return String(query ?? '').trim().toLowerCase();
}

export function filterSongs(songs, query) {
  const term = normalise(query);
  if (!term) return songs;
  return songs.filter((song) =>
    [song.title, song.artist, song.albumTitle].some((value) =>
      String(value ?? '').toLowerCase().includes(term),
    ),
  );
}

export function filterAlbums(albums, query) {
  const term = normalise(query);
  if (!term) return albums;
  return albums.filter((album) =>
    [album.title, album.artist].some((value) => String(value ?? '').toLowerCase().includes(term)),
  );
}

export function filterArtists(artists, query) {
  const term = normalise(query);
  if (!term) return artists;
  return artists.filter((artist) => String(artist.name ?? '').toLowerCase().includes(term));
}


/** Filter options are deliberately local and only expose data the library owns. */
export const LIBRARY_FILTER_OPTIONS = Object.freeze({
  songs: [
    { value: 'all', label: 'All songs' },
    { value: 'liked', label: 'Liked Songs' },
    { value: 'rated', label: 'Rated songs' },
  ],
  albums: [
    { value: 'all', label: 'All albums' },
    { value: 'favourites', label: 'Favourites' },
  ],
  artists: [
    { value: 'all', label: 'All artists' },
  ],
});

export const LIBRARY_SORT_OPTIONS = Object.freeze({
  songs: [
    { value: 'default', label: 'Default order' },
    { value: 'title-asc', label: 'Title A–Z' },
    { value: 'artist-asc', label: 'Artist A–Z' },
    { value: 'duration-asc', label: 'Shortest first' },
    { value: 'duration-desc', label: 'Longest first' },
    { value: 'added-desc', label: 'Recently added' },
  ],
  albums: [
    { value: 'default', label: 'Default order' },
    { value: 'title-asc', label: 'Album A–Z' },
    { value: 'artist-asc', label: 'Artist A–Z' },
    { value: 'added-desc', label: 'Recently added' },
  ],
  artists: [
    { value: 'default', label: 'Default order' },
    { value: 'name-asc', label: 'Name A–Z' },
    { value: 'tracks-desc', label: 'Most tracks' },
  ],
});

const libraryCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function compareText(left, right) {
  return libraryCollator.compare(String(left ?? ''), String(right ?? ''));
}

function compareNumber(left, right) {
  const a = Number(left);
  const b = Number(right);
  return (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0);
}

/** Applies a supported filter without mutating the source collection. */
export function filterLibraryItems(items, tab, filter = 'all') {
  const source = Array.isArray(items) ? items : [];
  if (tab === 'songs' && filter === 'liked') {
    return source.filter((track) => track.isFavourite === true);
  }
  if (tab === 'songs' && filter === 'rated') {
    return source.filter((track) => Number(track.rating) >= 1 && Number(track.rating) <= 5);
  }
  if (tab === 'albums' && filter === 'favourites') {
    return source.filter((album) => album.favourite === true);
  }
  return source.slice();
}

/** Sorts a copy so the library's underlying import and playlist order is untouched. */
export function sortLibraryItems(items, tab, sort = 'default') {
  const source = Array.isArray(items) ? items.slice() : [];
  const comparisons = {
    songs: {
      'title-asc': (a, b) => compareText(a.title, b.title),
      'artist-asc': (a, b) => compareText(a.artist, b.artist) || compareText(a.title, b.title),
      'duration-asc': (a, b) => compareNumber(a.duration, b.duration),
      'duration-desc': (a, b) => compareNumber(b.duration, a.duration),
      'added-desc': (a, b) => compareNumber(b.addedAt, a.addedAt),
    },
    albums: {
      'title-asc': (a, b) => compareText(a.title, b.title),
      'artist-asc': (a, b) => compareText(a.artist, b.artist) || compareText(a.title, b.title),
      'added-desc': (a, b) => compareNumber(b.addedAt, a.addedAt),
    },
    artists: {
      'name-asc': (a, b) => compareText(a.name, b.name),
      'tracks-desc': (a, b) => compareNumber(b.trackCount, a.trackCount) || compareText(a.name, b.name),
    },
  };
  const compare = comparisons[tab]?.[sort];
  if (!compare) return source;

  return source
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compare(left.item, right.item) || left.index - right.index)
    .map(({ item }) => item);
}

/** Shared search → filter → sort pipeline for the Library screen and count. */
export function getLibraryItems(library, tab, query = '', filter = 'all', sort = 'default') {
  const searched = {
    songs: () => filterSongs(library?.songs ?? [], query),
    albums: () => filterAlbums(library?.albums ?? [], query),
    artists: () => filterArtists(library?.artists ?? [], query),
  }[tab]?.() ?? [];
  return sortLibraryItems(filterLibraryItems(searched, tab, filter), tab, sort);
}
