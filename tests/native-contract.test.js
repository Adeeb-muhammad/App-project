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
const stripKotlinComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const plugin = read('android/app/src/main/java/com/personal/cinematicmusic/CinematicAudioPlugin.kt');
const service = read('android/app/src/main/java/com/personal/cinematicmusic/PlaybackService.kt');
const metadata = read('android/app/src/main/java/com/personal/cinematicmusic/AudioMetadata.kt');
const policy = read('android/app/src/main/java/com/personal/cinematicmusic/PlaybackPolicy.kt');
const mainActivity = read('android/app/src/main/java/com/personal/cinematicmusic/MainActivity.java');
const manifest = stripComments(read('android/app/src/main/AndroidManifest.xml'));
const gradle = read('android/app/build.gradle');
const rootGradle = read('android/build.gradle');
const variables = read('android/variables.gradle');
const workflow = read('.github/workflows/build.yml');

test('the Capacitor plugin is named and registered', () => {
  assert.match(plugin, /@CapacitorPlugin\(\s*name = "CinematicAudio"\s*,?\s*\)/);
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
    'setShuffleEnabled',
    'setRepeatMode',
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
    'android.permission.INTERNET',
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

test('the media notification is never requested at runtime', () => {
  // Media3 posts the notification. A denial only hides it, so prompting or
  // warning about it was noise and has been removed from every layer.
  for (const source of [plugin, read('src/native/native-audio.js'), read('src/state/player.js')]) {
    assert.ok(!/requestNotificationPermission/.test(source), 'no runtime permission request');
    assert.ok(!/askForNotificationPermission/.test(source));
  }
  assert.ok(!/PermissionCallback|requestPermissionForAlias/.test(plugin));
  assert.ok(!/playbackWarning/.test(plugin), 'no advisory warning channel');
  // The permission stays declared so the system may show the notification.
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
});

test('metadata extraction leaves the main thread', () => {
  assert.match(plugin, /metadataExecutor\.execute/);
  assert.match(plugin, /canRead\(uri\)/);
});

test('task removal defers to the Media3 policy instead of a second opinion', () => {
  const serviceCode = stripKotlinComments(service);
  assert.match(serviceCode, /override fun onTaskRemoved/);
  assert.match(serviceCode, /super\.onTaskRemoved\(rootIntent\)/);
  assert.ok(
    !/stopSelf\(\)/.test(serviceCode),
    'the app must not stop the service on its own verdict',
  );
  assert.match(manifest, /android:stopWithTask="false"/);
  assert.match(service, /override fun onPlayerError/);
  assert.match(service, /error\.errorCodeName/);
  assert.match(serviceCode, /PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS/);
  assert.match(serviceCode, /PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY/);
});

test('a reconnected service gets its queue and playback modes back', () => {
  assert.match(plugin, /private var lastItems: List<MediaItem>/);
  assert.match(plugin, /restoreQueueIfNeeded\(/);
  assert.match(plugin, /mediaController\.setMediaItems\(lastItems, lastIndex, lastPositionMs\)/);
  assert.match(plugin, /call\.getLong\("positionMs"\)/);
  assert.match(plugin, /mediaController\.setMediaItems\(items, safeIndex, requestedPositionMs\)/);
  assert.match(plugin, /mediaController\.shuffleModeEnabled = lastShuffleEnabled/);
  assert.match(plugin, /mediaController\.repeatMode = lastRepeatMode/);
  assert.match(plugin, /if \(lastWasPlaying\) mediaController\.play\(\)/);
});

test('the JS player rolls back optimistic state on native failures', () => {
  const js = read('src/state/player.js');
  assert.match(js, /function handleNativeEvent/);
  assert.match(js, /subscribeEvents/);
  assert.match(js, /if \(!accepted\)/);
});

test('YouTube downloads become ordinary local tracks', () => {
  const downloadPlugin = read(
    'android/app/src/main/java/com/personal/cinematicmusic/YouTubeAudioPlugin.kt',
  );
  const urlPolicy = read(
    'android/app/src/main/java/com/personal/cinematicmusic/YouTubeUrlPolicy.kt',
  );
  const js = read('src/native/youtube-audio.js');

  assert.match(mainActivity, /registerPlugin\(YouTubeAudioPlugin\.class\)/);
  assert.match(js, /registerPlugin\('YouTubeAudio'\)/);
  assert.match(downloadPlugin, /@CapacitorPlugin\(name = "YouTubeAudio"\)/);
  assert.match(downloadPlugin, /@PluginMethod\s+fun download\(call: PluginCall\)/);
  // Audio only, converted to MP3 with the bundled FFmpeg.
  assert.match(downloadPlugin, /addOption\("-x"\)/);
  assert.match(downloadPlugin, /addOption\("--audio-format", "mp3"\)/);
  assert.match(downloadPlugin, /YoutubeDL\.getInstance\(\)\.init\(/);
  assert.match(downloadPlugin, /FFmpeg\.getInstance\(\)\.init\(/);
  assert.match(downloadPlugin, /YoutubeDL\.UpdateChannel\.STABLE/);
  assert.match(downloadPlugin, /YoutubeDL\.versionName\(appContext\)/);
  const updaterCall = downloadPlugin.indexOf('refreshYtDlpIfDue(appContext)');
  const executeCall = downloadPlugin.indexOf('YoutubeDL.getInstance().execute(');
  assert.ok(updaterCall >= 0 && executeCall > updaterCall,
    'run the throttled yt-dlp update policy before executing a download');
  assert.match(downloadPlugin, /YtDlpUpdatePolicy\.isCheckDue/);
  assert.match(downloadPlugin, /LAST_UPDATE_CHECK_MS/);
  const updatePolicy = read('android/app/src/main/java/com/personal/cinematicmusic/YtDlpUpdatePolicy.kt');
  assert.match(updatePolicy, /24L \* 60L \* 60L \* 1000L/);
  assert.match(updatePolicy, /nowMs - lastSuccessfulCheckMs >= CHECK_INTERVAL_MS/);
  // The result must reach the player as a content:// URI, never a file path.
  assert.match(downloadPlugin, /FileProvider\.getUriForFile/);
  assert.match(downloadPlugin, /AudioMetadataReader\.read\(/);
  assert.ok(!/setUri\("file:\/\//.test(downloadPlugin));
  // Links are gated by a pure policy the unit tests cover.
  assert.match(urlPolicy, /youtu\.be/);
  assert.match(urlPolicy, /endsWith\("\.youtube\.com"\)/);
  assert.match(variables, /youtubedlAndroidVersion = '\d+\.\d+\.\d+'/);
  assert.match(gradle, /youtubedl-android:library:\$youtubedlAndroidVersion/);
  assert.match(gradle, /youtubedl-android:ffmpeg:\$youtubedlAndroidVersion/);
  assert.match(manifest, /android\.permission\.INTERNET/);
});

test('Media3 version is pinned in one place', () => {
  assert.match(variables, /media3Version = '1\.\d+\.\d+'/);
  assert.ok(!/media3Version = '1\.8\.0'/.test(gradle), 'no duplicate version literal');
});

test('MediaController is pinned to main and controller work is marshalled there', () => {
  assert.ok(plugin.includes('private fun dispatchToControllerThread'));
  assert.ok(plugin.includes('.setApplicationLooper(Looper.getMainLooper())'));
  assert.ok(plugin.includes('private fun withController(') && plugin.includes('dispatchToControllerThread {'));
  const connectionCallback = plugin.slice(plugin.indexOf('future.addListener'), plugin.indexOf('ContextCompat.getMainExecutor(context)', plugin.indexOf('future.addListener')));
  assert.ok(connectionCallback.indexOf('block(connected)') < connectionCallback.indexOf('controller = mediaController'), 'do not cache a controller until its first command succeeds');
  const stopBody = plugin.slice(plugin.indexOf('fun stop'), plugin.indexOf('fun seekTo'));
  assert.ok(stopBody.includes('dispatchToControllerThread {'));
  const getStateBody = plugin.slice(plugin.indexOf('fun getState'), plugin.indexOf('// ------------------------------------------------------------ connection'));
  assert.ok(getStateBody.includes('withController(call, restoreQueue = false)'));
  assert.ok(!getStateBody.includes('restoreQueue = true'));
});

test('Android APK inspection permits downloader INTERNET and checks the scoped provider', () => {
  assert.ok(workflow.includes('android.permission.INTERNET'));
  assert.ok(workflow.includes('androidx.core.content.FileProvider'));
  assert.ok(workflow.includes('android.support.FILE_PROVIDER_PATHS'));
  assert.ok(!workflow.includes('! echo "$TREE" | grep -q "FileProvider"'));
});

test('YouTube download admission is atomic under concurrent calls', () => {
  const downloadPlugin = read('android/app/src/main/java/com/personal/cinematicmusic/YouTubeAudioPlugin.kt');
  assert.ok(downloadPlugin.includes('AtomicBoolean'));
  assert.ok(downloadPlugin.includes('compareAndSet(false, true)'));
  assert.ok(downloadPlugin.includes('downloadInProgress.set(false)'));
});