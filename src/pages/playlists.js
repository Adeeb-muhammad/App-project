import { escapeHtml } from '../utils/dom.js';
import { glowStyle } from '../utils/safe.js';
import { href } from '../utils/navigation.js';
import { formatRuntime, pluralise } from '../utils/format.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';

function playlistCard(playlist) {
  const style = glowStyle(playlist.palette);

  return `<li class="playlist-card-item">
    <a class="playlist-card" href="${href(`/playlists/${encodeURIComponent(playlist.id)}`)}" style="${style}">
      <span class="playlist-card__cover" aria-hidden="true">
        <span class="playlist-card__ring"></span>
        ${icon('playlists', { size: 24 })}
      </span>
      <span class="playlist-card__body">
        <span class="playlist-card__name">${escapeHtml(playlist.name)}</span>
        <span class="playlist-card__meta">${pluralise(playlist.trackCount, 'track')} · ${formatRuntime(playlist.duration)}</span>
        <span class="playlist-card__description">${escapeHtml(playlist.description)}</span>
      </span>
      <span class="playlist-card__chevron" aria-hidden="true">${icon('chevronRight', { size: 18 })}</span>
    </a>
  </li>`;
}

export const playlistsPage = {
  title: 'Playlists',
  render(state) {
    const { library } = state;

    return `<div class="screen screen--playlists">
      <header class="screen-head">
        <p class="eyebrow">Curated by you</p>
        <h1 class="screen-head__title" tabindex="-1">Playlists</h1>
        <p class="screen-head__sub">Short paths through your collection, built for a mood or a moment.</p>
      </header>

      ${
        library.playlists.length
          ? `<ul class="playlist-list">${library.playlists.map(playlistCard).join('')}</ul>`
          : `<div class="intro-panel">
              ${emptyState({
                iconName: 'playlists',
                title: 'No playlists yet',
                description:
                  'Playlists you create will be kept on this device. Creating and editing them arrives alongside local music import.',
                hint: import.meta.env.DEV ? 'Tip: add ?demo=1 to the URL to preview playlists with sample data.' : '',
                action: `<a class="button button--ghost" href="${href('/library')}">Browse the library</a>`,
              })}
            </div>`
      }
    </div>`;
  },
};
