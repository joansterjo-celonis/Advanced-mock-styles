// ============================================================
//  P2P Analytics — Cycle Time Analysis panel
// ============================================================
// Composition/content from "Cycle Time Analysis - Enhanced Charts": filters,
// a 4-cell stat strip, a full-width 12-month trend, a ranked vendor bar, a
// vendor breakdown, two distribution histograms, a department breakdown and
// two performance tables. Every chart is a repo builder (linechart / hbarcat /
// groupbars / barcat); styling is the project's own.

import { filterRow, kpiCell, card, cardTitle, chart, legend, table, badge } from './parts.js';

const FILTERS = [
  ['Date Range', 'Jan 1 - Dec 31, 2024'],
  ['Vendor', 'All Vendors'],
  ['Department', 'All Departments'],
];

/* ---- 4 stat cells ---- */
const statStrip =
  '<section class="card span-12 kpi-strip kpi4" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' +
    kpiCell('Avg PO to Invoice Days', { to: '15', delta: '\u2193 5 days vs last month', deltaKind: 'down' }) +
    kpiCell('Avg Invoice to Payment Days', { to: '23', delta: 'Within target range', deltaKind: 'flat' }) +
    kpiCell('Avg Total Cycle Days', { to: '38', delta: '\u2191 8 days over target (30)', deltaKind: 'up' }) +
    kpiCell('Process Efficiency', { to: '87', suffix: '%', delta: 'Above industry avg', deltaKind: 'flat' }) +
  '</section>';

/* ---- Chart 1: 12-month trend (total vs target vs industry) ---- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND = [
  { c: '--cstop-1a', name: 'Total Cycle Days', pts: [45, 43, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32] },
  { c: '--success', name: 'Target (30 days)', pts: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30] },
  { c: '--cstop-3a', name: 'Industry Average (35)', pts: [35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35] },
];
const trendCard = card('span-12 metric',
  cardTitle('Cycle Time Trend (Monthly - 12 Month History)') +
  '<div class="paxis-label">&uarr; Cycle days</div>' +
  chart('linechart',
    'data-ymax="50" data-xlabels="' + MONTHS.join('|') + '" data-series=\'' + JSON.stringify(TREND) + '\'') +
  '<div class="dash-xlabel">Month &rarr;</div>' +
  legend([['--cstop-1a', 'Total Cycle Days'], ['--success', 'Target (30 days)'], ['--cstop-3a', 'Industry Average (35)']], true),
  'min-height:300px;');

/* ---- Chart 2: ranked cycle time by vendor → lollipop (dotplot) ---- */
const VENDOR_DOTS = [
  ['Office Solutions', 32],
  ['Acme Corp', 35],
  ['Tech Innovations', 38],
  ['Global Supplies', 42],
  ['Industrial Parts', 45],
];
const vendorCard = card('span-6 metric',
  cardTitle('Average Cycle Time by Vendor', 'Ranked fastest to slowest end-to-end cycle.') +
  chart('dotplot',
    'data-xmax="50" data-xticks="0,10,20,30,40,50" data-unit="days" data-labelw="120" data-color="--cstop-1a" data-dots=\'' + JSON.stringify(VENDOR_DOTS) + '\'') +
  '<div class="dash-xlabel">Avg cycle days &rarr;</div>',
  'min-height:320px;');

/* ---- Chart 3: vendor breakdown → performance quadrant (bubble)
   x = PO to Invoice days, y = Invoice to Payment days, bubble size = total cycle. ---- */
const VB_POINTS = [
  [12, 23, 35, 'Acme Corp'],
  [18, 24, 42, 'Global Supplies'],
  [14, 24, 38, 'Tech Innovations'],
  [20, 25, 45, 'Industrial Parts'],
  [10, 22, 32, 'Office Solutions'],
];
const vendorBreakdownCard = card('span-6 metric',
  cardTitle('Vendor Performance Quadrant', 'Lower-left is best; bubble size is total cycle days.') +
  '<div class="paxis-label">&uarr; Invoice to Payment (days)</div>' +
  chart('bubble',
    'data-xmax="25" data-ymax="30" data-smax="45" data-color="--cstop-1a" data-points=\'' + JSON.stringify(VB_POINTS) + '\'') +
  '<div class="dash-xlabel">PO to Invoice (days) &rarr;</div>',
  'min-height:320px;');

