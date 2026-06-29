// ============================================================
//  View: Incident Details  (slide-over detail drawer)
// ============================================================
// The detail half of the Incident Management master/detail pair. It is a normal
// registered view (so the slide-over machinery can move it into a right-side
// sliding drawer) but ships WITHOUT a top tab — it only ever appears when an
// Incident List row link is clicked. The master view dispatches an
// `incident:select` CustomEvent carrying the chosen incident's record; this view
// listens for it, repaints its attributes / KPIs / SLA + activity tables, and
// re-runs the shared counters. Reuses the shared asset header, .bento / .card,
// .kpi-strip and .ptable so it inherits every theme / density / layout knob.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';

/* ---- svg helpers (same family as the other asset views) ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const DL = s(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
const SORT = '<svg class="tr-sort" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 4v16M6 10l6-6 6 6"/></svg>';
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';
const info = '<span class="inc-i">i</span>';

/* ---- canonical default (matches the supplied screenshot: INC7853471) ---- */
const DEFAULT = {
  number: 'INC7853471', priority: '2 - High', category: 'Software', subcategory: 'Access Request',
  assignmentGroup: 'Level 3 - Network Operations', assignedTo: 'Amber Gray', state: 'In Progress',
  kpis: { slaMet: '0', resolutionTime: '0.2', timesReopened: '0', linkedToProblem: '0' },
  slaRecords: [
    ['2 - High Priority', 'Response', 'completed', '127 %', '2026-05-04 15:24', '2026-05-04 15:54'],
    ['2 - High Priority', 'Resolution', 'completed', '64 %', '2026-05-04 15:24', '2026-05-05 09:24'],
  ],
  activity: [
    ['2026-05-04 16:36', '-', '-', '-', '-'],
    ['2026-05-04 15:24', '-', '-', '-', '-'],
    ['2026-05-04 15:24', '-', '-', '-', '-'],
    ['2026-05-04 15:24', '-', '-', '-', '-'],
    ['2026-05-04 15:24', 'assignment_group', 'Level 1 Service Desk', 'Level 2 Service Desk Onsite', 'Richard Thompson'],
    ['2026-05-04 15:24', 'escalation', '0', '1', 'Richard Thompson'],
    ['2026-05-04 15:24', 'assignment_group', 'Level 2 Service Desk Onsite', 'Level 3 - Network Operations', 'Amber Gray'],
    ['2026-05-04 15:24', 'assigned_to', 'Richard Thompson', 'Amber Gray', 'Amber Gray'],
    ['2026-05-04 15:24', 'priority', '3 - Moderate', '2 - High', 'Richard Thompson'],
    ['2026-05-04 15:23', 'state', 'New', 'In Progress', 'Richard Thompson'],
    ['2026-05-04 15:23', 'opened', '-', 'INC7853471', 'System'],
  ],
};

/* ---- KPI strip (4 hero cells) ---- */
// Numerals carry data-counter so they count-up and obey the KPI weight/font knob;
// data-k tags each so a row click can repoint data-to + re-animate. The unit (%, d, #)
// lives in the label text as "[unit]" (matching the shell's "Net Order Value [EUR]"
// convention); SLA Met still renders the percent inside the numeral via data-suffix.
function kpiCell(label, k, opts) {
  opts = opts || {};
  const suf = opts.suffix ? ' data-suffix="' + opts.suffix + '"' : '';
  const dec = opts.decimals ? ' data-decimals="' + opts.decimals + '"' : '';
  const lbl = opts.unit ? label + ' [' + opts.unit + ']' : label;
  return '<div class="kpi"><div class="k">' + lbl + (opts.info ? info : '') + '</div>' +
    '<div class="v"><span data-counter data-k="' + k + '" data-to="0"' + dec + suf + '>0</span></div></div>';
}
const kpiStrip =
  '<section class="card span-12 kpi-strip kpi4" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' +
    kpiCell('SLA Met', 'slaMet', { info: true, decimals: 1, suffix: '%', unit: '%' }) +
    kpiCell('Resolution Time', 'resolutionTime', { decimals: 1, unit: 'd' }) +
    kpiCell('Times Reopened', 'timesReopened', { unit: '#' }) +
    kpiCell('Linked to Problem', 'linkedToProblem', { info: true, unit: '#' }) +
  '</section>';

/* ---- Incident Attributes (left column) ---- */
const ATTRS = [
  ['Number', 'number'], ['Priority', 'priority'], ['Category', 'category'], ['Subcategory', 'subcategory'],
  ['Assignment Group', 'assignmentGroup'], ['Assigned To', 'assignedTo'], ['State', 'state'],
];
function attrsHtml(d) {
  return ATTRS.map(a => '<div class="inc-attr"><div class="k">' + a[0] + '</div>' +
    '<div class="v" data-a="' + a[1] + '">' + d[a[1]] + '</div></div>').join('');
}

