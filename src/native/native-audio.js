import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * JavaScript side of the native audio bridge.
 *
 * The Kotlin plugin (`CinematicAudioPlugin`) owns an AndroidX Media3
 * `MediaController` connected to `PlaybackService`. All playback happens in
 * that foreground service, which is why audio keeps playing when the WebView is
 * backgrounded and why the notification / lock-screen controls work.
 *
 * This module is intentionally thin: it only names the plugin and adapts its
 * listener API. `src/state/player.js` stays platform-free and testable.
 */

export const CinematicAudio = registerPlugin('CinematicAudio');

/** Native playback only exists in the Android Capacitor container. */
export function isAndroidNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** Maps the library track shape onto the JSON the Kotlin plugin expects. */
export function toNativeTrack(track) {
  return {
    id: String(track.id ?? track.uri ?? ''),
    uri: String(track.uri ?? ''),
    title: String(track.title ?? 'Unknown track'),
    artist: String(track.artist ?? 'Unknown artist'),
    album: String(track.albumTitle ?? 'Imported audio'),
    durationMs: Math.max(0, Math.round(Number(track.duration ?? 0) * 1000)),
  };
}

/**
 * Creates the bridge used by `configurePlayback({ mode: 'native', bridge })`.
 * Keeping it behind a factory means the player can be tested with a fake bridge
 * in Node, where Capacitor is not available.
 */
export function createNativeBridge() {
  return {
    async setQueue(tracks, startIndex, autoplay) {
      await CinematicAudio.setQueue({
        tracks: tracks.map(toNativeTrack),
        startIndex,
        autoplay,
      });
    },

    async play() {
      await CinematicAudio.play();
    },

    async pause() {
      await CinematicAudio.pause();
    },

    async stop() {
      await CinematicAudio.stop();
    },

    async seek(positionMs) {
      await CinematicAudio.seekTo({ positionMs: Math.max(0, Math.round(positionMs)) });
    },

    async next() {
      await CinematicAudio.next();
    },

    async previous() {
      await CinematicAudio.previous();
    },

    async getState() {
      return CinematicAudio.getState();
    },

    subscribe(listener) {
      let active = true;
      const handle = CinematicAudio.addListener('playbackState', (event) => {
        if (active) listener(event);
      });
      return () => {
        active = false;
        Promise.resolve(handle)
          .then((registration) => registration.remove())
          .catch(() => {});
      };
    },
  };
}
