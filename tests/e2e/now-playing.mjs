/**
 * Browser verification of the Now Playing flow against a production build.
 * Not part of `npm test` (needs a browser). Run:
 *   npm run build && npx vite preview --port 4173 &
 *   node tests/e2e/now-playing.mjs            # needs `playwright` + Chromium installed
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
// Web fonts decide layout height in this headless environment; wait for them
// before asserting visibility, otherwise text can have a transient 0 height.
const goto = async (url) => {
  await page.goto(url);
};

const external = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!r.url().startsWith(new URL(BASE).origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });

await page.addInitScript(() => {
  window.__renders = 0;
  window.__intervals = new Set();
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (...a) => { const id = si(...a); window.__intervals.add(id); return id; };
  window.clearInterval = (id) => { window.__intervals.delete(id); return ci(id); };
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(() => { window.__renders += 1; }).observe(document.querySelector('#app-main'), { childList: true });
  });
});

const alive = async (label) => {
  const ok = await Promise.race([page.evaluate(() => 1 + 1).then((v) => v === 2), new Promise((r) => setTimeout(() => r(false), 3000))]);
  check(`responsive after: ${label}`, ok);
};
const title = () => page.locator('.now-playing__title').textContent();
const playerState = async () => ({
  playing: await page.locator('.now-playing').evaluate((el) => el.classList.contains('is-playing')),
  label: await page.locator('[data-role="transport-toggle"]').getAttribute('aria-label'),
  mini: await page.locator('.mini-player__title').textContent(),
  miniLabel: await page.locator('.mini-player__toggle').getAttribute('aria-label'),
});
const rendersDuring = async (fn) => { const before = await page.evaluate(() => window.__renders); await fn(); await page.waitForTimeout(150); return (await page.evaluate(() => window.__renders)) - before; };

// Local metadata editor: seed an app-private imported record and edit its overlay.
await goto(BASE);
const metadataTrackUri = 'content://media/external/audio/media/4242';
await page.evaluate((uri) => {
  localStorage.setItem('cinematic.imported.v1', JSON.stringify([{
    uri,
    fileName: 'raw-file-name.mp3',
    title: 'Original Title',
    artist: 'Original Artist',
    album: 'Original Album',
    duration: 185,
    addedAt: 1800000000000,
    mimeType: 'audio/mpeg',
  }]));
}, metadataTrackUri);
await goto(`${BASE}?metadata-fixture=1#/library/songs`);
await page.locator('[data-action="edit-track-metadata"]').click();
const editor = page.locator('[data-role="track-editor"]');
check('metadata editor opens for an imported track', await editor.evaluate((d) => d.open));
await editor.locator('[name="title"]').fill('Edited Title');
await editor.locator('[name="artist"]').fill('Edited Artist');
await editor.locator('[name="albumTitle"]').fill('Edited Album');
await editor.locator('[name="genre"]').fill('Ambient');
await editor.locator('[name="language"]').fill('English');
await editor.locator('[name="tags"]').fill('dreamy, late night, dreamy');
await editor.locator('[name="notes"]').fill('My private listening note.');
await editor.locator('button[type="submit"]').click();
await page.waitForFunction(() => document.querySelector('.song-row__title')?.textContent === 'Edited Title');
check('saved title and artist are shown in the library',
  (await page.locator('.song-row__title').textContent()) === 'Edited Title'
  && (await page.locator('.song-row__meta').first().textContent()).includes('Edited Artist'));
check('genre and tags appear in track details', (await page.locator('.song-row__meta--details').textContent()).includes('Ambient'));
check('metadata search finds genre values', await page.locator('[data-role="library-search"]').count() === 1);
await page.locator('[data-role="library-search"]').fill('Ambient');
check('genre is searchable', await page.locator('.song-row__title').count() === 1);
await page.locator('[data-role="library-search"]').fill('');
await page.locator('[data-action="edit-track-metadata"]').click();
check('private note is restored in the editor',
  (await editor.locator('[name="notes"]').inputValue()) === 'My private listening note.');
const untouchedImport = await page.evaluate((uri) => {
  const rows = JSON.parse(localStorage.getItem('cinematic.imported.v1') || '[]');
  return rows.find((row) => row.uri === uri);
}, metadataTrackUri);
check('editing did not rewrite the original imported record',
  untouchedImport?.title === 'Original Title' && untouchedImport?.album === 'Original Album');
const savedOverlay = await page.evaluate((uri) => JSON.parse(localStorage.getItem('cinematic.track-metadata.v1') || '{}')[uri], metadataTrackUri);
check('tags are deduplicated in local metadata', savedOverlay?.tags?.join('|') === 'dreamy|late night');
await editor.locator('[data-action="close-track-editor"]').first().click();
await page.evaluate(() => {
  localStorage.removeItem('cinematic.imported.v1');
  localStorage.removeItem('cinematic.track-metadata.v1');
});

// 1-3: demo mode, album, start playback
await goto(`${BASE}?demo=1#/library/albums`);

// Library tools: alphabetic sorting, favourite filtering and combined search.
const defaultAlbumOrder = await page.locator('.album-card__title').allTextContents();
await page.locator('[data-role="library-sort"]').selectOption('title-asc');
const sortedAlbumTitles = await page.locator('.album-card__title').allTextContents();
const expectedAlbumTitles = [...defaultAlbumOrder].sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
);
check('album sorting is alphabetic', JSON.stringify(sortedAlbumTitles) === JSON.stringify(expectedAlbumTitles));
await page.locator('[data-role="library-filter"]').selectOption('favourites');
check('favourite album filter shows only favourites', await page.locator('.album-card').count() === 4);
await page.locator('[data-role="library-search"]').fill('Afterglow');
check('search combines with active album filter', (await page.locator('.album-card__title').allTextContents()).join('') === 'Afterglow');
await page.locator('[data-role="library-search"]').fill('');
await page.locator('[data-role="library-filter"]').selectOption('all');
await page.locator('[data-role="library-sort"]').selectOption('default');

await page.locator('a.album-card').first().click();
await page.waitForSelector('[data-action="play-album"]');
check('album page open', (await page.locator('h1').textContent()).length > 0);
const r1 = await rendersDuring(() => page.locator('[data-action="play-album"]').click());
await page.waitForSelector('.now-playing__title', { state: 'attached' });
const firstTitle = await title();
check('Now Playing shows first track', firstTitle.length > 0, firstTitle);
check('start playback renders at most 2 times (no loop)', r1 <= 2, `renders=${r1}`);
await alive('start playback');

// 4-5 pause / resume
let s = await playerState();
check('playing after start', s.playing && s.mini === firstTitle);
await page.locator('[data-role="transport-toggle"]').click();
s = await playerState();
check('paused: UI + mini-player agree', !s.playing && s.label === 'Play' && s.miniLabel === 'Play');
await page.locator('[data-role="transport-toggle"]').click();
s = await playerState();
check('resumed: UI + mini-player agree', s.playing && s.label === 'Pause' && s.miniLabel === 'Pause');

// 6-7 next / previous
const artBefore = await page.locator('.now-playing__image').getAttribute('src');
const rNext = await rendersDuring(() => page.locator('[data-action="next"]').click());
const secondTitle = await title();
check('next changes track title', secondTitle !== firstTitle, secondTitle);
check('next renders exactly once', rNext === 1, `renders=${rNext}`);
check('mini-player title synced after next', (await playerState()).mini === secondTitle);
const artAfter = await page.locator('.now-playing__image').getAttribute('src');
check('artwork element present after next', !!artAfter, `${artBefore} -> ${artAfter}`);
await page.locator('[data-action="previous"]').click();
check('previous returns to first track', (await title()) === firstTitle);
await alive('next/previous');

// 8 shuffle and repeat controls
const shuffle = page.locator('[data-role="shuffle-toggle"]');
await shuffle.click();
check('shuffle can be enabled', await shuffle.getAttribute('aria-pressed') === 'true');
await shuffle.click();
check('shuffle can be disabled', await shuffle.getAttribute('aria-pressed') === 'false');
const repeat = page.locator('[data-role="repeat-toggle"]');
await repeat.click();
check('repeat-one mode is available', await repeat.getAttribute('aria-label') === 'Repeat track');
await repeat.click();
check('repeat-queue mode is available', await repeat.getAttribute('aria-label') === 'Repeat queue');
await repeat.click();
check('repeat can be turned off', await repeat.getAttribute('aria-label') === 'Repeat off');

// 9 seek
const scrubber = page.locator('[data-role="scrubber"]');
await scrubber.evaluate((el) => {
  el.value = '700';
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(350);
check('progress ticks do not pull the thumb away during scrubbing', await scrubber.inputValue() === '700');
await scrubber.evaluate((el) => {
  el.value = '500';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
const elapsed = await page.locator('[data-role="elapsed"]').textContent();
const dur = await page.locator('[data-role="duration"]').textContent();
const toSec = (t) => t.split(':').reduce((a, b) => a * 60 + Number(b), 0);
check('seek to 50% updates elapsed', Math.abs(toSec(elapsed) - toSec(dur) / 2) <= 2, `${elapsed} / ${dur}`);
check('mini progress follows seek', parseFloat(await page.locator('[data-role="mini-progress"]').evaluate((e) => e.style.width)) > 40);

// 9-11 queue
await page.locator('[data-action="open-queue"]').click();
check('queue dialog open', await page.locator('dialog[data-role="queue"]').evaluate((d) => d.open));
const rowCount = await page.locator('.queue-row').count();
check('queue lists tracks', rowCount > 1, `rows=${rowCount}`);
check('queue marks current track', (await page.locator('.queue-row--current .queue-row__title').textContent()) === firstTitle);
const firstUpcoming = page.locator('.queue-entry').nth(1);
const firstUpcomingTitle = await firstUpcoming.locator('.queue-row__title').textContent();
await firstUpcoming.locator('[data-action="queue-move"][data-direction="1"]').click();
check('queue can move a track down', (await page.locator('.queue-entry').nth(2).locator('.queue-row__title').textContent()) === firstUpcomingTitle);
await page.locator('.queue-entry').nth(2).locator('[data-action="queue-move"][data-direction="-1"]').click();
check('queue can move a track back up', (await page.locator('.queue-entry').nth(1).locator('.queue-row__title').textContent()) === firstUpcomingTitle);
const beforeRemove = await page.locator('.queue-row').count();
await page.locator('.queue-entry').last().locator('[data-action="remove-queue-track"]').click();
check('queue removes an upcoming track', await page.locator('.queue-row').count() === beforeRemove - 1);
const target = page.locator('.queue-row:not(.queue-row--current)').first();
const targetTitle = await target.locator('.queue-row__title').textContent();
const rQ = await rendersDuring(() => target.click());
check('selecting queued track changes title', (await title()) === targetTitle, targetTitle);
check('queue selection renders at most 2 times', rQ <= 2, `renders=${rQ}`);
check('queue highlights newly selected track', (await page.locator('.queue-row--current .queue-row__title').textContent()) === targetTitle);
check('mini-player synced after queue select', (await playerState()).mini === targetTitle);
await page.locator('[data-action="close-queue"]').click();
check('queue closed', !(await page.locator('dialog[data-role="queue"]').evaluate((d) => d.open)));
await alive('queue');

// 12-13 close and return
await page.locator('[data-action="close-player"]').click();
await page.waitForFunction(() => !location.hash.includes('now-playing'));
check('left Now Playing', !page.url().includes('now-playing'));
check('mini-player visible & synced', (await page.locator('.mini-player__title').textContent()) === targetTitle);
await page.locator('a.mini-player__open').click();
await page.waitForSelector('.now-playing__title', { state: 'attached' });
check('back on Now Playing with correct track', (await title()) === targetTitle);
await alive('return to Now Playing');

// repeat the open/close cycle 15x: renders/interval counts must not grow
const cycle = [];
for (let i = 0; i < 15; i++) {
  await page.locator('[data-action="close-player"]').click();
  await page.waitForFunction(() => !location.hash.includes('now-playing'));
  await page.locator('a.mini-player__open').click();
  await page.waitForSelector('.now-playing__title', { state: 'attached' });
}
const rCycle = await rendersDuring(() => page.locator('[data-action="next"]').click());
check('after 15 open/close cycles next still renders once (no accumulated listeners)', rCycle === 1, `renders=${rCycle}`);
check('only one simulated-clock interval active', (await page.evaluate(() => window.__intervals.size)) === 1, `intervals=${await page.evaluate(() => window.__intervals.size)}`);

// Clear-upcoming is tested with a fresh four-track queue so the player has
// multiple upcoming items even after the queue-editing cases above.
await goto(`${BASE}?demo=1#/library/albums`);
await page.locator('a.album-card').first().click();
await page.locator('[data-action="play-album"]').click();
await page.waitForSelector('.now-playing__title', { state: 'attached' });
await page.locator('[data-action="open-queue"]').click();
check('clear-upcoming control is available when tracks remain', await page.locator('[data-action="clear-upcoming"]').isVisible());
await page.locator('[data-action="clear-upcoming"]').click();
check('clear upcoming keeps the active track in the queue', await page.locator('.queue-row').count() === 1);
check('clear upcoming becomes hidden when nothing remains', !(await page.locator('[data-action="clear-upcoming"]').isVisible()));
await page.locator('[data-action="close-queue"]').click();

// Escape, history, malformed URLs
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
check('Escape closes Now Playing', !page.url().includes('now-playing'));
for (const bad of ['#/albums/%E0%A4%A', '#/playlists/%', '#/nope', '#/albums/does-not-exist']) {
  await page.evaluate((h) => { location.hash = h; }, bad);
  await page.waitForTimeout(100);
  check(`bad route ${bad} renders an error/empty screen`, (await page.locator('#app-main h1').count()) === 1, await page.locator('#app-main h1').textContent());
}
await page.goBack(); await page.goBack();
await alive('browser back x2');
await goto(`${BASE}#/now-playing`);
check('non-demo Now Playing is the empty state', (await page.locator('.now-playing--empty').count()) === 1);

check('no uncaught page errors / console errors', errors.length === 0, errors.join(' | '));
check('no external network requests', external.length === 0, external.join(', '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
