// ============================================================
//  P2P Analytics — Approval Workflow panel
// ============================================================
// Composition/content from "Approval Workflow - Enhanced Visualization":
// filters, a 4-cell summary strip, the stage progression (the source's bespoke
// CSS "stage flow" rebuilt as the repo `funnel`), five analysis charts and two
// operational tables. Styling is the project's own; visuals are repo builders.

import { filterRow, kpiCell, card, cardTitle, chart, legend, table, badge } from './parts.js';

const FILTERS = [
  ['Date Range', 'Jan 1 - Dec 31, 2024'],
  ['Vendor', 'All Vendors'],
];

/* ---- 4 summary cells (one is a text KPI) ---- */
const summaryStrip =
  '<section class="card span-12 kpi-strip kpi4" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' +
    kpiCell('Total POs Created', { to: '100', delta: 'Starting point', deltaKind: 'flat' }) +
    kpiCell('Overall Completion Rate', { to: '70', suffix: '%', delta: 'End-to-end payment', deltaKind: 'down' }) +
    kpiCell('Biggest Drop-off', { text: 'PO &rarr; Invoice', delta: '20% loss (80 of 100)', deltaKind: 'up' }) +
    kpiCell('Avg Days in Approval', { to: '2.1', decimals: 1, delta: 'Days to approve', deltaKind: 'flat' }) +
  '</section>';

/* ---- Stage progression → funnel ---- */
const STAGES = [
  ['PO Created', 100], ['PO Approved', 95], ['Invoice Received', 80],
  ['Invoice Approved', 75], ['Payment Executed', 70],
];
const funnelCard = card('span-12 metric',
  cardTitle('Approval Process Flow - Stage Progression', 'Accounts remaining at each stage of the approval funnel.') +
  chart('funnel', 'data-stages=\'' + JSON.stringify(STAGES) + '\''),
  'min-height:340px;');

/* ---- Chart 1: process funnel counts (drop-off) ---- */
const FUNNEL_BARS = [
  ['PO Created', 100, '--cstop-1a'],
  ['PO Approved', 95, '--cstop-1a'],
  ['Invoice Received', 80, '--cstop-2a'],
  ['Invoice Approved', 75, '--cstop-3a'],
  ['Payment Executed', 70, '--success'],
];
const dropoffCard = card('span-6 metric',
  cardTitle('Process Funnel (Drop-off Analysis)') +
  chart('hbarcat',
    'data-xmax="100" data-xticks="0,25,50,75,100" data-labelw="120" data-bars=\'' + JSON.stringify(FUNNEL_BARS) + '\'') +
  '<div class="dash-xlabel">POs remaining &rarr;</div>',
  'min-height:320px;');

/* ---- Chart 2: retention rate by stage ---- */
const RETENTION = [{ c: '--cstop-1a', name: 'Retention %', pts: [100, 95, 80, 75, 70] }];
const RET_LABELS = ['PO Created', 'PO Approved', 'Invoice Received', 'Invoice Approved', 'Payment Executed'];
const retentionCard = card('span-6 metric',
  cardTitle('Retention Rate by Stage') +
  '<div class="paxis-label">&uarr; Retention %</div>' +
  chart('linechart',
    'data-ymax="100" data-pct="1" data-xlabels="' + RET_LABELS.join('|') + '" data-series=\'' + JSON.stringify(RETENTION) + '\''),
  'min-height:320px;');

/* ---- Chart 3: average days in each stage → lollipop (dotplot) ---- */
const DAYS_DOTS = [
  ['PO Created', 0], ['PO Approved', 2.1], ['Invoice Received', 7.2],
  ['Invoice Approved', 3.8], ['Payment Executed', 5.5],
];
const daysCard = card('span-6 metric',
  cardTitle('Average Days in Each Stage', 'Time an item dwells before moving on.') +
  chart('dotplot',
    'data-xmax="8" data-xticks="0,2,4,6,8" data-unit="days" data-labelw="130" data-color="--cstop-3a" data-dots=\'' + JSON.stringify(DAYS_DOTS) + '\'') +
  '<div class="dash-xlabel">Avg days in stage &rarr;</div>',
  'min-height:300px;');

/* ---- Chart 4: approval success rate by stage ---- */
const SUCCESS_BARS = [
  ['PO Approval', 95], ['Invoice Approval', 94], ['Payment Auth', 93], ['GL Posting', 97], ['Overall', 94],
];
const successCard = card('span-6 metric',
  cardTitle('Approval Success Rate by Stage') +
  chart('barcat',
    'data-ymax="100" data-unit="%" data-color="--success" data-bars=\'' + JSON.stringify(SUCCESS_BARS) + '\''),
  'min-height:300px;');

/* ---- Chart 5: bottleneck intensity (single-row heatmap) ---- */
const BN_COLS = ['PO Created', 'PO Approved', 'Invoice Received', 'Invoice Approved', 'Payment Executed'];
const BN_ROWS = ['Items Stuck'];
const BN_MATRIX = [[2, 8, 15, 6, 3]];
const bottleneckCard = card('span-12 metric',
  cardTitle('Bottleneck Intensity Heatmap', 'Darker cells indicate more items stuck (in days) at that stage.') +
  chart('heatmap',
    'data-vmax="15" data-unit="days" data-labelw="90" data-rows=\'' + JSON.stringify(BN_ROWS) + '\' data-cols=\'' + JSON.stringify(BN_COLS) + '\' data-matrix=\'' + JSON.stringify(BN_MATRIX) + '\'',
    null, 'min-height:120px;'),
  'min-height:200px;');

/* ---- Tables ---- */
const pendingTable = card('span-12',
  '<div class="ocpm-cardhead">' + cardTitle('Pending Approvals (>2 days)') + '</div>' +
  table(
    ['PO ID', 'Approver', 'Days Pending', 'Amount', 'Current Stage', 'Status'],
    [
      ['PO-2024-00045', 'Jane Doe', '5', '$45,000', 'PO Approval', badge('warn', 'Pending 5 days')],
      ['PO-2024-00062', 'Mike Johnson', '3', '$62,500', 'Invoice Approval', badge('warn', 'Pending 3 days')],
      ['PO-2024-00078', 'Sarah Williams', '7', '$38,200', 'PO Approval', badge('crit', 'Critical - 7 days')],
    ],
    [2, 3]));

const rejectedTable = card('span-12',
  '<div class="ocpm-cardhead">' + cardTitle('Rejected Invoices (Need Re-approval)') + '</div>' +
  table(
    ['Invoice ID', 'Vendor', 'Reason', 'Days Since Rejection', 'Amount'],
    [
      ['INV-2024-00012', 'Global Supplies', 'Price mismatch with PO', '8', '$52,000'],
      ['INV-2024-00018', 'Tech Innovations', 'Missing supporting docs', '3', '$38,500'],
    ],
    [3, 4]));

export const approvalWorkflowPanel =
  '<div class="bento p2p-panel" data-p2p-panel="approval" data-fixed style="display:none;">' +
    filterRow(FILTERS) +
    summaryStrip +
    funnelCard +
    dropoffCard + retentionCard +
    daysCard + successCard +
    bottleneckCard +
    pendingTable + rejectedTable +
  '</div>';
