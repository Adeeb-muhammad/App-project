/**
 * User-edited metadata for imported tracks.
 *
 * This is deliberately stored separately from the original picker records:
 * editing a title, tag or note never renames, rewrites or moves the audio file.
 */
export const STORAGE_KEY = 'cinematic.track-metadata.v1';

const MAX_TRACKS = 500;
const MAX_FIELD = 160;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;
const MAX_NOTES = 1200;

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cleanText(value, max = MAX_FIELD) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanNotes(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTES);
}

function cleanTags(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set();
  const tags = [];
  for (const raw of source) {
    const tag = cleanText(raw, MAX_TAG_LENGTH);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function normaliseEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const title = cleanText(input.title);
  const artist = cleanText(input.artist);
  const albumTitle = cleanText(input.albumTitle);
  if (!title || !artist || !albumTitle) return null;

  return {
    title,
    artist,
    albumTitle,
    genre: cleanText(input.genre, 80),
    language: cleanText(input.language, 80),
    tags: cleanTags(input.tags),
    notes: cleanNotes(input.notes),
  };
}

function validTrackId(trackId) {
  return typeof trackId === 'string'
    && trackId.length <= 2048
    && /^content:\/\//i.test(trackId);
}

export function loadTrackMetadata() {
  const store = storage();
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result = {};
    for (const [trackId, raw] of Object.entries(parsed).slice(0, MAX_TRACKS)) {
      if (!validTrackId(trackId)) continue;
      const entry = normaliseEntry(raw);
      if (entry) result[trackId] = entry;
    }
    return result;
  } catch {
    return {};
  }
}

export function getTrackMetadata(trackId) {
  if (!validTrackId(trackId)) return null;
  return loadTrackMetadata()[trackId] ?? null;
}

/** Persist only the edited metadata overlay; the imported audio record is untouched. */
export function saveTrackMetadata(trackId, input) {
  if (!validTrackId(trackId)) return false;
  const entry = normaliseEntry(input);
  if (!entry) return false;

  const store = storage();
  if (!store) return false;
  try {
    const metadata = loadTrackMetadata();
    if (!Object.hasOwn(metadata, trackId) && Object.keys(metadata).length >= MAX_TRACKS) return false;
    metadata[trackId] = entry;
    store.setItem(STORAGE_KEY, JSON.stringify(metadata));
    return true;
  } catch {
    return false;
  }
}

export function deleteTrackMetadata(trackId) {
  if (!validTrackId(trackId)) return false;
  const store = storage();
  if (!store) return false;
  try {
    const metadata = loadTrackMetadata();
    if (!Object.hasOwn(metadata, trackId)) return false;
    delete metadata[trackId];
    store.setItem(STORAGE_KEY, JSON.stringify(metadata));
    return true;
  } catch {
    return false;
  }
}

/** Return a new view-model track, never mutating its original imported record. */
export function applyTrackMetadata(track, overrides = loadTrackMetadata()) {
  if (!track || typeof track !== 'object') return track;
  const metadata = overrides?.[track.id];
  if (!metadata) {
    return { ...track, genre: '', language: '', tags: [], notes: '' };
  }
  return {
    ...track,
    ...metadata,
    tags: metadata.tags.slice(),
  };
}
