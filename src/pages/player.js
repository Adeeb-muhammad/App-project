import { escapeHtml } from '../utils/dom.js';
import { artStyle } from '../utils/safe.js';
import { formatTime, pluralise } from '../utils/format.js';
import { findAlbum } from '../data/library.js';
import { getPlayerState, seekRatio, subscribe as subscribePlayer } from '../state/player.js';
import { artwork } from '../components/artwork.js';
import { emptyState } from '../components/empty-state.js';
import { icon } from '../components/icon.js';

/** Kept across re-renders so a queue stays open when the track changes. */
let queueOpen = false;

function progressPercent(player) {
  return player.duration > 0 ? Math.min(100, Math.max(0, (player.position / player.duration) * 100)) : 0;
}

function queueRows(player) {
  return player.queue
    .map((track, index) => {
      const current = index === player.index;
      return `<li>
        <button class="queue-row${current ? ' queue-row--current' : ''}" type="button" data-action="play-track" data-track-id="${escapeHtml(track.id)}"${current ? ' aria-current="true"' : ''}>
          <span class="queue-row__index" aria-hidden="true">${current ? icon('play', { size: 13 }) : String(index + 1).padStart(2, '0')}</span>
          <span class="queue-row__text">
            <span class="queue-row__title">${escapeHtml(track.title)}</span>
            <span class="queue-row__meta">${escapeHtml(track.artist)}</span>
          </span>
          <span class="queue-row__duration">${formatTime(track.duration)}</span>
        </button>
      </li>`;
    })
    .join('');
}

function engineNote(player) {
  if (player.engine === 'native') {
    return 'AndroidX Media3 · keeps playing in the background with notification and lock-screen controls';
  }
  if (player.engine === 'unavailable') {
    return 'Native playback requires the Android app — this browser cannot play local audio';
  }
  return 'UI preview · playback is simulated, no audio engine is connected yet';
}

function queueDialog(player) {
  return `<dialog class="queue-sheet" data-role="queue" aria-labelledby="queue-title">
    <div class="queue-sheet__head">
      <div>
        <p class="eyebrow">Up next</p>
        <h2 class="queue-sheet__title" id="queue-title">Queue</h2>
      </div>
      <button class="icon-button" type="button" data-action="close-queue" aria-label="Close queue">
        ${icon('close', { size: 18 })}
      </button>
    </div>
    <p class="queue-sheet__meta">${pluralise(player.queue.length, 'track')} in this queue</p>
    <ul class="queue-list" data-queue="player-queue">${queueRows(player)}</ul>
  </dialog>`;
}

function emptyPlayer(state) {
  return `<section class="now-playing now-playing--empty" aria-labelledby="player-empty-title">
    <header class="now-playing__bar">
      <button class="icon-button" type="button" data-action="close-player" aria-label="Close Now Playing">
        ${icon('chevronDown', { size: 20 })}
      </button>
      <span class="now-playing__eyebrow">Now playing</span>
      <span class="now-playing__spacer" aria-hidden="true"></span>
    </header>
    <div class="now-playing__empty-body">
      <h1 class="sr-only" id="player-empty-title" tabindex="-1">Now playing</h1>
      ${emptyState({
        iconName: 'disc',
        title: 'Nothing playing',
        description: state.demo
          ? 'Choose a track from the library to preview the player. This is a visual simulation only.'
          : 'Import an audio file from your device and it will appear here, ready to play through AndroidX Media3.',
        hint: import.meta.env.DEV && !state.demo
          ? 'Tip: add ?demo=1 to preview the player with sample tracks.'
          : '',
        action: `<a class="button button--ghost" href="#/library">Browse the library</a>`,
      })}
    </div>
  </section>`;
}

