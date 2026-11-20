import test from 'node:test';
import assert from 'node:assert/strict';
import { artStyle, safeColour, safeImageSrc, safePalette } from '../src/utils/safe.js';
import { escapeHtml } from '../src/utils/dom.js';
import { artwork } from '../src/components/artwork.js';

test('safeColour accepts hex only', () => {
  assert.equal(safeColour('#abc', 'x'), '#abc');
  assert.equal(safeColour('#A78BFA', 'x'), '#A78BFA');
  for (const bad of ['red;background:url(//evil)', 'url(x)', 'expression(1)', '#12', '#gggggg', 7, null, undefined, '#fff;x']) {
    assert.equal(safeColour(bad, 'fb'), 'fb', String(bad));
  }
});

test('artStyle never emits injected CSS', () => {
  const style = artStyle(['red;background:url(//evil)', '"><script>', '#112233']);
  assert.ok(!/evil|script|url\(/.test(style), style);
  assert.equal(safePalette(null).length, 3);
});

test('safeImageSrc allows local assets and rejects remote/script sources', () => {
  assert.equal(safeImageSrc('/artwork/a.svg'), '/artwork/a.svg');
  assert.equal(safeImageSrc('artwork/a.svg'), 'artwork/a.svg');
  assert.equal(safeImageSrc('blob:https://localhost/abc'), 'blob:https://localhost/abc');
  assert.ok(safeImageSrc('data:image/png;base64,AAAA'));
  for (const bad of ['https://evil.test/x.png', 'http://x', '//evil.test/x.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'file:///etc/passwd', '', null, 5, '/a\\b']) {
    assert.equal(safeImageSrc(bad), null, String(bad));
  }
});

test('artwork() escapes hostile titles and falls back without a valid src', () => {
  const html = artwork({ title: '<img src=x onerror=alert(1)>', artwork: 'https://evil.test/a.png', palette: ['red;x'] });
  assert.ok(!html.includes('<img src=x'), html);
  assert.ok(!html.includes('evil.test'), html);
  assert.equal(escapeHtml('<"&\'>'), '&lt;&quot;&amp;&#39;&gt;');
});

test('fallback artwork keeps an emoji initial intact (no lone surrogate)', () => {
  const html = artwork({ title: '😀 Party', palette: [] });
  assert.ok(html.includes('>😀<'), html);
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(html), 'lone high surrogate');
});
