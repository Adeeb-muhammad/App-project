/**
 * Imported local audio: validation, persistence and the library view model.
 *
 * Scope for Milestone 2A is deliberately small: the files the user picks are
 * remembered in `localStorage` (not SQLite) and the actual access right is the
 * Android persistable URI permission taken by the native plugin. If either is
 * missing the track is not shown, so the library never lists something it
 * cannot play.
 */

import { buildPersonalCollections, getTrackRating, isFavourite } from './personal-library.js';
import { applyTrackMetadata, loadTrackMetadata } from './track-metadata.js';

const STORAGE_KEY = 'cinematic.imported.v1';
const DEFAULT_PALETTE = ['#A78BFA', '#7C6BFF', '#191B25'];
const MAX_TEXT = 300;
const MAX_TRACKS = 500;

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cleanText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, MAX_TEXT);
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function fileStem(fileName) {
  return String(fileName ?? '').replace(/\.[a-z0-9]{1,8}$/i, '');
}

/**
 * Converts the plugin result (or a persisted record) into a library track.
 * Only `content://` URIs are accepted: those are the ones the Storage Access
 * Framework can grant and the ones the native ExoPlayer queue can open.
 */
export function normaliseImportedTrack(input) {
  if (!input || typeof input !== 'object') return null;

  const uri = typeof input.uri === 'string' ? input.uri.trim() : '';
  if (!/^content:\/\//i.test(uri)) return null;

  const fileName = cleanText(input.fileName, null);
  const title = cleanText(input.title, cleanText(fileStem(fileName), 'Untitled track'));
  const artist = cleanText(input.artist, 'Unknown artist');
  const album = cleanText(input.album, 'Imported audio');

  const durationMs = Number(input.durationMs);
  const durationSeconds = Number(input.duration);
  let duration = 0;
  if (Number.isFinite(durationMs) && durationMs > 0) duration = Math.round(durationMs / 1000);
  else if (Number.isFinite(durationSeconds) && durationSeconds > 0) duration = Math.round(durationSeconds);

  const addedAt = Number(input.addedAt);
  const mimeType = typeof input.mimeType === 'string' && /^audio\//i.test(input.mimeType)
    ? input.mimeType
    : null;

  return {
    // The URI is the stable identity: re-picking the same file replaces it.
    id: uri,
    uri,
    source: 'local',
    title,
    artist,
    albumTitle: album,
    duration,
    trackNumber: null,
    artwork: null,
    palette: DEFAULT_PALETTE.slice(),
    mimeType,
    fileName,
    addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : Date.now(),
  };
}

function dedupe(tracks) {
  const seen = new Set();
  const result = [];
  for (const track of tracks) {
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    result.push(track);
    if (result.length >= MAX_TRACKS) break;
  }
  return result;
}

export function loadImportedTracks() {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupe(parsed.map(normaliseImportedTrack).filter(Boolean));
  } catch (error) {
    console.warn('[imported] could not read saved tracks', error);
    return [];
  }
}

export function saveImportedTracks(tracks) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(dedupe(tracks)));
    return true;
  } catch (error) {
    console.warn('[imported] could not save tracks', error);
    return false;
  }
}

/**
 * Adds one pick to the saved list. Returns the normalised track and the full
 * list so the store can be refreshed without a second read.
 */
export function addImportedTrack(input) {
  const track = normaliseImportedTrack(input);
  if (!track) return { track: null, tracks: loadImportedTracks() };
  const existing = loadImportedTracks().filter((saved) => saved.id !== track.id);
  const tracks = dedupe([track, ...existing]);
  saveImportedTracks(tracks);
  return { track, tracks };
}

function albumId(artist, album) {
  return `imported-${hash(`${artist}\u0000${album}`)}`;
}

function artistId(name) {
  return `imported-artist-${hash(name)}`;
}

/** Builds the same view model shape the demo library provides. */
export function buildImportedLibrary(input = []) {
  const metadata = loadTrackMetadata();
  const tracks = dedupe((Array.isArray(input) ? input : []).map(normaliseImportedTrack).filter(Boolean))
    .map((track) => applyTrackMetadata(track, metadata));

  const songs = tracks.map((track, index) => ({
    ...track,
    trackNumber: index + 1,
    // Same id the album grouping below uses, so album detail and Now Playing
    // can resolve the record exactly like they do for demo tracks.
    albumId: albumId(track.artist, track.albumTitle),
    isFavourite: isFavourite(track.id),
    rating: getTrackRating(track.id),
  }));

  const albumMap = new Map();
  for (const song of songs) {
    const key = `${song.artist}\u0000${song.albumTitle}`;
    const existing = albumMap.get(key);
    if (existing) {
      existing.tracks.push(song);
      existing.addedAt = Math.max(existing.addedAt, song.addedAt);
      continue;
    }
    albumMap.set(key, {
      id: albumId(song.artist, song.albumTitle),
      title: song.albumTitle,
      artist: song.artist,
      year: new Date(song.addedAt).getFullYear(),
      artwork: null,
      palette: song.palette,
      favourite: false,
      addedAt: song.addedAt,
      tracks: [song],
    });
  }

  const albums = [...albumMap.values()].sort((a, b) => b.addedAt - a.addedAt);

  const artists = [...new Set(songs.map((song) => song.artist))].map((name) => {
    const artistAlbums = albums.filter((album) => album.artist === name);
    return {
      id: artistId(name),
      name,
      albumCount: artistAlbums.length,
      trackCount: songs.filter((song) => song.artist === name).length,
      artwork: null,
      palette: DEFAULT_PALETTE.slice(),
    };
  });

  const personal = buildPersonalCollections(songs);
  for (const album of albums) {
    album.favourite = album.tracks.some((track) => track.isFavourite);
  }

  return {
    albums,
    songs,
    artists,
    playlists: personal.playlists,
    likedSongs: personal.likedSongs,
    recentlyPlayed: personal.recentlyPlayed
      .map((track) => albums.find((album) => album.id === track.albumId))
      .filter(Boolean),
    recentlyAdded: albums.slice(0, 5),
    favourites: albums.filter((album) => album.favourite),
    featured: albums[0] ?? null,
    hasContent: songs.length > 0,
  };
}

export { STORAGE_KEY };
