// Single source of truth for UI icons.
//
// Discoverability over duplication: every icon the chrome uses should live in
// the `icons` map below (the inner markup of a 24x24 viewBox icon). To spot a
// missing/duplicate icon you only have to scan one list.
//
// Two ways to render:
//   - JS that builds markup calls icon(name) (full <svg>) or splices icons[name]
//     into a size-specific <svg> wrapper (for close/search chips etc.).
//   - Static HTML uses a placeholder element with [data-icon="name"]; the boot
//     pass hydrateIcons() swaps it for the rendered <svg>, inheriting the
//     placeholder's class (so .icon / .icon-sm sizing carries over).
//
// Rendering model: icons are stroke-based by default (the global .icon rule
// sets stroke:currentColor; fill:none). Names in FILL render solid instead —
// this is exactly the bug that mangled the old context-menu gear: a solid path
// stroked. Keep one model per icon.

export const icons = {
  // the shared "view" glyph — every context view (Order Management, Purchase
  // Order, Rework & Quality, Insights) uses this one.
  view:     '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  grid:     '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  chevron:  '<path d="M6 9l6 6 6-6"/>',
  close:    '<path d="M6 6l12 12M18 6 6 18"/>',
  search:   '<circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5"/>',
  check:    '<path d="M5 12l5 5 9-9"/>',
  edit:     '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  package:  '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  // stroke-native gear (Lucide) — designed for outline rendering.
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  star:     '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.2l5.9-.8z"/>',
  // appearance toggle glyphs (stroke-native, Lucide)
  moon:     '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
};

// icons that are solid silhouettes rather than strokes
const FILL = new Set(['star']);

// Full <svg> string for a named icon. className defaults to the global .icon
// sizing; pass '' for an unclassed svg (then size via width/height attrs).
export function icon(name, className = 'icon') {
  const inner = icons[name];
  if (inner == null) {
    if (import.meta.env && import.meta.env.DEV) console.warn('[icons] unknown icon:', name);
    return '';
  }
  const cls = className ? ' class="' + className + '"' : '';
  const paint = FILL.has(name) ? ' fill="currentColor" stroke="none"' : ' fill="none"';
  return '<svg' + cls + ' viewBox="0 0 24 24"' + paint + '>' + inner + '</svg>';
}

// Replace static [data-icon="name"] placeholders with the rendered <svg>.
// Inherits the placeholder's explicit class (or data-icon-class) so existing
// sizing classes survive. Idempotent — replaced nodes carry no [data-icon].
export function hydrateIcons(scope = document) {
  scope.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    if (!icons[name]) {
      if (import.meta.env && import.meta.env.DEV) console.warn('[icons] hydrate: unknown icon', name);
      return;
    }
    const cls = el.getAttribute('data-icon-class') || el.getAttribute('class') || 'icon';
    el.outerHTML = icon(name, cls);
  });
}
