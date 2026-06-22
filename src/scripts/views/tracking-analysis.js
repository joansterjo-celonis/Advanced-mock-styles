// ============================================================
//  View: Tracking Analysis - PQL editor view
// ============================================================
// A faithful reproduction of the Celonis "Tracking Analysis" PQL-editor
// dashboard (the "Time between events" tab). Registered as a standalone asset
// via the view registry — its header comes from the shared asset-header
// component; its two charts (freqhist / durline) are registered chart builders
// in engine.js so they react to the theme / density / 3D knobs like every
// other chart.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';

/* ---- body svgs ---- */
const CHEV = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>';
const SORT = '<svg class="tr-sort" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 4v16M6 10l6-6 6 6"/></svg>';
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';

/* ---- table builders ---- */
function th(cols) {
  return '<thead><tr>' + cols.map(c => '<th' + (c.num ? ' class="num"' : (c.cls ? ' class="' + c.cls + '"' : '')) + '>' + c.t + '</th>').join('') + '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
}
function tbody(rows, numIdx) {
  const body = rows.map(r =>
    '<tr>' + r.map((cell, i) => '<td' + (numIdx.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + cell + '</td>').join('') + '<td class="tr-kebab"></td></tr>'
  ).join('');
  return '<tbody>' + body + '</tbody>';
}
function table(cols, rows, numIdx) {
  return '<div class="ptable-scroll"><table class="ptable">' + th(cols) + tbody(rows, numIdx) + '</table></div>';
}
// Repeat a row set n times so the tables overflow their scroll container and gain a
// vertical scrollbar (prototype-only padding — real data would already be long enough).
function dup(rows, n) { const out = []; for (let i = 0; i < n; i++) out.push(...rows); return out; }

/* next-after-start-event table */
const nextCols = [
  { t: 'next event after &quot;views.pql-e&hellip;&quot;' }, { t: 'Frequency' + SORT, num: true },
  { t: '%', num: true }, { t: 'avg. duration [sec.]', num: true }, { t: 'median durat&hellip;', num: true },
];
const nextRows = [
  ['views.pql-editor-open.trigger', '5,382,933', '47.94%', '255 s', '1 s'],
  ['views.pql-editor-done-button.trigger', '2,839,449', '25.29%', '28 s', '10 s'],
  ['views.pql-editor-refresh-button.trigger', '2,719,040', '24.21%', '37 s', '15 s'],
  ['-', '237,323', '2.11%', '- s', '- s'],
  ['views.pql-editor-knowledge-base.trigger', '46,682', '0.42%', '37 s', '17 s'],
  ['views.pql-editor-ai-description.trigger', '1,607', '0.01%', '43 s', '22 s'],
  ['views.pql-editor-data-model.trigger', '1,393', '0.01%', '70 s', '19 s'],
];

/* list-of-sessions table */
const sessCols = [
  { t: 'account' }, { t: 'Session ID' }, { t: 'session start' }, { t: '# tracking even&hellip;', num: true },
  { t: 'session length' }, { t: '# selected even&hellip;', num: true }, { t: 'AVG time &hellip;', num: true },
];
const sessRows = [
  ['E.ON SE', '412367', '2026-06-14 14:02', '4', '0 min.', '1', '17 sec.'],
  ['I.R.C.A. SPA Industria', '1238327', '2026-06-14 13:48', '28', '31 min.', '14', '23 sec.'],
  ['Glovoapp23, S.A.', '319195', '2026-06-14 13:30', '14', '19 min.', '8', '14 sec.'],
  ['KME S.r.l', '980774', '2026-06-14 12:55', '21', '40 min.', '8', '140 sec.'],
  ['UPM-Kymmene', '388557', '2026-06-14 12:12', '46', '62 min.', '21', '26 sec.'],
  ['Scania AB', '193368', '2026-06-14 11:40', '4', '1 min.', '2', '33 sec.'],
  ['Dr. ing. h.c. F. Porsche AG', '774769', '2026-06-14 10:58', '112', '120 min.', '49', '250 sec.'],
];

/* accounts table */
const acctCols = [
  { t: 'account' }, { t: '# sessions' + SORT, num: true }, { t: 'avg. session length', num: true },
  { t: '# combinations', num: true }, { t: 'avg. time betwee&hellip;', num: true },
];
const acctRows = [
  ['Allianz Technology SE', '13352', '158 min.', '367289', '48 sec.'],
  ['BMW AG', '12247', '315 min.', '283237', '50 sec.'],
  ['Carl Zeiss AG', '5973', '295 min.', '136611', '54 sec.'],
  ['Pepsico Inc.', '5706', '521 min.', '134104', '47 sec.'],
  ['Dr. ing. h.c. F. Porsche AG', '5629', '165 min.', '115151', '49 sec.'],
  ['Standard Bank Group', '5440', '172 min.', '165723', '55 sec.'],
  ['Santander Global Technology', '5372', '133 min.', '159897', '49 sec.'],
  ['Allstate Insurance Company', '4883', '131 min.', '122471', '40 sec.'],
];

/* KPI strip */
const KPIS = [
  ['Sessions with event views.pql-editor-open.trigger', '31,259'],
  ['Sessions with views.pql-editor-done-button.trigger', '30,020'],
  ['Sessions with this comb.', '26173'],
  ['# of selected event combinations', '5,283,174'],
  ['Avg time between selected start and end event', '49 sec.'],
  ['standard deviation', '136'],
  ['median time between events', '16 sec.'],
  ['# distinct user', '10023'],
];
const kpiCells = KPIS.map(k => '<div class="kpi"><div class="k" title="' + k[0] + '">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>').join('');

const START = 'views.pql-editor-open.trigger';
const END = 'views.pql-editor-done-button.trigger';
const FREQ_X = 'Time between ' + START + ' and ' + END + ' [seconds] &rarr;';

const eventsPanel = '<div class="bento tr-events" data-trcontent="events">' +

  /* row 1 — start event, end event, frequency histogram */
  '<section class="card span-3 tr-evcard" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="tr-evlabel">Select Start Event:</div>' +
    '<div class="tr-evsub">' + START + '</div>' +
    '<div class="tr-select"><span class="tr-seltext">' + START + '</span>' + CHEV + '</div>' +
    '<div class="tr-evfoot">Tracking events: ' + START + '</div>' +
    '<div class="tr-bignum">11,229,054</div>' +
  '</section>' +
  '<section class="card span-3 tr-evcard" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="tr-evlabel">Select End Event:</div>' +
    '<div class="tr-evsub">' + END + '</div>' +
    '<div class="tr-select"><span class="tr-seltext">' + END + '</span>' + CHEV + '</div>' +
    '<div class="tr-evfoot">Tracking events: ' + END + '</div>' +
    '<div class="tr-bignum">6,103,657</div>' +
  '</section>' +
  '<section class="card span-6 metric" data-card style="min-height:230px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="paxis-label">&uarr; Frequency</div>' +
    '<div class="chart-wrap" data-chart="freqhist"></div>' +
    '<div class="tr-xlabel">' + FREQ_X + '</div>' +
  '</section>' +

  /* row 2 — KPI strip (8) */
  '<section class="card span-12 kpi-strip kpi8" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' + kpiCells +
  '</section>' +

  /* row 3 — next-after-start-event + list of sessions */
  '<section class="card span-6" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">next after start event &quot;' + START + '&quot;</div>' +
    table(nextCols, dup(nextRows, 3), [1, 2, 3, 4]) +
  '</section>' +
  '<section class="card span-6" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">List of Sessions <span class="i" tabindex="0" data-tip="Sessions that contain the selected start and end event.">i</span></div>' +
    table(sessCols, dup(sessRows, 3), [3, 5, 6]) +
  '</section>' +

  /* row 4 — time-between-events over time (full width) */
  '<section class="card span-12 metric" data-card style="min-height:320px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="paxis-label">&uarr; Time between ' + START + ' and ' + END + ' [seconds]</div>' +
    '<div class="chart-wrap" data-chart="durline"></div>' +
    '<div class="tr-legend"><span class="tr-legdot"></span> duration</div>' +
    '<div class="tr-xlabel" style="text-align:right;">date &rarr;</div>' +
  '</section>' +

  /* row 5 — accounts (full width, dropped to its own row so the wide table fills the space) */
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">accounts</div>' +
    table(acctCols, dup(acctRows, 3), [1, 2, 3, 4]) +
  '</section>' +
'</div>';

const emptyPanel = '<div class="bento tr-empty" data-trcontent="empty" style="display:none;">' +
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="tr-emptybox">' +
      '<svg class="tr-emico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8M8 17h5"/></svg>' +
      '<div class="tr-emt">Event overview</div>' +
      '<div>This section is not part of the prototype yet.</div>' +
    '</div>' +
  '</section>' +
'</div>';

registerView({
  id: 'tracking-analysis',
  label: 'Tracking Analysis - PQL editor view',
  icon,
  html: buildAssetHeader({
    title: 'Tracking Analysis - PQL editor view',
    // meta icons + the standard Filters/layout/edit buttons come from the shared
    // component; this view only declares its predefined-filter pills.
    pills: [
      { k: 'Predefined filter', v: 'Productive Team Filter', chevron: true },
      { k: 'Extern / Celonaut', v: 'external user', avatar: true },
    ],
    subtabs: {
      attr: 'data-trsub',
      items: [
        { id: 'overview', label: 'Event overview' },
        { id: 'criteria', label: 'Filter criteria' },
        { id: 'details', label: 'further details' },
        { id: 'events', label: 'Time between events', on: true },
        { id: 'events2', label: 'Time between events II' },
      ],
    },
  }) + eventsPanel + emptyPanel,

  render(viewEl) {
    viewEl.classList.add('tr-view');
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-trsub]'));
    const events = viewEl.querySelector('[data-trcontent="events"]');
    const empty = viewEl.querySelector('[data-trcontent="empty"]');
    const emptyTitle = empty && empty.querySelector('.tr-emt');
    tabs.forEach(s => s.addEventListener('click', e => {
      if (e.target.closest('.x') || e.target.closest('.dots')) return; // ignore close / drag affordances
      tabs.forEach(x => x.classList.remove('on'));
      s.classList.add('on');
      const isEvents = s.dataset.trsub === 'events';
      if (events) events.style.display = isEvents ? 'grid' : 'none';
      if (empty) empty.style.display = isEvents ? 'none' : 'grid';
      if (!isEvents && emptyTitle) emptyTitle.textContent = (s.textContent || '').trim();
      if (isEvents && window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
