// ============================================================
//  View: Incident Management  (master dashboard)
// ============================================================
// Faithful reproduction of the "Incident Management" dashboard: a hero header,
// two hero KPIs (Open Incidents · Avg Resolution Time), an "Incidents by
// Assignment Group" horizontal-bar chart (the generic data-driven `hbarcat`
// builder, so it reacts to the theme / density / 3D knobs) and an Incident List
// table. Each incident number is a link: clicking it reveals the tabless
// "Incident Details" view as a right-side slide-over drawer (window.IA.openSlideOver)
// and pushes the chosen incident's record to it via an `incident:select` CustomEvent.
//
// This file is the single owner of the incident data; Incident Details stays a
// dumb renderer that paints whatever record it receives.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';
const info = '<span class="inc-i">i</span>';

/* ============ incident data ============ */
const GROUPS = ['Level 1 Service Desk', 'Level 2 Service Desk Onsite', 'Level 3 - Network Operations', 'Level 3 - Hardware Support', 'Level 3 - Software Support', 'Level 3 - Security Operations', 'Level 3 - Database Administration'];
const PEOPLE = ['Amber Gray', 'Richard Thompson', 'Nadia Khan', 'Marco Reyes', 'Lena Fischer'];
const STATES = ['In Progress', 'On Hold', 'New'];
const SUBCATS = { Software: 'Access Request', Hardware: 'Peripheral', Network: 'Connectivity' };

// The master Incident List (incident number · priority · category) — INC7853471
// is the record captured in the source screenshot.
const ROWS = [
  ['INC8801452', '3 - Moderate', 'Software'],
  ['INC5590503', '3 - Moderate', 'Hardware'],
  ['INC8632249', '3 - Moderate', 'Hardware'],
  ['INC6003937', '2 - High', 'Network'],
  ['INC6822236', '2 - High', 'Software'],
  ['INC2466389', '2 - High', 'Network'],
  ['INC7853471', '2 - High', 'Software'],
  ['INC8670815', '2 - High', 'Hardware'],
  ['INC9217071', '2 - High', 'Network'],
  ['INC4412900', '3 - Moderate', 'Software'],
  ['INC7782013', '1 - Critical', 'Network'],
  ['INC3098551', '2 - High', 'Hardware'],
];

/* deterministic hash so every incident gets stable, varied detail data */
function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function activityFor(d) {
  return [
    ['2026-05-04 16:36', '-', '-', '-', '-'],
    ['2026-05-04 15:24', '-', '-', '-', '-'],
    ['2026-05-04 15:24', '-', '-', '-', '-'],
    ['2026-05-04 15:24', '-', '-', '-', '-'],
    ['2026-05-04 15:24', 'assignment_group', 'Level 1 Service Desk', 'Level 2 Service Desk Onsite', 'Richard Thompson'],
    ['2026-05-04 15:24', 'escalation', '0', '1', 'Richard Thompson'],
    ['2026-05-04 15:24', 'assignment_group', 'Level 2 Service Desk Onsite', d.assignmentGroup, d.assignedTo],
    ['2026-05-04 15:24', 'assigned_to', 'Richard Thompson', d.assignedTo, d.assignedTo],
    ['2026-05-04 15:24', 'priority', '3 - Moderate', d.priority, 'Richard Thompson'],
    ['2026-05-04 15:23', 'state', 'New', d.state, 'Richard Thompson'],
    ['2026-05-04 15:23', 'opened', '-', d.number, 'System'],
  ];
}

