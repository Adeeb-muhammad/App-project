/**
 * One consistent inline icon set. Everything inherits `currentColor`, so icons
 * follow text colour and remain crisp at any size. Icons are decorative: the
 * surrounding control always carries an accessible label.
 */

const ICONS = {
  home: '<path d="M4.5 10.4 12 4.2l7.5 6.2V19a1.4 1.4 0 0 1-1.4 1.4h-3.8v-5.6H9.7v5.6H5.9A1.4 1.4 0 0 1 4.5 19z"/>',
  library:
    '<rect x="4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6"/>',
  playlists:
    '<path d="M4 7h9M4 12h9M4 17h5.5"/><path d="M17.5 16.6a2.2 2.2 0 1 0 3.4 1.8V8.4l-3.4.9"/>',
  settings:
    '<path d="M4 7h8M16.5 7H20M4 17h3.5M12 17h8"/><circle cx="14.2" cy="7" r="2.3"/><circle cx="9.7" cy="17" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6 20 20"/>',
  play: '<path d="M8 5.4v13.2l10.8-6.6z" fill="currentColor" stroke-linejoin="round"/>',
  pause:
    '<rect x="7.4" y="5.4" width="3.3" height="13.2" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.3" y="5.4" width="3.3" height="13.2" rx="1.1" fill="currentColor" stroke="none"/>',
  previous:
    '<path d="M7 5.5v13"/><path d="M18.5 6.4v11.2L10 12z" fill="currentColor" stroke-linejoin="round"/>',
  next: '<path d="M17 5.5v13"/><path d="M5.5 6.4v11.2L14 12z" fill="currentColor" stroke-linejoin="round"/>',
  queue:
    '<path d="M4 7h10M4 12h10M4 17h6"/><path d="M16.4 12.6v5.6l4.4-2.8z" fill="currentColor" stroke-linejoin="round"/>',
  shuffle: '<path d="m3 7 2 0c4.7 0 7.3 10 12 10h4"/><path d="m18 14 3 3-3 3"/><path d="M3 17h2c2.1 0 3.7-2.1 5.3-4.4"/><path d="M14 7c1-1 2-2 3-2h4"/><path d="m18 2 3 3-3 3"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  music:
    '<path d="M9 18V6.5l10-2V16"/><circle cx="6.6" cy="18" r="2.4"/><circle cx="16.6" cy="16" r="2.4"/>',
  disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/>',
  folder:
    '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3.2l1.6 2H18.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><path d="M12 7.8h.01"/>',
  sparkles:
    '<path d="m11 4.5 1.5 4.1 4.1 1.5-4.1 1.5L11 15.7 9.5 11.6 5.4 10.1l4.1-1.5z"/><path d="m18.4 15.6.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
};

export function icon(name, { size = 20, className = 'icon' } = {}) {
  const content = ICONS[name] ?? ICONS.disc;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
}
