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
