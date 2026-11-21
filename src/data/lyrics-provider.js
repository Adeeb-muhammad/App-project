const API_BASE = 'https://lrclib.net/api';
const CLIENT_HEADER = 'Cinematic Music v0.1.0 (https://github.com/Adeeb-muhammad/App-project)';
const MAX_LYRICS = 12000;

function normalise(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function plainFromSyncedLyrics(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\[(?:\d{1,2}:)?\d{2}(?:\.\d{1,3})?\]/g, '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_LYRICS);
}

function lyricsFromRecord(record) {
  if (typeof record?.plainLyrics === 'string' && record.plainLyrics.trim()) {
    return record.plainLyrics.trim().slice(0, MAX_LYRICS);
  }
  return plainFromSyncedLyrics(record?.syncedLyrics);
}

function abortError() {
  return new DOMException('The lyrics request was cancelled.', 'AbortError');
}

function pauseBeforeFallback(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, 300);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function requestJson(url, signal) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-User-Agent': CLIENT_HEADER },
    signal,
  });

  if (response.status === 404) return null;
  if (response.status === 429) {
    const retryAfter = Number(response.headers?.get('Retry-After')) || 30;
    const error = new Error('Lyrics service rate limit reached.');
    error.retryAfter = retryAfter;
    throw error;
  }
  if (!response.ok) {
    throw new Error('Lyrics service returned HTTP ' + response.status + '.');
  }
  return response.json();
}

function bestSearchMatch(records, track) {
  if (!Array.isArray(records)) return null;
  const expectedTitle = normalise(track.title);
  const rawArtist = String(track.artist ?? '').trim();
  const expectedArtist = /^unknown artist$/i.test(rawArtist) ? '' : normalise(rawArtist);
  const expectedAlbum = normalise(track.albumTitle);
  const expectedDuration = Number(track.duration);

  const matches = records.filter((record) => {
    if (normalise(record.trackName || record.name) !== expectedTitle) return false;
    return !expectedArtist || normalise(record.artistName) === expectedArtist;
  });
  if (matches.length === 0) return null;

  const ranked = matches.map((record) => {
    const duration = Number(record.duration);
    const durationDifference = expectedDuration > 0 && duration > 0
      ? Math.abs(duration - expectedDuration)
      : 0;
    const albumMatches = expectedAlbum && expectedAlbum !== 'imported audio'
      && normalise(record.albumName) === expectedAlbum;
    return { record, durationDifference, albumMatches };
  }).sort((a, b) => {
    if (a.durationDifference !== b.durationDifference) {
      return a.durationDifference - b.durationDifference;
    }
    return Number(b.albumMatches) - Number(a.albumMatches);
  });

  if (expectedDuration > 0 && ranked[0].durationDifference > 8) return null;
  return ranked[0].record;
}

function usableResult(record) {
  if (!record) return null;
  const lyrics = lyricsFromRecord(record);
  if (record.instrumental) {
    return { lyrics: '', instrumental: true, trackName: record.trackName || record.name || '' };
  }
  if (!lyrics) return null;
  return {
    lyrics,
    instrumental: false,
    trackName: record.trackName || record.name || '',
    artistName: record.artistName || '',
    source: 'LRCLIB',
  };
}

/**
 * Finds a close title/artist match in LRCLIB. The service is queried only when
 * the user opens a track without saved lyrics; successful results are cached
 * in the app's existing local track-metadata store.
 */
export async function lookupLyrics(track, { signal } = {}) {
  const title = String(track?.title ?? '').trim();
  const artist = String(track?.artist ?? '').trim();
  if (!title || !artist || /^unknown track$/i.test(title)) return null;

  const knownArtist = !/^unknown artist$/i.test(artist);
  const album = String(track?.albumTitle ?? '').trim();
  const duration = Number(track?.duration);
  let directAttempted = false;

  if (knownArtist) {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    if (album && !/^imported audio$/i.test(album)) params.set('album_name', album);
    if (Number.isFinite(duration) && duration > 0) params.set('duration', String(Math.round(duration)));

    directAttempted = true;
    const direct = await requestJson(API_BASE + '/get?' + params.toString(), signal);
    const directResult = usableResult(direct);
    if (directResult) return directResult;
  }

  if (directAttempted) await pauseBeforeFallback(signal);

  const searchParams = new URLSearchParams({ track_name: title });
  if (knownArtist) searchParams.set('artist_name', artist);
  if (album && !/^imported audio$/i.test(album)) searchParams.set('album_name', album);

  const records = await requestJson(API_BASE + '/search?' + searchParams.toString(), signal);
  const match = bestSearchMatch(records, track);
  return usableResult(match);
}

export { plainFromSyncedLyrics };
