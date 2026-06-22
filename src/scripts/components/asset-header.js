// ============================================================
//  Asset header — the single source of truth for a view's header.
// ============================================================
// Every context view (Order Management, Purchase Order, Rework & Quality,
// Insights, …) renders its title bar (+ optional sub-tabs) through
// buildAssetHeader(). Edit a button, swap an icon, or restructure the bar
// HERE and EVERY view updates — there is no per-view header markup to chase.
//
// Usage:
//   import { buildAssetHeader } from './components/asset-header.js';
//   el.insertAdjacentHTML('afterbegin', buildAssetHeader({
//     title: 'My View',
//     actions: ['filters','layout','edit'],   // optional — this is the default set
//     subtabs: { attr:'data-sub', items:[ { id:'ops', label:'Operations View', on:true }, … ] },
//   }));
//
// Markup-defined views are hydrated from a central config in engine.js
// (MARKUP_HEADERS); registered views (src/scripts/views/*.js) call this directly.

import { icons } from '../icons.js';

// One wrapper recipe for every sized header glyph (stroke-based, like .icon).
const g = (size, sw, inner) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';

// Standard header action buttons. Add or restyle a button once → it applies to
// every view that lists its key in `actions`.
const ACTIONS = {
  filters: '<button class="hbtn">' + g(14, 1.8, '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>') + 'Filters' + g(12, 2, icons.chevron) + '</button>',
  layout:  '<button class="hbtn">' + g(14, 1.8, '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>') + '</button>',
  edit:    '<button class="hbtn edit-btn" title="Edit">' + g(14, 1.8, icons.edit) + '</button>',
};
const DEFAULT_ACTIONS = ['filters', 'layout', 'edit'];

// Sub-tab chrome (drag dots + close + the trailing "add" button) — shared by all views.
const SUBTAB_DOTS = '<span class="dots">' + g(13, 2, '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>') + '</span>';
const SUBTAB_X    = '<span class="x">' + g(11, 2.4, icons.close) + '</span>';
const SUBTAB_ADD  = '<div class="subtab-add">' + g(15, 2, '<path d="M12 5v14M5 12h14"/>') + '</div>';

function buildSubtabs({ attr = 'data-sub', items = [] } = {}) {
  const rows = items
    .map(t => '<div class="subtab' + (t.on ? ' on' : '') + '" ' + attr + '="' + t.id + '">' + t.label + SUBTAB_DOTS + SUBTAB_X + '</div>')
    .join('');
  return '<div class="subtabs">' + rows + SUBTAB_ADD + '</div>';
}

export function buildAssetHeader({ title = '', actions = DEFAULT_ACTIONS, subtabs = null } = {}) {
  const acts = actions.map(a => ACTIONS[a] || '').join('');
  let inner = '<div class="dash-head"><h1>' + title + '</h1><div class="actions">' + acts + '</div></div>';
  if (subtabs && subtabs.items && subtabs.items.length) inner += buildSubtabs(subtabs);
  return '<div class="asset-bar">' + inner + '</div>';
}
