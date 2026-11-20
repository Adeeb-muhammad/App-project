import { escapeHtml } from '../utils/dom.js';
import { glowStyle } from '../utils/safe.js';
import { href } from '../utils/navigation.js';
import { pluralise } from '../utils/format.js';
import { albumCard } from '../components/album-card.js';
import { artwork } from '../components/artwork.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';
import { sectionHeader } from '../components/section-header.js';

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Still awake';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function albumRail(title, albums, seeAllPath = null) {
  if (!albums.length) return '';
  return `<section class="rail-section" aria-labelledby="rail-${escapeHtml(title.toLowerCase().replace(/\s+/g, '-'))}">
    ${sectionHeader({ title, hrefPath: seeAllPath })}
    <ul class="rail">
      ${albums.map((album) => `<li class="rail__item">${albumCard(album)}</li>`).join('')}
    </ul>
  </section>`;
}

function featuredHero(album) {
  if (!album) return '';
  return `<section class="hero" style="${glowStyle(album.palette)}">
    <div class="hero__art">${artwork(album, { className: 'hero__image', eager: true, alt: `Artwork for ${album.title}` })}</div>
    <div class="hero__body">
      <p class="eyebrow">Featured album</p>
      <h2 class="hero__title">${escapeHtml(album.title)}</h2>
      <p class="hero__meta">${escapeHtml(album.artist)} · ${escapeHtml(album.year)} · ${pluralise(album.tracks.length, 'track')}</p>
      <div class="hero__actions">
        <button class="button button--primary" type="button" data-action="play-album" data-album-id="${escapeHtml(album.id)}" aria-label="Play ${escapeHtml(album.title)} (UI preview)">
          ${icon('play', { size: 16 })} Play album
        </button>
        <a class="button button--ghost" href="${href(`/albums/${encodeURIComponent(album.id)}`)}">View album</a>
      </div>
    </div>
  </section>`;
}

function playlistShortcuts(playlists) {
  if (!playlists.length) return '';
  return `<section class="shortcuts" aria-labelledby="shortcuts-title">
    ${sectionHeader({ title: 'Playlists', hrefPath: '/playlists' })}
    <ul class="shortcut-list">
      ${playlists
        .map((playlist) => {
          return `<li>
            <a class="shortcut" href="${href(`/playlists/${encodeURIComponent(playlist.id)}`)}" style="${glowStyle(playlist.palette)}">
              <span class="shortcut__mark" aria-hidden="true">${icon('playlists', { size: 18 })}</span>
              <span class="shortcut__text">
                <span class="shortcut__name">${escapeHtml(playlist.name)}</span>
                <span class="shortcut__meta">${pluralise(playlist.trackCount, 'track')}</span>
              </span>
              <span class="shortcut__chevron" aria-hidden="true">${icon('chevronRight', { size: 16 })}</span>
            </a>
          </li>`;
        })
        .join('')}
    </ul>
  </section>`;
}

function emptyHome() {
  const hint = import.meta.env.DEV
    ? 'Tip: add ?demo=1 to the URL to preview the interface with sample albums.'
    : '';

  return `<div class="screen screen--home">
    <header class="screen-head">
      <p class="eyebrow">${greeting()}</p>
      <h1 class="screen-head__title" tabindex="-1">Your sound, after dark.</h1>
      <p class="screen-head__sub">Cinematic Music keeps your collection on this device. No account, no streaming, no noise.</p>
    </header>

    <section class="intro-panel" aria-labelledby="intro-title">
      <span class="intro-panel__orb" aria-hidden="true"></span>
      <div id="intro-title">
        ${emptyState({
          iconName: 'music',
          title: 'Your library is quiet',
          description:
            'Nothing has been imported yet. Local music import arrives in the next milestone — this space is already built for it.',
          hint,
          action: `<a class="button button--ghost" href="${href('/library')}">Open the library</a>`,
        })}
      </div>
    </section>

    <section class="next-steps" aria-labelledby="next-steps-title">
      <h2 class="next-steps__title" id="next-steps-title">What this foundation includes</h2>
      <ul class="next-steps__list">
        <li class="next-steps__item">
          <span class="next-steps__icon" aria-hidden="true">${icon('disc', { size: 18 })}</span>
          <span><strong>Native playback, later</strong><span>AndroidX Media3 and a MediaSessionService will own audio in a dedicated milestone.</span></span>
        </li>
        <li class="next-steps__item">
          <span class="next-steps__icon" aria-hidden="true">${icon('folder', { size: 18 })}</span>
          <span><strong>Local import, next</strong><span>Songs stay on the device; nothing is uploaded and no account is needed.</span></span>
        </li>
        <li class="next-steps__item">
          <span class="next-steps__icon" aria-hidden="true">${icon('sparkles', { size: 18 })}</span>
          <span><strong>Built to stay offline</strong><span>Artwork, type and interface assets ship with the app bundle.</span></span>
        </li>
      </ul>
    </section>
  </div>`;
}

export const homePage = {
  render(state) {
    const { library, demo } = state;
    if (!library.hasContent) return emptyHome();

    return `<div class="screen screen--home">
      <header class="screen-head">
        <p class="eyebrow">${greeting()}</p>
        <h1 class="screen-head__title" tabindex="-1">Your sound, after dark.</h1>
        <p class="screen-head__sub">${demo ? 'A development preview of the player using fictional sample albums.' : 'Your local collection, presented the way it deserves.'}</p>
      </header>

      ${featuredHero(library.featured)}
      ${albumRail('Recently played', library.recentlyPlayed, '/library/albums')}
      ${albumRail('Recently added', library.recentlyAdded, '/library/albums')}
      ${albumRail('Favourite albums', library.favourites, '/library/albums')}
      ${playlistShortcuts(library.playlists)}
    </div>`;
  },
};