function playerView(state, player) {
  const { track, isPlaying, position, duration } = player;
  const album = findAlbum(state.library, track.albumId);
  const style = artStyle(track.palette);
  const percent = progressPercent(player);

  return `<section class="now-playing${isPlaying ? ' is-playing' : ''}" style="${style}" aria-labelledby="player-title">
    <div class="now-playing__veil" aria-hidden="true"></div>

    <header class="now-playing__bar">
      <button class="icon-button" type="button" data-action="close-player" aria-label="Close Now Playing">
        ${icon('chevronDown', { size: 20 })}
      </button>
      <span class="now-playing__eyebrow">Now playing</span>
      <button class="icon-button" type="button" data-action="open-queue" aria-label="Open queue" aria-haspopup="dialog">
        ${icon('queue', { size: 20 })}
      </button>
    </header>

    <div class="now-playing__art">
      ${artwork(track, { className: 'now-playing__image', eager: true, alt: `Artwork for ${track.albumTitle}` })}
    </div>

    <div class="now-playing__body">
      <div class="now-playing__info">
        <p class="now-playing__album">${escapeHtml(album ? `${album.title} · ${album.year}` : track.albumTitle)}</p>
        <h1 class="now-playing__title" id="player-title" tabindex="-1">${escapeHtml(track.title)}</h1>
        <p class="now-playing__artist">${escapeHtml(track.artist)}</p>
      </div>

      <div class="now-playing__scrub">
        <label class="sr-only" for="player-scrubber">Seek position</label>
        <input
          id="player-scrubber"
          class="scrubber"
          type="range"
          min="0"
          max="1000"
          step="1"
          value="${Math.round(percent * 10)}"
          style="--progress:${percent.toFixed(2)}%"
          data-role="scrubber"
          aria-valuetext="${formatTime(position)} of ${formatTime(duration)}"
        />
        <div class="now-playing__times">
          <span data-role="elapsed">${formatTime(position)}</span>
          <span data-role="duration">${formatTime(duration)}</span>
        </div>
      </div>

      <div class="now-playing__controls">
        <button class="transport-button" type="button" data-action="previous" aria-label="Previous track">
          ${icon('previous', { size: 24 })}
        </button>
        <button class="transport-button transport-button--play" type="button" data-action="toggle-play" data-role="transport-toggle" aria-label="${isPlaying ? 'Pause' : 'Play'}">
          ${icon(isPlaying ? 'pause' : 'play', { size: 30 })}
        </button>
        <button class="transport-button" type="button" data-action="next" aria-label="Next track">
          ${icon('next', { size: 24 })}
        </button>
      </div>

      <p class="now-playing__note" data-role="engine-note">
        ${icon(player.engine === 'native' ? 'disc' : 'sparkles', { size: 14 })}
        <span>${engineNote(player)}</span>
      </p>
    </div>

    ${queueDialog(player)}
  </section>`;
}

function updateProgress(root, player) {
  const percent = progressPercent(player);
  const scrubber = root.querySelector('[data-role="scrubber"]');
  if (scrubber) {
    scrubber.value = String(Math.round(percent * 10));
    scrubber.style.setProperty('--progress', `${percent.toFixed(2)}%`);
    scrubber.setAttribute('aria-valuetext', `${formatTime(player.position)} of ${formatTime(player.duration)}`);
  }
  const elapsed = root.querySelector('[data-role="elapsed"]');
  if (elapsed) elapsed.textContent = formatTime(player.position);
  const duration = root.querySelector('[data-role="duration"]');
  if (duration) duration.textContent = formatTime(player.duration);
}

function updateTransport(root, player) {
  const button = root.querySelector('[data-role="transport-toggle"]');
  if (!button) return;
  button.innerHTML = icon(player.isPlaying ? 'pause' : 'play', { size: 30 });
  button.setAttribute('aria-label', player.isPlaying ? 'Pause' : 'Play');
  const note = root.querySelector('[data-role="engine-note"] span');
  if (note) note.textContent = engineNote(player);
  const section = root.querySelector('.now-playing');
  if (section) section.classList.toggle('is-playing', player.isPlaying);
}

export const playerPage = {
  title: 'Now playing',
  render(state) {
    const player = getPlayerState();
    if (!player.track) return emptyPlayer(state);
    return playerView(state, player);
  },

  mount(root) {
    const controller = new AbortController();
    const { signal } = controller;
    const dialog = root.querySelector('[data-role="queue"]');

    root.querySelector('[data-action="open-queue"]')?.addEventListener(
      'click',
      () => {
        queueOpen = true;
        dialog?.showModal?.();
      },
      { signal },
    );

    root.querySelector('[data-action="close-queue"]')?.addEventListener(
      'click',
      () => {
        queueOpen = false;
        dialog?.close();
      },
      { signal },
    );

    dialog?.addEventListener(
      'close',
      () => {
        queueOpen = false;
      },
      { signal },
    );

    dialog?.addEventListener(
      'click',
      (event) => {
        if (event.target === dialog) {
          queueOpen = false;
          dialog.close();
        }
      },
      { signal },
    );

    if (queueOpen && dialog) {
      try {
        dialog.showModal();
      } catch {
        queueOpen = false;
      }
    }

    root.querySelector('[data-role="scrubber"]')?.addEventListener(
      'input',
      (event) => {
        seekRatio(Number(event.target.value) / 1000);
      },
      { signal },
    );

    const unsubscribe = subscribePlayer(({ type, state: playerState }) => {
      if (type === 'progress') {
        updateProgress(root, playerState);
        return;
      }
      if (type === 'state') {
        updateTransport(root, playerState);
        updateProgress(root, playerState);
      }
      // Track changes are handled by the shell, which re-renders this screen
      // with the new artwork, title and palette.
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  },
};