/* ---- tables (shared .ptable look) ---- */
function thRow(cols) {
  return '<thead><tr>' + cols.map(c => '<th' + (c.num ? ' class="num"' : '') + '>' + c.t + '</th>').join('') +
    '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
}
function bodyRows(rows, numIdx) {
  numIdx = numIdx || [];
  return rows.map(r => '<tr>' + r.map((c, i) => '<td' + (numIdx.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + c + '</td>').join('') +
    '<td class="tr-kebab"></td></tr>').join('');
}
const SLA_COLS = [{ t: 'SLA Name' }, { t: 'SLA Type' }, { t: 'Stage' + info }, { t: 'Business % Elapsed', num: true }, { t: 'Start Time' }, { t: 'Planned End Time' }];
const ACT_COLS = [{ t: SORT + 'Changed At' }, { t: 'Field Changed' }, { t: 'Old Value' }, { t: 'New Value' }, { t: 'Changed By' }];

const slaTable = '<div class="ptable-scroll" style="max-height:180px;"><table class="ptable">' + thRow(SLA_COLS) +
  '<tbody data-slabody>' + bodyRows(DEFAULT.slaRecords, [3]) + '</tbody></table></div>';
const actTable = '<div class="ptable-scroll"><table class="ptable">' + thRow(ACT_COLS) +
  '<tbody data-actbody>' + bodyRows(DEFAULT.activity) + '</tbody></table></div>';

/* ---- detail band: attributes (left) | SLA Records over Related Problem (right) ---- */
// Two tracks: the tall attribute list on the left, and a stacked column on the right
// where SLA Records sits above Related Problem. The Related Problem card flex-grows to
// soak up the slack so the right track bottom-aligns with the attributes — no dead gap.
const cols =
  '<div class="inc-cols">' +
    '<section class="card" data-card>' +
      '<span class="gloss"></span><span class="rim"></span>' +
      '<div class="card-title">Incident Attributes</div>' +
      '<div class="inc-attrs" data-attrs>' + attrsHtml(DEFAULT) + '</div>' +
    '</section>' +
    '<div class="inc-col">' +
      '<section class="card" data-card>' +
        '<span class="gloss"></span><span class="rim"></span>' +
        '<div class="ocpm-cardhead"><div class="card-title">SLA Records</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
        slaTable +
      '</section>' +
      '<section class="card" data-card>' +
        '<span class="gloss"></span><span class="rim"></span>' +
        '<div class="card-title">Related Problem</div>' +
        '<div class="inc-empty">No related problem linked to this incident.</div>' +
      '</section>' +
    '</div>' +
  '</div>';

/* ---- activity table (full-width) ---- */
const activity =
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="inc-tools">' + DL + KEBAB + '</div>' +
    actTable +
  '</section>';

const dashboard =
  '<div class="bento inc-detail" data-fixed>' +
    kpiStrip + cols + activity +
  '</div>';

registerView({
  id: 'incident-details',
  label: 'Incident Details',
  icon,
  // Drawer-only: revealed solely by clicking an Incident List row (it slides in as a
  // right-side drawer), so it gets no sidebar leaf and no tab. Registered views never
  // auto-open a tab anyway; addLeaf:false also keeps it out of the left nav.
  addLeaf: false,
  // Drawer-only header: no meta cluster, no action buttons — the slide-over's own
  // close button is the sole top-right control (see slide-over.css).
  html: buildAssetHeader({ title: 'Incident Details', meta: [], actions: [] }) + dashboard,

  render(viewEl) {
    viewEl.classList.add('inc-detail-view');

    const setText = (sel, val) => { const el = viewEl.querySelector(sel); if (el) el.textContent = val; };
    const setKpi = (k, val) => { const el = viewEl.querySelector('[data-k="' + k + '"]'); if (el) el.dataset.to = val; };

    function paint(d) {
      ATTRS.forEach(a => setText('[data-a="' + a[1] + '"]', d[a[1]]));
      const kp = d.kpis || {};
      setKpi('slaMet', kp.slaMet || '0');
      setKpi('resolutionTime', kp.resolutionTime || '0');
      setKpi('timesReopened', kp.timesReopened || '0');
      setKpi('linkedToProblem', kp.linkedToProblem || '0');
      const slaBody = viewEl.querySelector('[data-slabody]');
      if (slaBody) slaBody.innerHTML = bodyRows(d.slaRecords || [], [3]);
      const actBody = viewEl.querySelector('[data-actbody]');
      if (actBody) actBody.innerHTML = bodyRows(d.activity || []);
      if (window.IA && window.IA.runCounters) window.IA.runCounters(viewEl);
    }

    // The master view (Incident List) drives this pane through a CustomEvent so
    // the two stay fully decoupled — this view never imports the master's data.
    document.addEventListener('incident:select', e => { if (e.detail) paint(e.detail); });
  },
});
