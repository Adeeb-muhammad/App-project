import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Source-level contract checks for the native vertical slice. They cannot prove
 * Media3 works, but they do fail if the bridge, service declaration, SAF flow
 * or no-storage-permission policy is accidentally removed.
 */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const stripComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, '');

const plugin = read('android/app/src/main/java/com/personal/cinematicmusic/CinematicAudioPlugin.kt');
const service = read('android/app/src/main/java/com/personal/cinematicmusic/PlaybackService.kt');
const metadata = read('android/app/src/main/java/com/personal/cinematicmusic/AudioMetadata.kt');
const policy = read('android/app/src/main/java/com/personal/cinematicmusic/PlaybackPolicy.kt');
const mainActivity = read('android/app/src/main/java/com/personal/cinematicmusic/MainActivity.java');
const manifest = stripComments(read('android/app/src/main/AndroidManifest.xml'));
const gradle = read('android/app/build.gradle');
const rootGradle = read('android/build.gradle');
const variables = read('android/variables.gradle');

test('the Capacitor plugin is named and registered', () => {
  assert.match(plugin, /@CapacitorPlugin\(name = "CinematicAudio"\)/);
  assert.match(mainActivity, /registerPlugin\(CinematicAudioPlugin\.class\)/);
  const js = read('src/native/native-audio.js');
  assert.match(js, /registerPlugin\('CinematicAudio'\)/);
});

test('every method the JS bridge calls exists on the Kotlin plugin', () => {
  const methods = [
    'pickAudio',
    'setQueue',
    'play',
    'pause',
    'stop',
    'seekTo',
    'next',
    'previous',
    'getState',
  ];
  for (const method of methods) {
    assert.match(plugin, new RegExp(`@PluginMethod\\s+fun ${method}\\(`), `${method} missing`);
  }
});

test('file selection uses ACTION_OPEN_DOCUMENT and keeps read access', () => {
  assert.match(plugin, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(plugin, /Intent\.CATEGORY_OPENABLE/);
  assert.match(plugin, /type = "audio\/\*"/);
  assert.match(plugin, /FLAG_GRANT_PERSISTABLE_URI_PERMISSION/);
  assert.match(plugin, /takePersistableUriPermission/);
  assert.match(plugin, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.ok(metadata.includes('MediaMetadataRetriever'));
});

test('playback runs in a MediaSessionService with Media3 ExoPlayer', () => {
  assert.match(service, /class PlaybackService : MediaSessionService\(\)/);
  assert.match(service, /ExoPlayer\.Builder/);
  assert.match(service, /MediaSession\.Builder/);
  assert.match(service, /onGetSession/);
  assert.match(manifest, /android:name="\.PlaybackService"/);
  assert.match(manifest, /android:foregroundServiceType="mediaPlayback"/);
  assert.match(manifest, /androidx\.media3\.session\.MediaSessionService/);
  assert.match(gradle, /androidx\.media3:media3-exoplayer/);
  assert.match(gradle, /androidx\.media3:media3-session/);
  assert.match(rootGradle, /kotlin-gradle-plugin/);
  assert.match(gradle, /apply plugin: 'kotlin-android'/);
});

test('only media playback permissions are requested, never storage access', () => {
  const permissions = [...manifest.matchAll(/<uses-permission[^>]*>/g)]
    .filter((match) => !match[0].includes('tools:node="remove"'))
    .map((match) => match[0].match(/android:name="([^"]+)"/)[1])
    .sort();
  assert.deepEqual(permissions, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.WAKE_LOCK',
  ]);
  for (const forbidden of [
    'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE',
    'READ_MEDIA_AUDIO',
    'MANAGE_EXTERNAL_STORAGE',
  ]) {
    assert.ok(!manifest.includes(forbidden), `${forbidden} must not be requested`);
  }
});

test('playback policy rejects non-content URIs and clamps queue indices', () => {
  assert.match(policy, /startsWith\("content:\/\/"/);
  assert.match(policy, /requested >= size -> size - 1/);
  const js = read('src/data/imported.js');
  assert.match(js, /\/\^content:\\\/\\\/\/i/);
});

test('Media3 version is pinned in one place', () => {
  assert.match(variables, /media3Version = '1\.\d+\.\d+'/);
  assert.ok(!/media3Version = '1\.8\.0'/.test(gradle), 'no duplicate version literal');
});
