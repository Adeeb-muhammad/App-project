const API = 'https://www.googleapis.com/youtube/v3';
const KEY = 'cinematic.youtube-api-key.v1';
const TTL = 5 * 60 * 1000;
const searches = new Map();
const videos = new Map();

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function getYouTubeApiKey() {
  const store = storage();
  try { return store ? String(store.getItem(KEY) ?? '').trim() : ''; } catch { return ''; }
}
export function saveYouTubeApiKey(value) {
  const key = String(value ?? '').trim();
  if (key.length < 20 || key.length > 200) return false;
  const store = storage();
  try { if (!store) return false; store.setItem(KEY, key); searches.clear(); videos.clear(); return true; } catch { return false; }
}
export function clearYouTubeApiKey() {
  const store = storage();
  try { if (!store) return false; store.removeItem(KEY); searches.clear(); videos.clear(); return true; } catch { return false; }
}
function fail(message, code = 'api_error', status = 0) {
  const error = new Error(message); error.code = code; error.status = status; return error;
}
function readCache(cache, key) {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.time > TTL) { cache.delete(key); return null; }
  return row.value;
}
function writeCache(cache, key, value) { cache.set(key, { time: Date.now(), value }); return value; }
function thumbnailUrl(thumbnails = {}) {
  for (const row of [thumbnails.maxres, thumbnails.high, thumbnails.medium, thumbnails.default]) {
    try {
      const url = new URL(row?.url ?? '');
      if (url.protocol === 'https:' && (url.hostname === 'i.ytimg.com' || url.hostname.endsWith('.ytimg.com'))) return url.toString();
    } catch { /* Try another quality. */ }
  }
  return '';
}
async function request(endpoint, params, signal) {
  const key = getYouTubeApiKey();
  if (!key) throw fail('Add your YouTube Data API key in Settings before searching.', 'missing_key');
  const url = new URL(API + '/' + endpoint);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  });
  url.searchParams.set('key', key);
  let response;
  try { response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' }, signal }); }
  catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw fail('Could not connect to YouTube. Check your internet connection.', 'network_error');
  }
  let payload;
  try { payload = await response.json(); } catch { throw fail('YouTube returned an unreadable response.', 'invalid_response', response.status); }
  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason ?? '';
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw fail('YouTube search quota has been used for today. Try again after the quota resets.', 'quota_exceeded', response.status);
    if (reason === 'keyInvalid' || reason === 'API_KEY_INVALID') throw fail('That API key is invalid. Check it in Settings.', 'invalid_key', response.status);
    if (reason === 'accessNotConfigured') throw fail('Enable YouTube Data API v3 for the Google Cloud project linked to this key.', 'api_not_enabled', response.status);
    throw fail(payload?.error?.message || ('YouTube request failed (' + response.status + ').'), 'api_error', response.status);
  }
  return payload;
}
function mapItem(item, type) {
  const id = type === 'video' ? item?.id?.videoId : item?.id?.playlistId;
  const title = item?.snippet?.title;
  if (typeof id !== 'string' || !id || typeof title !== 'string') return null;
  return {
    id, type, title,
    channelTitle: String(item.snippet.channelTitle ?? 'Unknown channel'),
    description: String(item.snippet.description ?? ''),
    thumbnail: thumbnailUrl(item.snippet.thumbnails),
  };
}
export async function searchYouTube(query, type = 'video', { signal } = {}) {
  const q = String(query ?? '').trim().slice(0, 100);
  if (!q) return [];
  if (type !== 'video' && type !== 'playlist') throw fail('Choose videos or playlists to search.', 'invalid_search_type');
  const cacheKey = type + ':' + q.toLocaleLowerCase();
  const cached = readCache(searches, cacheKey);
  if (cached) return cached;
  const params = { part: 'snippet', q, type, maxResults: 15, order: 'relevance', safeSearch: 'strict', regionCode: 'AE' };
  if (type === 'video') params.videoEmbeddable = 'true';
  const payload = await request('search', params, signal);
  const results = (Array.isArray(payload.items) ? payload.items : []).map((item) => mapItem(item, type)).filter(Boolean);
  return writeCache(searches, cacheKey, results);
}
export async function getYouTubeVideoDetails(videoId, { signal } = {}) {
  const id = String(videoId ?? '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw fail('That YouTube video ID is not valid.', 'invalid_video_id');
  const cached = readCache(videos, id);
  if (cached) return cached;
  const payload = await request('videos', { part: 'snippet,status', id }, signal);
  const item = Array.isArray(payload.items) ? payload.items[0] : null;
  if (!item?.id || !item.snippet) throw fail('This video is unavailable or cannot be viewed.', 'video_unavailable');
  const result = {
    id: item.id,
    title: String(item.snippet.title ?? 'YouTube video'),
    channelTitle: String(item.snippet.channelTitle ?? 'Unknown channel'),
    thumbnail: thumbnailUrl(item.snippet.thumbnails),
    madeForKids: item.status?.madeForKids === true,
    embeddable: item.status?.embeddable === true,
  };
  return writeCache(videos, id, result);
}
export function clearYouTubeApiCache() { searches.clear(); videos.clear(); }
export { KEY as API_KEY_STORAGE };
