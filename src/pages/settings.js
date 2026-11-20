import { Capacitor } from '@capacitor/core';
import { demoPreviewHref } from '../utils/demo-mode.js';
import { icon } from '../components/icon.js';

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

    return `<div class="screen screen--settings">
      <header class="screen-head">
        <p class="eyebrow">Preferences</p>
        <h1 class="screen-head__title" tabindex="-1">Settings</h1>
        <p class="screen-head__sub">Library, playback and application details. Nothing here leaves the device.</p>
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
            hint: 'Tracks currently available in the library.',
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
            hint: 'Native playback will use AndroidX Media3 and a MediaSessionService.',
            tag: 'Planned',
          })}
          ${row({
            iconName: 'settings',
            label: 'Playback settings',
            hint: 'Crossfade, gapless playback and headphone behaviour.',
            tag: 'Planned',
          })}
        </div>
      </section>

      <section class="settings-group" aria-labelledby="settings-about">
        <h2 class="settings-group__title" id="settings-about">About</h2>
        <div class="settings-card">
          ${row({ iconName: 'info', label: 'Application', hint: 'Temporary project name.', value: 'Cinematic Music' })}
          ${row({ iconName: 'info', label: 'Version', hint: 'Frontend prototype build.', value: VERSION })}
          ${row({ iconName: 'info', label: 'Platform', hint: 'Runtime currently hosting the interface.', value: platformLabel() })}
          ${row({ iconName: 'disc', label: 'Library mode', hint: 'Where the current library snapshot comes from.', value: demo ? 'Development preview' : 'Empty · no import yet' })}
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

      <p class="settings-footer">Offline by design. No account, no ads, no tracking.</p>
    </div>`;
  },
};
