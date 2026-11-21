import { escapeHtml } from '../utils/dom.js';
import { href } from '../utils/navigation.js';
import { getYouTubeVideoDetails } from '../data/youtube-api.js';

function watchLink(id) { return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id); }
function failure(message, id) {
  return '<div class="youtube-player-message" role="status"><p>' + escapeHtml(message) + '</p>' +
    '<a class="button button--ghost button--small" href="' + watchLink(id) + '" target="_blank" rel="noopener noreferrer">Open on YouTube</a></div>';
}

export const youtubePlayerPage = {
  title: 'YouTube player',
  render() {
    return '<div class="screen screen--youtube-player"><a class="back-link" href="' + href('/discover') + '">← Back to Discover</a>' +
      '<header class="screen-head"><p class="eyebrow">YouTube playback</p><h1 class="screen-head__title" tabindex="-1">Now watching.</h1>' +
      '<p class="screen-head__sub">Video playback is provided by YouTube. Its standard controls, branding and ads remain part of the player.</p></header>' +
      '<div class="youtube-player-stage" data-role="youtube-stage" aria-live="polite"><p class="youtube-player-stage__loading">Checking video availability…</p></div>' +
      '<div class="youtube-player-info" data-role="youtube-info" hidden></div></div>';
  },
  mount(root, { route }) {
    const controller = new AbortController();
    const signal = controller.signal;
    const stage = root.querySelector('[data-role="youtube-stage"]');
    const info = root.querySelector('[data-role="youtube-info"]');
    const id = route?.id ?? '';
    const pause = () => {
      try {
        root.querySelector('[data-role="youtube-embed"]')?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube.com');
      } catch { /* Player may not have loaded yet. */ }
    };
    const onVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVisibility);
    const showFailure = (text) => { if (!signal.aborted && stage) stage.innerHTML = failure(text, id); };

    getYouTubeVideoDetails(id, { signal }).then((video) => {
      if (signal.aborted || !stage) return;
      if (!video.embeddable) {
        showFailure('YouTube reports that this video cannot be embedded. You can still open it directly on YouTube.');
        return;
      }
      const origin = encodeURIComponent(window.location.origin);
      const src = 'https://www.youtube.com/embed/' + encodeURIComponent(video.id) +
        '?enablejsapi=1&playsinline=1&controls=1&rel=0&origin=' + origin;
      stage.innerHTML = '<div class="youtube-player-frame"><iframe data-role="youtube-embed" title="YouTube video player: ' +
        escapeHtml(video.title) + '" src="' + src + '" referrerpolicy="strict-origin-when-cross-origin" ' +
        'allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>';
      info.hidden = false;
      info.innerHTML = '<p class="youtube-player-info__eyebrow">YouTube video</p><h2 class="youtube-player-info__title">' +
        escapeHtml(video.title) + '</h2><p class="youtube-player-info__channel">' + escapeHtml(video.channelTitle) + '</p>' +
        (video.madeForKids ? '<p class="youtube-player-info__notice">This video is marked as Made for Kids by YouTube.</p>' : '') +
        '<a href="' + watchLink(video.id) + '" target="_blank" rel="noopener noreferrer">Open this video in YouTube</a>';
    }).catch((error) => {
      if (error?.name === 'AbortError' || signal.aborted) return;
      showFailure(error?.code === 'missing_key'
        ? 'Add a YouTube Data API key in Settings before playing videos.'
        : error?.code === 'quota_exceeded' ? error.message : (error?.message || 'Could not load this YouTube video.'));
    });

    return () => { controller.abort(); pause(); document.removeEventListener('visibilitychange', onVisibility); };
  },
};
