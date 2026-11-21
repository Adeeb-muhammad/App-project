import { Capacitor } from '@capacitor/core';
import { demoPreviewHref } from '../utils/demo-mode.js';
import { icon } from '../components/icon.js';
import { isAndroidNative } from '../native/native-audio.js';
import { getYouTubeApiKey, saveYouTubeApiKey, clearYouTubeApiKey } from '../data/youtube-api.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

function platformLabel() {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'Android · Capacitor';
  if (platform === 'ios') return 'iOS · Capacitor';
  return 'Web preview';
}

function row({ iconName, label, hint, value = null, tag = null }) {
  return `<div class="settings-row">
    <span class="settings-row__icon" aria-hidden="true">${icon(iconName, { size: 18 })}</span>
    <span class="settings-row__text">
      <span class="settings-row__label">${label}</span>
      <span class="settings-row__hint">${hint}</span>
    </span>
    ${value ? `<span class="settings-row__value">${value}</span>` : ''}
    ${tag ? `<span class="tag">${tag}</span>` : ''}
  </div>`;
}

function libraryExitHref() {
  const base = window.location.pathname || '/';
  return `${base}#/settings`;
}

export const settingsPage = {
  title: 'Settings',
  render(state) {
    const { demo, library } = state;
    const native = isAndroidNative();
    const youtubeKeyStatus = getYouTubeApiKey() ? 'An API key is saved on this device.' : 'No API key saved yet.';

    return `<div class="screen screen--settings">
      <header class="screen-head">
        <p class="eyebrow">Preferences</p>
        <h1 class="screen-head__title" tabindex="-1">Settings</h1>
        <p class="screen-head__sub">Library, playback, online discovery and application details.</p>
      </header>

      ${
        demo
          ? `<div class="demo-banner" role="status">
              <span class="demo-banner__dot" aria-hidden="true"></span>
              <span><strong>Development preview active.</strong> Fictional sample albums are loaded and the transport is a UI simulation.</span>
              <a class="demo-banner__link" href="${libraryExitHref()}">Leave preview</a>
            </div>`
          : ''
      }

      <section class="settings-group" aria-labelledby="settings-library">
        <h2 class="settings-group__title" id="settings-library">Music library</h2>
        <div class="settings-card">
          ${row({
            iconName: 'folder',
            label: 'Music folders',
            hint: 'Choose which folders on this device are scanned for audio.',
            tag: 'Planned',
          })}
          ${row({
            iconName: 'music',
            label: 'Imported tracks',
            hint: 'Audio files you picked with Android’s document picker.',
            value: `${library.songs.length} ${library.songs.length === 1 ? 'track' : 'tracks'}`,
          })}
        </div>
      </section>

      <section class="settings-group" aria-labelledby="settings-playback">
        <h2 class="settings-group__title" id="settings-playback">Playback</h2>
        <div class="settings-card">
          ${row({
            iconName: 'disc',
            label: 'Audio engine',
            hint: native
              ? 'AndroidX Media3 ExoPlayer inside a MediaSessionService, with background and lock-screen controls.'
              : demo
                ? 'Simulated transport for the development preview; no audio is decoded.'
                : 'Native playback is only available in the Android app.',
            value: native ? 'Media3' : demo ? 'Simulation' : 'Unavailable',
          })}
          ${row({
            iconName: 'settings',
            label: 'Playback settings',
            hint: 'Crossfade, gapless playback and headphone behaviour.',
            tag: 'Planned',
          })}
        </div>
      </section>

      <section class="settings-group" aria-labelledby="settings-youtube">
        <h2 class="settings-group__title" id="settings-youtube">YouTube discovery</h2>
        <div class="settings-card settings-card--form">
          <form class="youtube-api-form" data-role="youtube-api-form">
            <div class="youtube-api-form__copy"><strong>YouTube Data API v3</strong>
              <p>Save your own Google Cloud API key on this device to enable video and playlist search. The key is not committed to the project.</p>
            </div>
            <label for="youtube-api-key">API key</label>
            <input id="youtube-api-key" class="search__input" type="password" name="apiKey" minlength="20" maxlength="200" placeholder="Paste your API key" autocomplete="off" autocapitalize="off" spellcheck="false" />
            <div class="youtube-api-form__actions">
              <button class="button button--primary button--small" type="submit">Save API key</button>
              <button class="button button--ghost button--small" type="button" data-action="clear-youtube-key">Clear key</button>
            </div>
            <p class="youtube-api-form__status" data-role="youtube-api-status" role="status" aria-live="polite">${youtubeKeyStatus}</p>
          </form>
          <p class="youtube-api-form__help">Create a key in <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Credentials</a>, enable YouTube Data API v3, and restrict the key to that API. Avoid sharing it or committing it to GitHub.</p>
        </div>
      </section>

      <section class="settings-group" aria-labelledby="settings-about">
        <h2 class="settings-group__title" id="settings-about">About</h2>
        <div class="settings-card">
          ${row({ iconName: 'info', label: 'Application', hint: 'Temporary project name.', value: 'Cinematic Music' })}
          ${row({ iconName: 'info', label: 'Version', hint: 'Frontend prototype build.', value: VERSION })}
          ${row({ iconName: 'info', label: 'Platform', hint: 'Runtime currently hosting the interface.', value: platformLabel() })}
          ${row({ iconName: 'disc', label: 'Library mode', hint: 'Where the current library snapshot comes from.', value: demo ? 'Development preview' : library.hasContent ? 'Imported local files' : 'Empty · no import yet' })}
        </div>
      </section>

      ${
        import.meta.env.DEV
          ? `<section class="settings-group" aria-labelledby="settings-developer">
              <h2 class="settings-group__title" id="settings-developer">Developer</h2>
              <div class="settings-card">
                <div class="settings-row">
                  <span class="settings-row__icon" aria-hidden="true">${icon('sparkles', { size: 18 })}</span>
                  <span class="settings-row__text">
                    <span class="settings-row__label">Demo preview</span>
                    <span class="settings-row__hint">Load the fictional sample library in this tab. Production builds never enable it by themselves.</span>
                  </span>
                  ${demo
                    ? `<a class="button button--ghost button--small" href="${libraryExitHref()}">Disable</a>`
                    : `<a class="button button--ghost button--small" href="${demoPreviewHref('#/settings')}">Enable</a>`}
                </div>
              </div>
            </section>`
          : ''
      }

      <p class="settings-footer">Local music stays on this device. YouTube search and video playback connect to Google's services.</p>
    </div>`;
  },
  mount(root) {
    const controller = new AbortController();
    const { signal } = controller;
    const form = root.querySelector('[data-role="youtube-api-form"]');
    const status = root.querySelector('[data-role="youtube-api-status"]');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.elements.namedItem('apiKey');
      const value = input?.value ?? '';
      if (!value.trim()) { status.textContent = 'Paste an API key first. The existing saved key has not been changed.'; return; }
      if (!saveYouTubeApiKey(value)) { status.textContent = 'The key could not be saved. Check the value and available device storage.'; return; }
      input.value = '';
      status.textContent = 'API key saved on this device. You can now search YouTube in Discover.';
    }, { signal });
    root.querySelector('[data-action="clear-youtube-key"]')?.addEventListener('click', () => {
      status.textContent = clearYouTubeApiKey() ? 'Saved YouTube API key cleared from this device.' : 'Could not clear the saved API key.';
    }, { signal });
    return () => controller.abort();
  },

};
