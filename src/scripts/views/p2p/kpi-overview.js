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
   hierarchy (label -> value -> target/delta -> mini-viz). The mini-viz
   slot varies by metric (bullet / waffle / donut ring) but always sits in the same
   place, so the row reads as one system rather than five one-offs. ---- */
const KPI_CARDS = [
  {
    label: 'Avg P2P Cycle Days', to: '38', target: 'Target: 30 days',
    delta: '\u2191 8 days', deltaKind: 'up',
    bullet: { value: 38, target: 30, max: 50, bands: [30, 42], color: '--cstop-3a', unit: 'd' },
  },
  {
    label: 'Avg Approval Days', to: '2.1', decimals: 1, target: 'Target: 2 days',
    delta: '\u2193 On track', deltaKind: 'down',
    bullet: { value: 2.1, target: 2, max: 4, bands: [2, 3], color: '--success', unit: 'd' },
  },
  {
    label: '3-Way Match Rate', to: '92', suffix: '%', target: 'Target: >95%',
    delta: '\u2193 3% below', deltaKind: 'up',
    viz: chart('dotgrid', 'data-percent="92" data-total="16" data-cols="8" data-gap="6"', 'p2p-kwaffle'),
  },
  {
    label: 'Compliance Flags', to: '87', target: 'Target: 0',
    delta: '\u2191 87 violations', deltaKind: 'up',
    bullet: { value: 87, target: 0, max: 100, bands: [20, 60], color: '--danger' },
  },
  {
    label: 'On-Time Payment Rate', to: '94', suffix: '%', target: 'Target: 90%',
    delta: '\u2191 3 pts', deltaKind: 'down',
    viz: chart('donut', 'data-segs=\'' + JSON.stringify([['On time', 94, '--success'], ['Late', 6, '--danger']]) + '\'', 'p2p-kring'),
  },
];
const KPIS = '<div class="p2p-kpirow">' + KPI_CARDS.map(kpiCardBig).join('') + '</div>';

/* ---- Cycle-time trend (actual vs target) ---- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND = [
  { c: '--cstop-1a', name: 'Actual Cycle Days', pts: [42, 40, 38, 39, 37, 38, 36, 35, 34, 33, 32, 31] },
  { c: '--success', name: 'Target (30 days)', pts: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30] },
];
const trendCard = card('span-12 metric',
  cardTitle('Cycle Time Trend (Month over Month)') +
  '<div class="paxis-label">&uarr; Cycle days</div>' +
  chart('linechart',
    'data-ymax="50" data-xlabels="' + MONTHS.join('|') + '" data-series=\'' + JSON.stringify(TREND) + '\'') +
  '<div class="dash-xlabel">Month &rarr;</div>' +
  legend([['--cstop-1a', 'Actual Cycle Days'], ['--success', 'Target (30 days)']], true),
  'min-height:300px;');

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
    trendCard +
    docFlowCard + summaryCard +
    refreshCard +
  '</div>';
