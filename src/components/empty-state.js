import { escapeHtml } from '../utils/dom.js';
import { icon } from './icon.js';

/**
 * Shared empty state. Copy explains what will happen later instead of
 * pretending a feature already works.
 */
export function emptyState({ iconName = 'music', title, description, hint = '', action = '' }) {
  return `<div class="empty-state">
    <span class="empty-state__glyph" aria-hidden="true">${icon(iconName, { size: 24 })}</span>
    <h2 class="empty-state__title">${escapeHtml(title)}</h2>
    <p class="empty-state__body">${escapeHtml(description)}</p>
    ${hint ? `<p class="empty-state__hint">${icon('sparkles', { size: 15 })}<span>${escapeHtml(hint)}</span></p>` : ''}
    ${action}
  </div>`;
}