function detailFor(number, priority, category) {
  // Canonical record — pixel-matches the supplied screenshot.
  if (number === 'INC7853471') {
    const d = { number, priority, category, subcategory: 'Access Request', assignmentGroup: 'Level 3 - Network Operations', assignedTo: 'Amber Gray', state: 'In Progress',
      kpis: { slaMet: '0', resolutionTime: '0.2', timesReopened: '0', linkedToProblem: '0' } };
    d.slaRecords = [
      ['2 - High Priority', 'Response', 'completed', '127 %', '2026-05-04 15:24', '2026-05-04 15:54'],
      ['2 - High Priority', 'Resolution', 'completed', '64 %', '2026-05-04 15:24', '2026-05-05 09:24'],
    ];
    d.activity = activityFor(d);
    return d;
  }
  const seed = seedOf(number);
  const d = {
    number, priority, category,
    subcategory: SUBCATS[category] || 'General Inquiry',
    assignmentGroup: GROUPS[seed % GROUPS.length],
    assignedTo: PEOPLE[(seed >> 3) % PEOPLE.length],
    state: STATES[(seed >> 5) % STATES.length],
    kpis: {
      slaMet: ((seed % 1000) / 10).toFixed(1),
      resolutionTime: ((seed % 60) / 10).toFixed(1),
      timesReopened: String(seed % 3),
      linkedToProblem: String(seed % 2),
    },
  };
  const name = priority + ' Priority';
  d.slaRecords = [
    [name, 'Response', 'completed', (40 + (seed % 110)) + ' %', '2026-05-04 15:24', '2026-05-04 15:54'],
    [name, 'Resolution', d.kpis.timesReopened === '0' ? 'in progress' : 'completed', (30 + ((seed >> 2) % 90)) + ' %', '2026-05-04 15:24', '2026-05-05 09:24'],
  ];
  d.activity = activityFor(d);
  return d;
}

const RECORDS = {};
ROWS.forEach(r => { RECORDS[r[0]] = detailFor(r[0], r[1], r[2]); });

/* ============ KPI strip (2 hero cells) ============ */
function mkpi(label, valHtml) {
  return '<div class="kpi"><div class="k">' + label + info + '</div><div class="v">' + valHtml + '</div></div>';
}
const kpiStrip =
  '<section class="card span-12 kpi-strip kpi2" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' +
    mkpi('Open Incidents', '<span data-counter data-to="2000">0</span><span class="u">#</span>') +
    mkpi('Avg Resolution Time', '<span data-counter data-to="3.4" data-decimals="1">0</span><span class="u">d</span>') +
  '</section>';

/* ============ Incidents by Assignment Group (hbarcat) ============ */
const ASSIGN_BARS = [
  ['Level 1 Service Desk', 29000],
  ['Level 2 Service Desk Onsite', 14000],
  ['Level 3 - Hardware Support', 4600],
  ['Level 3 - Network Operations', 4300],
  ['Level 3 - Security Operations', 4000],
  ['Level 3 - Software Support', 3800],
  ['Level 3 - Database Administration', 3400],
];
const chartCard =
  '<section class="card span-12 metric" data-card style="min-height:256px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">Incidents by Assignment Group</div>' +
    '<div class="chart-wrap" data-chart="hbarcat" data-xmax="30000" data-xticks="0,10000,20000,30000" data-labelw="150" data-unit="incidents" data-bars=\'' + JSON.stringify(ASSIGN_BARS) + '\'></div>' +
  '</section>';

/* ============ Incident List ============ */
const listBody = ROWS.map(r =>
  '<tr><td><a class="inc-link" data-inc="' + r[0] + '">' + r[0] + '</a></td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'
).join('');
const listCard =
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">Incident List</div>' +
    '<div class="ptable-scroll" data-inclist>' +
      '<table class="ptable"><thead><tr><th>Incident Number</th><th>Priority</th><th>Category</th></tr></thead>' +
      '<tbody>' + listBody + '</tbody></table>' +
    '</div>' +
  '</section>';

const dashboard =
  '<div class="bento inc-mgmt" data-fixed>' +
    '<div class="inc-hero">' +
      '<p class="sub">Monitor incident volume, resolution times, SLA compliance, and reopened incidents.</p></div>' +
    kpiStrip + chartCard + listCard +
  '</div>';

registerView({
  id: 'incident-management',
  label: 'Incident Management',
  icon,
  html: buildAssetHeader({ title: 'Incident Management' }) + dashboard,

  render(viewEl) {
    viewEl.classList.add('inc-mgmt-view');
    const list = viewEl.querySelector('[data-inclist]');
    if (!list) return;
    list.addEventListener('click', e => {
      const link = e.target.closest('.inc-link');
      if (!link) return;
      e.preventDefault();
      const rec = RECORDS[link.dataset.inc];
      if (!rec) return;
      // mark the active row, push the record to the detail pane, then slide it in.
      list.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('is-sel'));
      const tr = link.closest('tr'); if (tr) tr.classList.add('is-sel');
      document.dispatchEvent(new CustomEvent('incident:select', { detail: rec }));
      if (window.IA && window.IA.openSlideOver) window.IA.openSlideOver('incident-details');
    });
  },
});
