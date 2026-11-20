/**
 * Tiny DOM helpers shared by the shell and the pages.
 * Everything is plain DOM — there is no framework and no virtual DOM.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes a value for safe interpolation into an HTML template string.
 * Every piece of data shown in the UI goes through this, even demo data.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Attaches a delegated listener. Returns an unsubscribe function.
 */
export function delegate(root, type, selector, handler) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!target || !root.contains(target)) return;
    handler(event, target);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

export function setText(root, selector, text) {
  const node = qs(selector, root);
  if (node) node.textContent = text;
}

export function setAttribute(root, selector, name, value) {
  const node = qs(selector, root);
  if (node) node.setAttribute(name, value);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
