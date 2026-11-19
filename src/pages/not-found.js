import { href } from '../utils/navigation.js';
import { emptyState } from '../components/empty-state.js';

export const notFoundPage = {
  title: 'Not found',
  render() {
    return `<div class="screen">
      <header class="screen-head">
        <p class="eyebrow">Lost signal</p>
        <h1 class="screen-head__title" tabindex="-1">This screen is not here</h1>
      </header>
      ${emptyState({
        iconName: 'info',
        title: 'Route not found',
        description: 'That link does not point anywhere in the prototype. Everything in the app is reachable from Home.',
        action: `<a class="button button--primary" href="${href('/')}">Back home</a>`,
      })}
    </div>`;
  },
};
