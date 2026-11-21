import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Source-level guard for the privacy policy in docs/SECURITY.md. It checks the
 * checked-in Android files, so it runs anywhere (no Android SDK needed). It does
 * NOT replace inspecting the built APK, which CI does separately.
 */
const read = (path) => readFileSync(new URL(`../android/app/src/main/${path}`, import.meta.url), 'utf8');
const stripComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, '');

const manifest = stripComments(read('AndroidManifest.xml'));
const rules = stripComments(read('res/xml/data_extraction_rules.xml'));

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref'];

function section(name) {
  const match = rules.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  assert.ok(match, `<${name}> section missing`);
  return match[1];
}

test('manifest disables backup and points at data extraction rules', () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
});

test('both backup mechanisms exclude every domain and include nothing', () => {
  assert.ok(!/<include\b/.test(rules), 'no <include> allowed');
  for (const name of ['cloud-backup', 'device-transfer']) {
    const body = section(name);
    for (const domain of DOMAINS) {
      assert.match(body, new RegExp(`<exclude domain="${domain}" path="\\."\\s*/>`), `${name} must exclude ${domain}`);
    }
  }
});

test('source manifest requests media permissions only, no storage access and no FileProvider', () => {
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
  assert.match(manifest, /android:name="\.PlaybackService"/);
  assert.match(manifest, /android:foregroundServiceType="mediaPlayback"/);
});

test('the only FileProvider exposes one app-private download folder', () => {
  const providers = [...manifest.matchAll(/<provider[\s\S]*?<\/provider>/g)].map((match) => match[0]);
  assert.equal(providers.length, 1, 'exactly one provider should exist');
  const provider = providers[0];
  assert.match(provider, /androidx\.core\.content\.FileProvider/);
  assert.match(provider, /android:authorities="\$\{applicationId\}\.downloads"/);
  assert.match(provider, /android:exported="false"/);
  assert.match(provider, /@xml\/download_paths/);

  const paths = read('res/xml/download_paths.xml');
  assert.ok(!/external-path|external-files-path|root-path/.test(paths), 'never expose external storage');
  assert.match(paths, /<files-path[^>]*path="downloads\/"/);
  assert.ok(!existsSync(new URL('../android/app/src/main/res/xml/file_paths.xml', import.meta.url)));
});

test('Android versionName is read from package.json (single source of truth)', () => {
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /file\('\.\.\/\.\.\/package\.json'\)/);
  assert.match(gradle, /versionName appVersionName/);
  assert.ok(!/versionName\s+"/.test(gradle), 'no hard-coded versionName');
});
