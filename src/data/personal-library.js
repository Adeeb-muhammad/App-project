/**
 * Personal library metadata stored only on this device.
 * Music files remain in Android's app-private/imported URI storage; this module
 * stores only playlist membership, likes, ratings and a compact play history.
 */
const STORAGE_KEY = 'cinematic.personal.v1';
const MAX_PLAYLISTS = 100;
const MAX_HISTORY = 100;
const MAX_FAVOURITES = 500;
let sequence = 0;

function emptyData() {
  return { favourites: [], ratings: {}, playlists: [], history: [] };
}

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cleanText(value, max = 80) {
  if (typeof value !== 'string') return '';
  return value.replace(/\\s+/g, ' ').trim().slice(0, max);
}

function cleanIds(value, max = 500) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && id.length > 0))].slice(0, max);
}

export function loadPersonalData() {
  const store = storage();
  if (!store) return emptyData();
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return emptyData();

    const ratings = {};
    if (parsed.ratings && typeof parsed.ratings === 'object' && !Array.isArray(parsed.ratings)) {
      for (const [id, value] of Object.entries(parsed.ratings).slice(0, MAX_FAVOURITES)) {
        const rating = Number(value);
        if (id && Number.isInteger(rating) && rating >= 1 && rating <= 5) ratings[id] = rating;
      }
    }

    const playlists = Array.isArray(parsed.playlists)
      ? parsed.playlists.slice(0, MAX_PLAYLISTS).map((playlist) => ({
          id: cleanText(playlist?.id, 100),
          name: cleanText(playlist?.name, 40),
          description: cleanText(playlist?.description, 180),
          trackIds: cleanIds(playlist?.trackIds),
          createdAt: Number.isFinite(Number(playlist?.createdAt)) ? Number(playlist.createdAt) : Date.now(),
        })).filter((playlist) => playlist.id && playlist.name)
      : [];

    const history = Array.isArray(parsed.history)
      ? parsed.history.slice(0, MAX_HISTORY).map((entry) => ({
          trackId: typeof entry?.trackId === 'string' ? entry.trackId : '',
          playedAt: Number(entry?.playedAt) || 0,
        })).filter((entry) => entry.trackId && entry.playedAt > 0)
      : [];

    return {
      favourites: cleanIds(parsed.favourites, MAX_FAVOURITES),
      ratings,
      playlists,
      history,
    };
  } catch (error) {
    console.warn('[personal-library] could not read saved metadata', error);
    return emptyData();
  }
}

function save(data) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('[personal-library] could not save metadata', error);
    return false;
  }
}

function update(mutator) {
  const data = loadPersonalData();
  mutator(data);
  save(data);
  return data;
}

function newId() {
  sequence += 1;
  return `playlist-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export function isFavourite(trackId) {
  return loadPersonalData().favourites.includes(String(trackId));
}

export function toggleFavourite(trackId) {
  const id = String(trackId ?? '');
  if (!id) return false;
  let favourite = false;
  update((data) => {
    if (data.favourites.includes(id)) {
      data.favourites = data.favourites.filter((saved) => saved !== id);
    } else if (data.favourites.length < MAX_FAVOURITES) {
      data.favourites = [id, ...data.favourites];
      favourite = true;
    }
  });
  return favourite;
}

export function getTrackRating(trackId) {
  return loadPersonalData().ratings[String(trackId ?? '')] ?? 0;
}

export function setTrackRating(trackId, rating) {
  const id = String(trackId ?? '');
  const value = Number(rating);
  if (!id || !Number.isInteger(value) || value < 1 || value > 5) return false;
  update((data) => { data.ratings[id] = value; });
  return true;
}

export function createPlaylist(name, description = '') {
  const title = cleanText(name, 40);
  if (!title) return null;
  let created = null;
  update((data) => {
    if (data.playlists.length >= MAX_PLAYLISTS) return;
    created = {
      id: newId(),
      name: title,
      description: cleanText(description, 180),
      trackIds: [],
      createdAt: Date.now(),
    };
    data.playlists.unshift(created);
  });
  return created;
}

export function renamePlaylist(playlistId, name, description) {
  const title = cleanText(name, 40);
  if (!title) return false;
  let changed = false;
  update((data) => {
    const playlist = data.playlists.find((entry) => entry.id === playlistId);
    if (!playlist) return;
    playlist.name = title;
    if (description !== undefined) playlist.description = cleanText(description, 180);
    changed = true;
  });
  return changed;
}

export function deletePlaylist(playlistId) {
  let removed = false;
  update((data) => {
    const next = data.playlists.filter((playlist) => playlist.id !== playlistId);
    removed = next.length !== data.playlists.length;
    data.playlists = next;
  });
  return removed;
}

export function addTrackToPlaylist(playlistId, trackId) {
  const id = String(trackId ?? '');
  if (!id || !playlistId || playlistId === 'liked-songs') return false;
  let added = false;
  update((data) => {
    const playlist = data.playlists.find((entry) => entry.id === playlistId);
    if (!playlist || playlist.trackIds.includes(id)) return;
    playlist.trackIds.push(id);
    added = true;
  });
  return added;
}

export function removeTrackFromPlaylist(playlistId, trackId) {
  let removed = false;
  update((data) => {
    const playlist = data.playlists.find((entry) => entry.id === playlistId);
    if (!playlist) return;
    const next = playlist.trackIds.filter((id) => id !== trackId);
    removed = next.length !== playlist.trackIds.length;
    playlist.trackIds = next;
  });
  return removed;
}

export function recordTrackPlayed(trackId) {
  const id = String(trackId ?? '');
  if (!id) return;
  update((data) => {
    data.history = [{ trackId: id, playedAt: Date.now() }, ...data.history.filter((entry) => entry.trackId !== id)]
      .slice(0, MAX_HISTORY);
  });
}

export function buildPersonalCollections(songs) {
  const data = loadPersonalData();
  const byId = new Map(songs.map((song) => [song.id, song]));
  const favourites = data.favourites.map((id) => byId.get(id)).filter(Boolean);
  const history = data.history.map((entry) => byId.get(entry.trackId)).filter(Boolean);
  const playlists = [
    {
      id: 'liked-songs',
      name: 'Liked Songs',
      description: 'Tracks you have saved as favourites.',
      tracks: favourites,
      isSystem: true,
    },
    ...data.playlists.map((playlist) => ({
      ...playlist,
      tracks: playlist.trackIds.map((id) => byId.get(id)).filter(Boolean),
      isSystem: false,
    })),
  ].map((playlist) => ({
    ...playlist,
    trackCount: playlist.tracks.length,
    duration: playlist.tracks.reduce((total, track) => total + (Number(track.duration) || 0), 0),
    palette: playlist.tracks[0]?.palette ?? ['#A78BFA', '#7C6BFF', '#191B25'],
  }));

  return {
    playlists,
    likedSongs: favourites,
    recentlyPlayed: [...new Map(history.map((track) => [track.albumId, track])).values()],
    favourites,
  };
}

export { STORAGE_KEY };