/* ---- Chart 4 & 5: distribution histograms ---- */
const PO_DIST = [['5-7 days', 8], ['8-10 days', 18], ['11-15 days', 32], ['16-20 days', 15], ['20+ days', 7]];
const poDistCard = card('span-6 metric',
  cardTitle('PO to Invoice Days Distribution') +
  chart('barcat',
    'data-ymax="36" data-unit="invoices" data-color="--cstop-1a" data-bars=\'' + JSON.stringify(PO_DIST) + '\''),
  'min-height:300px;');

const PAY_DIST = [['10-15 days', 5], ['16-20 days', 12], ['21-25 days', 28], ['26-30 days', 18], ['30+ days', 17]];
const payDistCard = card('span-6 metric',
  cardTitle('Invoice to Payment Days Distribution') +
  chart('barcat',
    'data-ymax="32" data-unit="invoices" data-color="--cstop-3a" data-bars=\'' + JSON.stringify(PAY_DIST) + '\''),
  'min-height:300px;');

/* ---- Chart 6: cycle time by department → phase heatmap (matrix) ---- */
const DEPT_ROWS = ['Engineering', 'Operations', 'Finance', 'HR', 'IT'];
const DEPT_COLS = ['PO to Invoice', 'Invoice to Payment'];
const DEPT_MATRIX = [[14, 22], [16, 24], [12, 23], [18, 24], [13, 25]];
const deptChartCard = card('span-12 metric',
  cardTitle('Cycle Time by Department', 'Darker cells take longer (days) in that phase.') +
  chart('heatmap',
    'data-vmax="25" data-unit="days" data-labelw="110" data-rows=\'' + JSON.stringify(DEPT_ROWS) + '\' data-cols=\'' + JSON.stringify(DEPT_COLS) + '\' data-matrix=\'' + JSON.stringify(DEPT_MATRIX) + '\'',
    null, 'min-height:190px;'),
  'min-height:260px;');

/* ---- Tables ---- */
const vendorTable = card('span-12',
  '<div class="ocpm-cardhead">' + cardTitle('Vendor Performance Summary') + '</div>' +
  table(
    ['Vendor', 'Avg Cycle Days', 'PO to Invoice', 'Invoice to Payment', 'Performance', 'Status'],
    [
      ['Acme Corp', '35', '12', '23', '88%', badge('ok', 'On Track')],
      ['Global Supplies', '42', '18', '24', '81%', badge('warn', 'At Risk')],
      ['Tech Innovations', '38', '14', '24', '85%', badge('warn', 'At Risk')],
      ['Industrial Parts Inc', '45', '20', '25', '76%', badge('crit', 'Critical')],
      ['Office Solutions Ltd', '32', '10', '22', '91%', badge('ok', 'On Track')],
    ],
    [1, 2, 3, 4]));

const deptTable = card('span-12',
  '<div class="ocpm-cardhead">' + cardTitle('Cycle Time by Department') + '</div>' +
  table(
    ['Department', 'Avg Cycle Days', 'PO Count', 'Invoice Count', 'Payment Count', 'Efficiency'],
    [
      ['Engineering', '36', '28', '22', '18', '78%'],
      ['Operations', '40', '32', '26', '22', '74%'],
      ['Finance', '35', '18', '15', '14', '82%'],
      ['HR', '42', '14', '11', '9', '68%'],
      ['IT', '38', '8', '6', '7', '88%'],
    ],
    [1, 2, 3, 4, 5]));

export const cycleTimePanel =
  '<div class="bento p2p-panel" data-p2p-panel="cycle" data-fixed style="display:none;">' +
    filterRow(FILTERS) +
    statStrip +
    trendCard +
    vendorCard + vendorBreakdownCard +
    poDistCard + payDistCard +
    deptChartCard +
    vendorTable + deptTable +
  '</div>';
