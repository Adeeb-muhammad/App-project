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
  assert.match(plugin, /@CapacitorPlugin\(\s*name = "CinematicAudio",/);
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

test('native playback failures are forwarded instead of swallowed', () => {
  assert.match(plugin, /override fun onPlayerError\(error: PlaybackException\)/);
  assert.match(plugin, /notifyListeners\("playbackError"/);
  assert.match(plugin, /PlaybackErrors\.userMessage/);
  const errors = read('android/app/src/main/java/com/personal/cinematicmusic/PlaybackErrors.kt');
  assert.match(errors, /ERROR_CODE_IO_NO_PERMISSION/);
  assert.match(errors, /ERROR_CODE_IO_FILE_NOT_FOUND/);
  assert.match(errors, /fun userMessage\(errorCode: Int\): String/);
});

test('the plugin builds exactly one MediaController connection', () => {
  const builds = [...plugin.matchAll(/MediaController\.Builder\s*\(/g)].length;
  assert.equal(builds, 1, 'the controller must be created in one place only');
  assert.match(plugin, /pendingController: ListenableFuture<MediaController>\?/);
  assert.match(plugin, /existing\.isConnected/);
  assert.match(plugin, /pendingController\?\.cancel\(true\)/);
});

test('notification permission uses Capacitor and never blocks playback', () => {
  assert.match(plugin, /alias = CinematicAudioPlugin\.NOTIFICATION_ALIAS/);
  assert.match(plugin, /@PluginMethod\s+fun requestNotificationPermission\(call: PluginCall\)/);
  assert.match(plugin, /@PermissionCallback\s+private fun notificationPermissionResult/);
  assert.match(plugin, /requestPermissionForAlias\(NOTIFICATION_ALIAS/);
  assert.match(plugin, /notifyListeners\(\s*"playbackWarning"/);
  assert.ok(
    !/requestPermission[\s\S]{0,200}call\.reject/.test(plugin),
    'a denied notification permission must not reject playback',
  );
  assert.match(read('src/native/native-audio.js'), /requestNotificationPermission\(\)/);
  assert.match(read('src/state/player.js'), /askForNotificationPermission\(\)/);
});

test('metadata extraction leaves the main thread', () => {
  assert.match(plugin, /metadataExecutor\.execute/);
  assert.match(plugin, /canRead\(uri\)/);
});

test('the service only stops itself when playback is not ongoing', () => {
  assert.match(service, /playbackOngoing/);
  assert.match(service, /override fun onPlayerError/);
  assert.match(service, /error\.errorCodeName/);
});

test('the JS player rolls back optimistic state on native failures', () => {
  const js = read('src/state/player.js');
  assert.match(js, /function handleNativeEvent/);
  assert.match(js, /subscribeEvents/);
  assert.match(js, /if \(!accepted\)/);
});

test('Media3 version is pinned in one place', () => {
  assert.match(variables, /media3Version = '1\.\d+\.\d+'/);
  assert.ok(!/media3Version = '1\.8\.0'/.test(gradle), 'no duplicate version literal');
});
