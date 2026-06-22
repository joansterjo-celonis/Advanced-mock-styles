// ============================================================
//  App view registry — add extra context-area views here.
// ============================================================
//
// registerView() is fully additive. One call creates:
//   • a <section class="view" data-view="…"> in #content
//   • a top tab (.ia-tab) in the context tab bar, before the "+" button
//   • an edit panel (matching the built-in views)
//   • specular-cursor wiring for any [data-card] elements
//   • a refreshed tab order
// …without touching index.html, selectView(), or the tab wiring by hand.
//
// To add a view:
//
//   import { registerView } from './engine.js';
//   registerView({
//     id: 'my-view',                       // unique → data-view="my-view"
//     label: 'My View',                    // tab text
//     icon: '<svg class="icon" …></svg>',  // optional leading icon markup
//     html: '<div class="dash-head"><h1>My View</h1></div>' +
//           '<div class="bento"><div class="card" data-card>' +
//           '  <div class="chart-wrap" data-chart="combo"></div>' +
//           '</div></div>',
//     render(viewEl) { /* optional: post-process the DOM you just injected */ },
//   });
//
// Charts: any element with data-chart="combo|donut|area|dots|pbars|hbars|pie|
// otd-class|otd-hist|otd-dev" renders automatically when the view becomes active
// (and re-renders on every knob change). Counters: add data-counter + data-to.

import { registerView, getViews } from './engine.js';

export { registerView, getViews };

// Concrete views are registered in ./views/*.js and imported below.
import './views/insights.js';
import './views/tracking-analysis.js';
import './views/ocpm-adoption.js';
import './views/ocpm-activity.js';
import './views/ocpm-history.js';
import './views/inventory-cockpit.js';
