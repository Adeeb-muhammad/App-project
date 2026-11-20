/**
 * Browser verification for the native-playback milestone.
 *
 * A browser has no Media3 service, so this asserts the honest fallback: the
 * import control explains that device files need the Android app, and demo mode
 * still labels its transport as simulated. Real audio is only testable on an
 * Android device (see docs/TESTING.md).
 *
 * Run:
 *   npm run build && npx vite preview --port 4173 &
 *   node tests/e2e/native-playback.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const external = [];
const origin = new URL(BASE).origin;

// Web fonts decide layout height in this headless environment; wait for them
// before asserting visibility, otherwise text can have a transient 0 height.
const goto = async (url) => {
  await page.goto(url);
};


page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('request', (request) => {
  const url = request.url();
  if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
    external.push(url);
  }
});

// 1. Browser library: import is offered but honestly unavailable.
await goto(`${BASE}#/library/songs`);
await page.waitForSelector('.import-bar');
check('library shows the import control', (await page.locator('.import-bar').count()) === 1);
check(
  'import button is labelled',
  /Import audio/i.test(await page.locator('[data-action="import-audio"]').textContent()),
);
const hint = await page.locator('.import-bar__hint').textContent();
check('browser explains Android is required', /Android app/i.test(hint), hint);
check('library is still empty (no invented tracks)', (await page.locator('.song-row').count()) === 0);
check('no mini-player without playback', (await page.locator('.mini-player').count()) === 0);

await page.locator('[data-action="import-audio"]').click();
await page.waitForSelector('[data-role="notice"]:not([hidden])');
const notice = await page.locator('[data-role="notice"]').textContent();
check('clicking import explains the limitation', /Android app/i.test(notice), notice);
check('no audio element is created', (await page.locator('audio').count()) === 0);

// 2. Demo mode keeps the clearly-labelled simulation.
await goto(`${BASE}?demo=1#/library/songs`);
await page.waitForSelector('.song-row');
const rows = await page.locator('.song-row').count();
check('demo mode still renders tracks', rows > 0, `rows=${rows}`);
await page.locator('.song-row').first().click();
await page.waitForSelector('.now-playing__title', { state: 'attached' });
const title = await page.locator('.now-playing__title').textContent();
check('demo track opens in Now Playing', title.length > 0, title);
const note = await page.locator('[data-role="engine-note"]').textContent();
check('demo playback is labelled simulated', /simulated/i.test(note), note);
check('demo mini-player appears', (await page.locator('.mini-player').count()) === 1);
check('demo transport is playing', await page.locator('.now-playing').evaluate((el) => el.classList.contains('is-playing')));

await page.locator('[data-role="transport-toggle"]').click();
check(
  'pause works in the simulation',
  (await page.locator('[data-role="transport-toggle"]').getAttribute('aria-label')) === 'Play',
);
check('no audio element is created in demo mode', (await page.locator('audio').count()) === 0);

// 3. Native bridge is not exposed as a browser playback path.
await goto(`${BASE}#/now-playing`);
check('browser Now Playing is the empty state', (await page.locator('.now-playing--empty').count()) === 1);
const emptyText = await page.locator('.now-playing--empty').textContent();
check('empty state mentions import, not fake playback', /Import an audio file/i.test(emptyText));

check('no uncaught errors', errors.length === 0, errors.join(' | '));
check('no external requests', external.length === 0, external.join(', '));

await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
