import { escapeHtml } from '../utils/dom.js';
import { href } from '../utils/navigation.js';
import { getYouTubeApiKey, searchYouTube } from '../data/youtube-api.js';

function card(item) {
  const image = item.thumbnail
    ? '<img class="discover-card__image" src="' + escapeHtml(item.thumbnail) + '" alt="" loading="lazy">'
    : '<span class="discover-card__image discover-card__image--empty">YT</span>';
  const action = item.type === 'video'
    ? '<a class="button button--primary button--small" href="' + href('/watch/video/' + encodeURIComponent(item.id)) + '">Watch video</a>'
    : '<a class="button button--ghost button--small" href="https://www.youtube.com/playlist?list=' + encodeURIComponent(item.id) + '" target="_blank" rel="noopener noreferrer">Open on YouTube</a>';
  return '<li class="discover-card"><div class="discover-card__art">' + image + '</div>' +
    '<div class="discover-card__body"><p class="discover-card__eyebrow">YouTube ' + (item.type === 'video' ? 'video' : 'playlist') + '</p>' +
    '<h2 class="discover-card__title">' + escapeHtml(item.title) + '</h2><p class="discover-card__channel">' +
    escapeHtml(item.channelTitle) + '</p><div class="discover-card__actions">' + action + '</div></div></li>';
}

function errorMessage(error) {
  if (error?.code === 'quota_exceeded') return error.message;
  if (error?.code === 'missing_key') return 'Add a YouTube Data API key in Settings to start discovering music.';
  if (error?.code === 'invalid_key' || error?.code === 'api_not_enabled') return error.message;
  return error?.message || 'Something went wrong while searching YouTube.';
}

export const discoverPage = {
  title: 'Discover',
  render() {
    const ready = Boolean(getYouTubeApiKey());
    return '<div class="screen screen--discover"><header class="screen-head">' +
      '<p class="eyebrow">Explore beyond your downloads</p><h1 class="screen-head__title" tabindex="-1">Discover.</h1>' +
      '<p class="screen-head__sub">Search YouTube videos and public playlists. Choose a video to play it in YouTube&#39;s official player, right here in the app.</p></header>' +
      (ready ? '' : '<div class="discover-key-notice"><strong>YouTube search is not configured yet.</strong>' +
        '<p>Add your own YouTube Data API key in <a href="' + href('/settings') + '">Settings</a>. It stays in this app&#39;s local storage and is not included in the project source.</p></div>') +
      '<form class="discover-search" data-role="discover-form"><div class="search">' +
      '<span class="search__icon" aria-hidden="true">⌕</span><label class="sr-only" for="discover-query">Search YouTube</label>' +
      '<input id="discover-query" class="search__input" data-role="discover-query" type="search" placeholder="Search songs, artists or playlists…" maxlength="100" autocomplete="off"></div>' +
      '<div class="discover-search__footer"><div class="discover-types" role="group" aria-label="Search type">' +
      '<button class="discover-type is-active" type="button" data-role="discover-type" data-type="video" aria-pressed="true">Videos</button>' +
      '<button class="discover-type" type="button" data-role="discover-type" data-type="playlist" aria-pressed="false">Playlists</button></div>' +
      '<button class="button button--primary" type="submit" data-role="discover-submit"' + (ready ? '' : ' disabled') + '>Search YouTube</button></div></form>' +
      '<p class="discover-status" data-role="discover-status" role="status" aria-live="polite">Search for a song, artist or playlist to get started.</p>' +
      '<ul class="discover-results" data-role="discover-results"></ul>' +
      '<p class="discover-footnote">Search results, thumbnails and playback are provided by YouTube. YouTube&#39;s own player controls and any ads remain visible.</p></div>';
  },
  mount(root) {
    const controller = new AbortController();
    const signal = controller.signal;
    const form = root.querySelector('[data-role="discover-form"]');
    const query = root.querySelector('[data-role="discover-query"]');
    const status = root.querySelector('[data-role="discover-status"]');
    const results = root.querySelector('[data-role="discover-results"]');
    const submit = root.querySelector('[data-role="discover-submit"]');
    const tabs = [...root.querySelectorAll('[data-role="discover-type"]')];
    let type = 'video';
    let currentRequest = null;

    tabs.forEach((button) => button.addEventListener('click', () => {
      type = button.dataset.type === 'playlist' ? 'playlist' : 'video';
      tabs.forEach((tab) => {
        const active = tab.dataset.type === type;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
      currentRequest?.abort();
      results.replaceChildren();
      status.textContent = type === 'video' ? 'Search music videos and official uploads.' : 'Search public YouTube playlists.';
    }, { signal }));

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const q = query?.value.trim() ?? '';
      if (!q) { status.textContent = 'Enter a song, artist or playlist name first.'; query?.focus(); return; }
      if (!getYouTubeApiKey()) { status.textContent = 'Add a YouTube Data API key in Settings before searching.'; return; }
      currentRequest?.abort();
      const request = new AbortController();
      currentRequest = request;
      submit.disabled = true;
      status.textContent = 'Searching YouTube for "' + q + '"…';
      results.replaceChildren();
      try {
        const items = await searchYouTube(q, type, { signal: request.signal });
        if (signal.aborted || request.signal.aborted) return;
        results.innerHTML = items.map(card).join('');
        status.textContent = items.length
          ? items.length + ' ' + (type === 'video' ? 'videos' : 'playlists') + ' found for "' + q + '".'
          : 'No ' + (type === 'video' ? 'videos' : 'playlists') + ' found for "' + q + '". Try another search.';
      } catch (error) {
        if (error?.name === 'AbortError' || signal.aborted) return;
        status.textContent = errorMessage(error);
      } finally {
        if (!signal.aborted && currentRequest === request) submit.disabled = false;
      }
    }, { signal });

    return () => { currentRequest?.abort(); controller.abort(); };
  },
};
