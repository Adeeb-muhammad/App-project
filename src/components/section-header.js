import { escapeHtml } from '../utils/dom.js';
import { href } from '../utils/navigation.js';

export function sectionHeader({ title, hrefPath = null, actionLabel = 'See all' }) {
  return `<div class="section-header">
    <h2 class="section-header__title">${escapeHtml(title)}</h2>
    ${hrefPath ? `<a class="section-header__link" href="${escapeHtml(href(hrefPath))}">${escapeHtml(actionLabel)}</a>` : ''}
  </div>`;
}
