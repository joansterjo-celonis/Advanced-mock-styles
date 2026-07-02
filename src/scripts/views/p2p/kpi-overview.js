// ============================================================
//  P2P Analytics — KPI Overview panel
// ============================================================
// Composition/content from "Julianne P2P - KPI Overview Prototype":
// a filter row, five headline KPI cards (target-based ones carry a bullet
// mini-chart, the rest a status badge), a full-width cycle-time trend line,
// a summary-statistics list and a refresh-info footer. Styling is the
// project's own; every visual is a repo chart builder.

import { filterRow, kpiCardBig, card, cardTitle, chart, legend, statList } from './parts.js';

const FILTERS = [
  ['Date Range', 'Jan 1 - Dec 31, 2024'],
  ['Vendor', 'All Vendors'],
  ['Department', 'All Departments'],
  ['Compliance', 'All Events'],
];

/* ---- 5 headline KPIs — one data-driven template so every card shares the same
   hierarchy (label -> value -> target/delta -> mini-viz -> badge). The mini-viz
   slot varies by metric (bullet / waffle / donut ring) but always sits in the same
   place, so the row reads as one system rather than five one-offs. ---- */
const KPI_CARDS = [
  {
    label: 'Avg P2P Cycle Days', to: '38', target: 'Target: 30 days',
    delta: '\u2191 8 days', deltaKind: 'up',
    bullet: { value: 38, target: 30, max: 50, bands: [30, 42], color: '--cstop-3a', unit: 'd' },
    badge: ['warn', 'At Risk'],
  },
  {
    label: 'Avg Approval Days', to: '2.1', decimals: 1, target: 'Target: 2 days',
    delta: '\u2193 On track', deltaKind: 'down',
    bullet: { value: 2.1, target: 2, max: 4, bands: [2, 3], color: '--success', unit: 'd' },
    badge: ['ok', 'On Track'],
  },
  {
    label: '3-Way Match Rate', to: '92', suffix: '%', target: 'Target: >95%',
    delta: '\u2193 3% below', deltaKind: 'up',
    viz: chart('dotgrid', 'data-percent="92" data-total="12" data-cols="6" data-gap="7"', 'p2p-kbullet'),
    badge: ['warn', 'Below Target'],
  },
  {
    label: 'Compliance Flags', to: '87', target: 'Target: 0',
    delta: '\u2191 87 violations', deltaKind: 'up',
    bullet: { value: 87, target: 0, max: 100, bands: [20, 60], color: '--danger' },
    badge: ['crit', 'Critical'],
  },
  {
    label: 'On-Time Payment Rate', to: '94', suffix: '%', target: 'Target: 90%',
    delta: '\u25b2 3 pts', deltaKind: 'down',
    viz: chart('donut', 'data-segs=\'' + JSON.stringify([['On time', 94, '--success'], ['Late', 6, '--danger']]) + '\'', 'p2p-kring'),
    badge: ['ok', 'On Track'],
  },
];
const KPIS = '<div class="p2p-kpirow">' + KPI_CARDS.map(kpiCardBig).join('') + '</div>';

/* ---- Cycle-time trend (actual vs target) ---- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND = [
  { c: '--cstop-1a', name: 'Actual Cycle Days', pts: [42, 40, 38, 39, 37, 38, 36, 35, 34, 33, 32, 31] },
  { c: '--success', name: 'Target (30 days)', pts: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30] },
];
const trendCard = card('span-8 metric',
  cardTitle('Cycle Time Trend (Month over Month)') +
  '<div class="paxis-label">&uarr; Cycle days</div>' +
  chart('linechart',
    'data-ymax="50" data-xlabels="' + MONTHS.join('|') + '" data-series=\'' + JSON.stringify(TREND) + '\'') +
  '<div class="dash-xlabel">Month &rarr;</div>' +
  legend([['--cstop-1a', 'Actual Cycle Days'], ['--success', 'Target (30 days)']], true),
  'min-height:300px;');

/* ---- Goal progress (KPI + single bullet). Same component as the headline KPI
   cards (label -> value -> target/delta -> bullet -> badge), just widened to
   span-4 so it reads as a scaled-up sibling — not a different widget. Tracks YTD
   spend against the annual budget pace. ---- */
const goalCard = kpiCardBig({
  span: 'span-4',
  label: 'Spend vs Budget',
  tip: 'YTD paid spend against the annual budget pace.',
  to: '83', suffix: '%',
  target: '$3.82M of $4.6M',
  delta: '\u25b2 on track', deltaKind: 'down',
  bullet: { value: 3.82, target: 4.6, max: 5, bands: [3, 4.6], unit: 'M', color: '--cstop-1a' },
  badge: ['ok', 'On Track'],
});

/* ---- Document flow (POs -> Invoices -> Payments) as a repo funnel ---- */
const DOC_FLOW = [['Purchase Orders', 100], ['Invoices', 80], ['Payments', 70]];
const docFlowCard = card('span-4 metric',
  cardTitle('Document Flow', 'How the 100 POs convert into invoices and then payments.') +
  chart('funnel', 'data-stages=\'' + JSON.stringify(DOC_FLOW) + '\''),
  'min-height:300px;');

/* ---- Summary statistics + refresh line ---- */
const summaryCard = card('span-8',
  cardTitle('Summary Statistics') +
  statList([
    ['Total Purchase Orders', '100'],
    ['Total Invoices', '80'],
    ['Total Payments', '70'],
    ['Total Paid Amount', '$3.82M'],
    ['Avg Invoice Amount', '$54.6K'],
    ['Avg PO to Invoice', '15 days'],
    ['Avg Invoice to Payment', '23 days'],
  ]));

const refreshCard = card('span-12',
  '<div class="p2p-refresh">Data last refreshed: Today at 9:30 AM &middot; Next refresh: Today at 6:00 PM &middot; Manual refresh available</div>');

export const kpiOverviewPanel =
  '<div class="bento p2p-panel" data-p2p-panel="kpi" data-fixed>' +
    filterRow(FILTERS) +
    KPIS +
    trendCard + goalCard +
    docFlowCard + summaryCard +
    refreshCard +
  '</div>';
