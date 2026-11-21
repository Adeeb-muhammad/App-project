import { escapeHtml } from '../utils/dom.js';
import { href } from '../utils/navigation.js';
import { pluralise } from '../utils/format.js';
import { refreshLibrary, setUi } from '../state/store.js';
import { addImportedTrack } from '../data/imported.js';
import { filterAlbums, filterArtists, filterSongs } from '../data/library.js';
import { albumCard } from '../components/album-card.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';
import { songRow } from '../components/song-row.js';
import { isAndroidNative } from '../native/native-audio.js';
import { downloadYouTubeAudio, isDownloadSupported } from '../native/youtube-audio.js';

/**
 * The download message lives outside the render so it survives the re-render
 * that adding a track triggers.
 */
let downloadStatus = '';

const TABS = [
  { id: 'songs', label: 'Songs' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
];

function tabs(current) {
  return `<nav class="segmented" aria-label="Library sections">
    ${TABS.map(
      (tab) => `<a class="segmented__item" href="${href(`/library/${tab.id}`)}"${tab.id === current ? ' aria-current="page"' : ''}>${tab.label}</a>`,
    ).join('')}
  </nav>`;
}

function songList(songs) {
  return `<ul class="song-list" data-queue="library-songs">
    ${songs.map((song) => songRow(song)).join('')}
  </ul>`;
}

function albumGrid(albums) {
  return `<ul class="album-grid">
    ${albums
      .map((album) => `<li class="album-grid__item">${albumCard(album)}</li>`)
      .join('')}
  </ul>`;
}

function artistList(artists) {
  return `<ul class="artist-list">
    ${artists
      .map(
        (artist) => `<li class="artist-row">
          <span class="artist-row__art" aria-hidden="true">${icon('disc', { size: 20 })}</span>
          <span class="artist-row__text">
            <span class="artist-row__name">${escapeHtml(artist.name)}</span>
            <span class="artist-row__meta">${pluralise(artist.albumCount, 'album')} · ${pluralise(artist.trackCount, 'track')}</span>
          </span>
        </li>`,
      )
      .join('')}
  </ul>`;
}

function downloadBar(status) {
  return `<div class="import-bar">
    <div class="import-bar__text">
      <p class="import-bar__title">Save YouTube audio as MP3</p>
      <p class="import-bar__hint">Paste a video link and the audio track is saved into this app, then plays offline like any imported file. Only save content you have the rights to.</p>
    </div>
    <form class="download-form" data-role="youtube-form" novalidate>
      <label class="sr-only" for="youtube-url">YouTube video link</label>
      <input id="youtube-url" class="search__input" type="url" inputmode="url" data-role="youtube-url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" spellcheck="false" />
      <button class="button button--primary button--small" type="submit" data-role="youtube-submit">Save MP3</button>
    </form>
    <p class="download-status" data-role="download-status" role="status" aria-live="polite"${status ? '' : ' hidden'}>${escapeHtml(status)}</p>
  </div>`;
}

function emptyCopy(tab, searching) {
  if (searching) {
    return {
      title: 'No matches',
      description: 'Nothing in this section matches that search. Try a different word, or clear the field.',
    };
  }
  const copy = {
    songs: {
      title: 'No songs yet',
      description:
        'Choose an audio file from this device and it will appear here, ready to play through AndroidX Media3.',
    },
    albums: {
      title: 'No albums yet',
      description:
        'Albums are grouped automatically from imported tracks. Artwork and album metadata will appear here once import exists.',
    },
    artists: {
      title: 'No artists yet',
      description:
        'Artists are derived from your imported tracks — no manual tagging required.',
    },
  };
  return copy[tab] ?? copy.songs;
}

export function resultsHtml(library, tab, search) {
  const query = String(search ?? '');
  if (!library.hasContent) {
    return emptyState({
      iconName: tab === 'albums' ? 'disc' : tab === 'artists' ? 'music' : 'music',
      ...emptyCopy(tab, false),
      hint: import.meta.env.DEV ? 'Tip: add ?demo=1 to the URL to preview this screen with sample data.' : '',
    });
  }

  const filtered = {
    songs: () => filterSongs(library.songs, query),
    albums: () => filterAlbums(library.albums, query),
    artists: () => filterArtists(library.artists, query),
  }[tab]();

  if (filtered.length === 0) {
    return emptyState({
      iconName: 'search',
      ...emptyCopy(tab, true),
      hint: 'Search checks titles, artists and album names.',
    });
  }

  if (tab === 'songs') return songList(filtered);
  if (tab === 'albums') return albumGrid(filtered);
  return artistList(filtered);
}

function resultAnnouncement(library, tab, search) {
  if (!library.hasContent) return 'Library is empty.';
  const count = {
    songs: () => filterSongs(library.songs, search).length,
    albums: () => filterAlbums(library.albums, search).length,
    artists: () => filterArtists(library.artists, search).length,
  }[tab]();
  return `${count} ${count === 1 ? 'result' : 'results'} in ${tab}.`;
}

export const libraryPage = {
  render(state, route) {
    const tab = route?.tab ?? 'songs';
    const { library } = state;
    const search = state.ui.search ?? '';
    const total = {
      songs: library.songs.length,
      albums: library.albums.length,
      artists: library.artists.length,
    }[tab];

    return `<div class="screen screen--library">
      <header class="screen-head">
        <p class="eyebrow">Your collection</p>
        <h1 class="screen-head__title" tabindex="-1">Library</h1>
        <p class="screen-head__sub">${library.hasContent ? `${pluralise(total, tab === 'songs' ? 'song' : tab === 'albums' ? 'album' : 'artist')} in ${tab}.` : 'Everything you import will be organised here automatically.'}</p>
      </header>

      ${state.demo
        ? ''
        : `<div class="import-bar">
        <div class="import-bar__text">
          <p class="import-bar__title">Add music from this device</p>
          <p class="import-bar__hint">${isAndroidNative()
            ? 'Uses Android’s document picker. Only the file you choose is opened — no access to your whole library.'
            : 'Available in the Android app. The browser preview cannot open device files.'}</p>
        </div>
        <button class="button button--primary button--small" type="button" data-action="import-audio">
          ${icon('folder', { size: 15 })} Import audio
        </button>
      </div>`}

      ${state.demo || !isDownloadSupported() ? '' : downloadBar(downloadStatus)}

      ${tabs(tab)}

      ${
        library.hasContent
          ? `<div class="search" role="search">
              <span class="search__icon" aria-hidden="true">${icon('search', { size: 18 })}</span>
              <label class="sr-only" for="library-search">Search your library</label>
              <input id="library-search" class="search__input" type="search" data-role="library-search" placeholder="Search songs, albums, artists" autocomplete="off" spellcheck="false" value="${escapeHtml(search)}" />
            </div>`
          : ''
      }

      <p class="sr-only" role="status" aria-live="polite" data-role="result-count">${resultAnnouncement(library, tab, search)}</p>

      <div class="library-results" data-role="library-results">
        ${resultsHtml(library, tab, search)}
      </div>
    </div>`;
  },

  mount(root, { state, route }) {
    const cleanups = [];

    const input = root.querySelector('[data-role="library-search"]');
    const results = root.querySelector('[data-role="library-results"]');
    const announcement = root.querySelector('[data-role="result-count"]');
    if (input && results) {
      const tab = route?.tab ?? 'songs';
      const onInput = () => {
        setUi({ search: input.value }, { notify: false });
        results.innerHTML = resultsHtml(state.library, tab, input.value);
        if (announcement) announcement.textContent = resultAnnouncement(state.library, tab, input.value);
      };
      input.addEventListener('input', onInput);
      cleanups.push(() => input.removeEventListener('input', onInput));
    }

    const form = root.querySelector('[data-role="youtube-form"]');
    if (form) {
      const field = root.querySelector('[data-role="youtube-url"]');
      const submit = root.querySelector('[data-role="youtube-submit"]');
      const status = root.querySelector('[data-role="download-status"]');

      const setStatus = (text) => {
        downloadStatus = text;
        if (!status) return;
        status.textContent = text;
        status.hidden = !text;
      };

      const setBusy = (busy) => {
        if (!submit) return;
        if (busy) submit.dataset.busy = 'true';
        else delete submit.dataset.busy;
        submit.toggleAttribute('aria-busy', busy);
        submit.disabled = busy;
      };

      const onSubmit = async (event) => {
        event.preventDefault();
        if (submit?.dataset.busy === 'true') return;

        const url = field?.value?.trim() ?? '';
        if (!url) {
          setStatus('Paste a YouTube video link first.');
          field?.focus();
          return;
        }

        setBusy(true);
        setStatus('Starting the download…');
        const result = await downloadYouTubeAudio(url, {
          onProgress: ({ percent, line }) => {
            if (percent > 0) setStatus(`Downloading… ${percent}%`);
            else if (line) setStatus(line);
          },
        });
        setBusy(false);

        if (!result.ok) {
          setStatus(result.message);
          return;
        }

        const added = addImportedTrack(result.track);
        if (!added.track) {
          setStatus('That download could not be added to the library.');
          return;
        }
        if (field) field.value = '';
        setStatus(`Saved “${added.track.title}” to your library.`);
        refreshLibrary();
      };

      form.addEventListener('submit', onSubmit);
      cleanups.push(() => form.removeEventListener('submit', onSubmit));
    }

    return cleanups.length > 0 ? () => cleanups.forEach((fn) => fn()) : undefined;
  },
};
