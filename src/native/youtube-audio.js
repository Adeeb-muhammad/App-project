import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * JavaScript side of "save a YouTube link as MP3".
 *
 * The Kotlin plugin (`YouTubeAudioPlugin`) runs the bundled yt-dlp + FFmpeg,
 * writes an MP3 into app-private storage and resolves with the same payload the
 * document picker resolves with — a `content://` URI plus display metadata — so
 * the result goes straight into the existing import and playback path.
 *
 * The download itself is network-bound and can take minutes; progress arrives as
 * `downloadProgress` events and the promise settles only when the file is ready.
 */

export const YouTubeAudio = registerPlugin('YouTubeAudio');

export const UNSUPPORTED_MESSAGE =
  'Saving YouTube audio needs the Android app. This browser preview cannot download music.';

const FALLBACK_MESSAGE =
  'The download failed. Check the link and your connection, then try again.';

/** Native downloads only exist in the Android Capacitor container. */
export function isDownloadSupported() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** Capacitor rejects with an Error whose message is the sentence we show. */
function failureMessage(error) {
  const text = String(error?.message ?? '')
    .split('\n')[0]
    .trim()
    .slice(0, 200);
  return text || FALLBACK_MESSAGE;
}

/**
 * Downloads `url` and resolves to `{ ok, track }` or `{ ok: false, message }`.
 * Progress is reported through `onProgress({ percent, etaSeconds, line })`.
 */
export async function downloadYouTubeAudio(url, { onProgress } = {}) {
  if (!isDownloadSupported()) {
    return { ok: false, message: UNSUPPORTED_MESSAGE };
  }

  let subscription = null;
  if (typeof onProgress === 'function') {
    subscription = YouTubeAudio.addListener('downloadProgress', (event) => {
      onProgress({
        percent: Math.max(0, Math.min(100, Number(event?.percent) || 0)),
        etaSeconds: Math.max(0, Number(event?.etaSeconds) || 0),
        line: String(event?.line ?? ''),
      });
    });
  }

  try {
    const track = await YouTubeAudio.download({ url: String(url ?? '') });
    return { ok: true, track };
  } catch (error) {
    console.error('[youtube] download failed', error);
    return { ok: false, message: failureMessage(error) };
  } finally {
    Promise.resolve(subscription)
      .then((handle) => handle?.remove?.())
      .catch(() => {});
  }
}
