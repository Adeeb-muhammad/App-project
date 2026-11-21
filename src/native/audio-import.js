import { CinematicAudio, isAndroidNative } from './native-audio.js';
import { normaliseImportedTrack } from '../data/imported.js';

export const UNSUPPORTED_MESSAGE =
  'Choosing device audio uses Android’s system file picker. Open the Android app to import music — the browser preview cannot read local files.';

/**
 * Opens the Storage Access Framework picker and turns the result into a
 * library track. The Kotlin plugin takes the persistable read permission before
 * resolving, so the URI stays playable after the app restarts.
 */
export async function pickAudioTrack() {
  if (!isAndroidNative()) {
    return { ok: false, reason: 'unsupported', message: UNSUPPORTED_MESSAGE };
  }

  try {
    const result = await CinematicAudio.pickAudio();
    const track = normaliseImportedTrack(result);
    if (!track) {
      return {
        ok: false,
        reason: 'invalid',
        message: 'That file does not look like readable audio. Try a different file.',
      };
    }
    return { ok: true, track };
  } catch (error) {
    console.error('[import] picker failed', error);
    if (/cancel/i.test(String(error?.message ?? ''))) {
      return { ok: false, reason: 'cancelled', message: '' };
    }
    return {
      ok: false,
      reason: 'error',
      message: 'The file could not be opened. Check that it is an audio file on this device.',
    };
  }
}
