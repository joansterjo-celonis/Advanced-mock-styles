// ============================================================
//  View: Service Request Fulfillment  (catalog / RITM dashboard)
// ============================================================
// Faithful reproduction of the "Service Request Fulfillment" dashboard. Same
// dashboard family as Incident Management: a hero header + description, a 5-cell
// hero KPI strip, two "by volume / by group" horizontal-bar charts (the generic
// data-driven `hbarcat` builder, so they react to the theme / density / 3D
// knobs) and a Service Request Items table with linked RITM numbers. Built
// entirely through the shared registry + asset header + .bento / .card /
// .kpi-strip / .ptable primitives — no bespoke shell wiring.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';
const info = '<span class="inc-i">i</span>';

/* ---- svg helpers ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const DL = s(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';

/* ============ KPI strip (5 hero cells) ============ */
// Numerals carry data-counter so they count-up and obey the KPI weight/font knob.
// The unit (#, %, d) is carried in the label text as "[unit]" (matching the shell's
// "Net Order Value [EUR]" convention) rather than a trailing numeral span; the
// compliance cells still render the percent inside the numeral via data-suffix.
function kpiCell(label, opts) {
  opts = opts || {};
  const suf = opts.suffix ? ' data-suffix="' + opts.suffix + '"' : '';
  const dec = opts.decimals ? ' data-decimals="' + opts.decimals + '"' : '';
  const lbl = opts.unit ? label + ' [' + opts.unit + ']' : label;
  return '<div class="kpi"><div class="k">' + lbl + info + '</div>' +
    '<div class="v"><span data-counter data-to="' + opts.to + '"' + dec + suf + '>0</span></div></div>';
}
const kpiStrip =
  '<section class="card span-12 kpi-strip kpi5" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' +
    kpiCell('Open Requests', { to: '287', unit: '#' }) +
    kpiCell('Due Date Compliance', { to: '56', decimals: 1, suffix: '%', unit: '%' }) +
    kpiCell('Avg Fulfillment Time', { to: '10.3', decimals: 1, unit: 'd' }) +
    kpiCell('Approval Pending Rate', { to: '0.1', decimals: 1, suffix: '%', unit: '%' }) +
    kpiCell('Overdue Items', { to: '225', unit: '#' }) +
  '</section>';

/* ============ charts (two horizontal-bar cards) ============ */
const CATALOG_BARS = [
  ['Other', 9500],
  ['Software Access', 8000],
  ['VPN Access', 8200],
  ['Password Reset', 8000],
  ['New Laptop', 8600],
  ['New Mobile Phone', 7800],
];
const OVERDUE_BARS = [
  ['Level 1 Service Desk', 80],
  ['Level 3 - Hardware Support', 70],
  ['Level 3 - Network Operations', 40],
  ['Level 3 - Software Support', 33],
  ['null', 2],
  ['Level 3 - Database Administration', 1],
  ['Level 3 - Security Operations', 1],
];
function chartCard(title, xlabel, attrs) {
  return '<section class="card span-6 metric" data-card style="min-height:300px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">' + title + '</div>' +
    '<div class="chart-wrap" data-chart="hbarcat" ' + attrs + '></div>' +
    '<div class="dash-xlabel">' + xlabel + '</div>' +
  '</section>';
}
const catalogChart = chartCard('Top Catalog Items by Volume', '# Request Items &rarr;',
  'data-xmax="10000" data-xticks="0,2000,4000,6000,8000,10000" data-labelw="104" data-unit="items" data-bars=\'' + JSON.stringify(CATALOG_BARS) + '\'');
const overdueChart = chartCard('Overdue Items by Assignment Group', 'Overdue Items &rarr;',
  'data-xmax="80" data-xticks="0,20,40,60,80" data-labelw="184" data-unit="overdue" data-bars=\'' + JSON.stringify(OVERDUE_BARS) + '\'');

/* ============ Service Request Items table ============ */
const COLS = ['Item Number', 'Catalog Item', 'Assignment Group', 'Opened At', 'Due Date' + info, 'Approval State', 'State'];
const ROWS = [
  ['RITM3907464', 'VPN Access', '-', '2026-04-20', '-', 'Requested', 'Pending'],
  ['RITM5061920', 'Software Access', '-', '2026-04-22', '-', 'Requested', 'Pending'],
  ['RITM5497239', 'Password Reset', '-', '2026-04-07', '-', 'Requested', 'Pending'],
  ['RITM2768315', 'New Mobile Phone', '-', '2026-04-30', '-', 'Requested', 'Pending'],
  ['RITM4102362', 'Other', '-', '2026-04-11', '-', 'Requested', 'Pending'],
  ['RITM7978155', 'Password Reset', '-', '2026-04-19', '-', 'Requested', 'Pending'],
  ['RITM6116137', 'Password Reset', '-', '2026-04-05', '-', 'Requested', 'Pending'],
  ['RITM6802729', 'Password Reset', '-', '2026-04-14', '-', 'Requested', 'Pending'],
  ['RITM4022019', 'New Laptop', '-', '2026-05-03', '-', 'Requested', 'Pending'],
  ['RITM4618906', 'VPN Access', '-', '2026-04-14', '-', 'Requested', 'Pending'],
  ['RITM3641188', 'Password Reset', '-', '2026-04-09', '-', 'Requested', 'Pending'],
  ['RITM5820470', 'Software Access', '-', '2026-04-28', '-', 'Requested', 'Pending'],
  ['RITM2099513', 'New Laptop', '-', '2026-04-16', '-', 'Requested', 'Pending'],
];
const tHead = '<thead><tr>' + COLS.map(c => '<th>' + c + '</th>').join('') + '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
const tBody = '<tbody>' + ROWS.map(r =>
  '<tr><td><a class="inc-link">' + r[0] + '</a></td>' +
  r.slice(1).map(c => '<td>' + c + '</td>').join('') +
  '<td class="tr-kebab"></td></tr>').join('') + '</tbody>';
const itemsCard =
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-cardhead"><div class="card-title">Service Request Items</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
    '<div class="ptable-scroll"><table class="ptable">' + tHead + tBody + '</table></div>' +
  '</section>';

const dashboard =
  '<div class="bento srf-content" data-fixed>' +
    '<div class="inc-hero">' +
      '<p class="sub">Track open service request backlog, due date compliance, and fulfillment speed by catalog item and assignment group.</p></div>' +
    kpiStrip + catalogChart + overdueChart + itemsCard +
  '</div>';

registerView({
  id: 'service-request',
  label: 'Apollo views 2 - stock',
  icon,
  html: buildAssetHeader({ title: 'Apollo views 2 - stock' }) + dashboard,
});
