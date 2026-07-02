// ============================================================
//  Asset header — the single source of truth for a view's header.
// ============================================================
// Every context view (Order Management, Rework & Quality,
// Insights, Tracking Analysis, OCPM, …) renders its title bar (+ optional
// sub-tabs) through buildAssetHeader(). Edit a button, swap an icon, or
// restructure the bar HERE and EVERY view updates — there is no per-view
// header markup to chase.
//
// Anatomy of the bar (left → right):
//   .dash-head
//     .dh-title   →  <h1>title</h1> + meta icons (bookmark / share / comments / more)
//     .actions    →  filter pills  THEN  action buttons (filters / layout / edit)
//   .subtabs      →  optional sub-tab strip (+ optional trailing controls)
//
// Usage:
//   import { buildAssetHeader } from './components/asset-header.js';
//   el.insertAdjacentHTML('afterbegin', buildAssetHeader({
//     title: 'My View',
//     // meta:    defaults to ['bookmark','share','comments','more']; pass [] to hide,
//     //          or mix raw HTML + keys, e.g. ['<span>5 days</span>','bookmark','more']
//     // pills:   [{ k:'Predefined filter', v:'Team Filter', chevron:true },
//     //           { k:'Extern', v:'external user', avatar:true }]   (default: none)
//     // actions: ['filters','layout','edit']  → rendered AFTER the pills
//     //          (unknown entries are treated as raw HTML, e.g. a bell button)
//     subtabs: { attr:'data-sub', items:[ { id:'ops', label:'Operations', on:true }, … ],
//                trailing:'<div>…</div>' /* optional: replaces the "+" add button */ },
//   }));
//
// Markup-defined views are hydrated from a central config in engine.js
// (MARKUP_HEADERS); registered views (src/scripts/views/*.js) call this directly.

import { icons } from '../icons.js';

// One wrapper recipe for every sized header glyph (stroke-based, like .icon).
const g = (size, sw, inner) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
// Filled variant (bookmark / kebab dots read better solid).
const gf = (size, inner) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor">' + inner + '</svg>';

// ---- Title-side meta icons (the bookmark / share / comments / more cluster) ----
// Decorative by default; one definition, shared by every view.
const META = {
  bookmark: '<span class="dh-ic" title="Bookmark">' + gf(15, '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-3.8L5 21V4a1 1 0 0 1 1-1z"/>') + '</span>',
  share:    '<span class="dh-ic" title="Share">'    + g(15, 1.8, '<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8"/>') + '</span>',
  comments: '<span class="dh-ic" title="Comments">' + g(15, 1.8, '<path d="M4 5h16v11H9l-4 4V5z"/>') + '</span>',
  more:     '<span class="dh-ic" title="More">'     + gf(15, '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>') + '</span>',
};
const DEFAULT_META = ['bookmark', 'share', 'comments', 'more'];

// ---- Standard header action buttons (rendered AFTER any filter pills) ----
// Add or restyle a button once → it applies to every view that lists its key.
const ACTIONS = {
  filters: '<button class="hbtn">' + g(14, 1.8, '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>') + 'Filters' + g(12, 2, icons.chevron) + '</button>',
  // the panel/split button toggles a view's right-hand filter drawer (.ocpm2-fbar) where one
  // exists; .fbar-btn is wired once, globally, in engine.js (like .edit-btn).
  layout:  '<button class="hbtn fbar-btn" title="Toggle filter bar">' + g(14, 1.8, '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>') + '</button>',
  edit:    '<button class="hbtn edit-btn" title="Edit">' + g(14, 1.8, icons.edit) + '</button>',
};
const DEFAULT_ACTIONS = ['filters', 'layout', 'edit'];

// ---- Predefined-filter pills (two-line: small label + bold value) ----
const PILL_CHEV = g(11, 2.4, '<path d="m6 9 6 6 6-6"/>');
function buildPill(p) {
  if (typeof p === 'string') return p;                       // allow a raw-HTML pill
  const av = p.avatar ? '<span class="hp-av"></span>' : '';
  const chev = p.chevron ? PILL_CHEV : '';
  return '<div class="hpill"><span class="hp-k">' + (p.k || '') + '</span>' +
         '<span class="hp-v">' + av + (p.v || '') + chev + '</span></div>';
}

// ---- Sub-tab chrome (drag dots + close + trailing "add") — shared by all views ----
const SUBTAB_DOTS = '<span class="dots">' + g(13, 2, '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>') + '</span>';
const SUBTAB_X    = '<span class="x">' + g(11, 2.4, icons.close) + '</span>';
const SUBTAB_ADD  = '<div class="subtab-add">' + g(15, 2, '<path d="M12 5v14M5 12h14"/>') + '</div>';

function buildSubtabs({ attr = 'data-sub', items = [], trailing = null } = {}) {
  const rows = items
    .map(t => '<div class="subtab' + (t.on ? ' on' : '') + '" ' + attr + '="' + t.id + '">' + t.label + SUBTAB_DOTS + SUBTAB_X + '</div>')
    .join('');
  // `trailing` (raw HTML) replaces the default "add" button — lets a view supply its own
  // tab-strip controls (e.g. overflow ‹ › navigation) instead of the "+".
  return '<div class="subtabs">' + rows + (trailing != null ? trailing : SUBTAB_ADD) + '</div>';
}

export function buildAssetHeader({ title = '', meta = DEFAULT_META, pills = [], actions = DEFAULT_ACTIONS, subtabs = null } = {}) {
  // meta: known keys → icon; unknown entries → raw HTML (e.g. an "age" badge).
  const metaHtml = meta.map(m => (m in META ? META[m] : m)).join('');
  // .actions = filter pills first, then the action buttons, next to each other.
  // known action keys → standard button; unknown → raw HTML (e.g. a bell / blue button).
  const pillsHtml = pills.map(buildPill).join('');
  const actsHtml = actions.map(a => (a in ACTIONS ? ACTIONS[a] : a)).join('');

  const titlePart = metaHtml
    ? '<div class="dh-title"><h1>' + title + '</h1>' + metaHtml + '</div>'
    : '<h1>' + title + '</h1>';

  let inner = '<div class="dash-head">' + titlePart + '<div class="actions">' + pillsHtml + actsHtml + '</div></div>';
  if (subtabs && subtabs.items && subtabs.items.length) inner += buildSubtabs(subtabs);
  return '<div class="asset-bar">' + inner + '</div>';
}
