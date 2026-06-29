// ============================================================
//  View: SLA Performance  (compliance / breach analytics dashboard)
// ============================================================
// Faithful reproduction of the "SLA Performance" dashboard — same family as
// Incident Management / Service Request Fulfillment. Hero header + description,
// a 4-cell hero KPI strip, a percentage horizontal-bar chart (generic `hbarcat`
// with the new data-xdec / data-xsuffix percent ticks), a contract-type donut
// (the shared `donut` component, data-driven via data-segs), a 3-series compliance
// trend (generic `linechart`) and a
// Breached SLA Records table. Built entirely on the shared registry + asset
// header + .bento / .card / .kpi-strip / .ptable primitives — no bespoke wiring.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';
const info = '<span class="inc-i">i</span>';

/* ---- svg helpers ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const DL = s(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
const SORT = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;"><path d="M12 4l5 6H7l5-6zm0 16l-5-6h10l-5 6z"/></svg>';
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';

/* ============ KPI strip (4 hero cells) ============ */
// Numerals carry data-counter so they count-up and obey the KPI weight/font knob.
// The unit (%, #) is carried in the label text as "[unit]" (matching the shell's
// "Net Order Value [EUR]" convention) instead of a trailing numeral span; the
// compliance cells still render the percent inside the numeral via data-suffix, and
// Total SLA Breaches counts up to a comma-grouped integer.
function kpiCell(label, opts) {
  opts = opts || {};
  const suf = opts.suffix ? ' data-suffix="' + opts.suffix + '"' : '';
  const dec = opts.decimals ? ' data-decimals="' + opts.decimals + '"' : '';
  const lbl = opts.unit ? label + ' [' + opts.unit + ']' : label;
  return '<div class="kpi"><div class="k">' + lbl + info + '</div>' +
    '<div class="v"><span data-counter data-to="' + opts.to + '"' + dec + suf + '>0</span></div></div>';
}
const kpiStrip =
  '<section class="card span-12 kpi-strip kpi4" data-card style="min-height:auto;">' +
    '<span class="gloss"></span><span class="sheen"></span><span class="rim"></span>' +
    kpiCell('Overall SLA Compliance', { to: '83.3', decimals: 1, suffix: '%', unit: '%' }) +
    kpiCell('Response SLA Compliance', { to: '90.3', decimals: 1, suffix: '%', unit: '%' }) +
    kpiCell('Resolution SLA Compliance', { to: '89.4', decimals: 1, suffix: '%', unit: '%' }) +
    kpiCell('Total SLA Breaches', { to: '43097', unit: '#' }) +
  '</section>';

/* ============ Breach Rate by Assignment Group (percent hbarcat) ============ */
const BREACH_BARS = [
  ['null', 26.0],
  ['Level 3 - Database Administration', 11.2],
  ['Level 3 - Software Support', 10.7],
  ['Level 2 Service Desk Onsite', 10.5],
  ['Level 1 Service Desk', 10.2],
  ['Level 3 - Network Operations', 10.0],
  ['Level 3 - Hardware Support', 9.8],
  ['Level 3 - Security Operations', 9.7],
];
const breachCard =
  '<section class="card span-6 metric" data-card style="min-height:320px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">Breach Rate by Assignment Group</div>' +
    '<div class="chart-wrap" data-chart="hbarcat" data-xmax="27" data-xticks="0,5,10,15,20,25" ' +
      'data-xdec="1" data-xsuffix="%" data-unit="%" data-labelw="190" data-bars=\'' + JSON.stringify(BREACH_BARS) + '\'></div>' +
    '<div class="dash-xlabel">SLA Breach Rate &rarr;</div>' +
  '</section>';

/* ============ SLA Breaches by Contract Type (donut + legend) ============ */
// Order around the ring (clockwise from 12 o'clock) matches the source.
const CONTRACT_SEGS = [
  ['3 - Moderate Resolution SLA', 30.89, '--cstop-1b'],
  ['4 - Low Resolution SLA', 30.06, '--cstop-1a'],
  ['2 - High Resolution SLA', 18.25, '--legend-2'],
  ['1 - Critical Resolution SLA', 9.37, '--legend-3'],
  ['3 - Moderate Response SLA', 4.01, '--legend-1'],
  ['4 - Low Response SLA', 2.82, '--cstop-3a'],
  ['2 - High Response SLA', 2.74, '--cstop-2a'],
  ['1 - Critical Response SLA', 1.86, '--legend-4'],
];
// Inline legend chip (swatch + label), shared by the trend legend below.
function legItem(color, label) {
  return '<span class="dash-legitem"><span class="dash-swatch" style="background:var(' + color + ')"></span>' + label + '</span>';
}
// Side legend (donut-row pattern, shared with the Unbilled donut): one row per
// segment — colour swatch + "pct% label" — built straight from CONTRACT_SEGS.
const contractLegend =
  '<div class="donut-legend">' +
    CONTRACT_SEGS.map(s =>
      '<div class="li"><span class="sw" style="background:var(' + s[2] + ')"></span>' +
      s[1].toFixed(2) + '% ' + s[0] + '</div>').join('') +
  '</div>';
const contractCard =
  '<section class="card span-6 metric" data-card style="min-height:320px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">SLA Breaches by Contract Type</div>' +
    '<div class="donut-row">' +
      '<div class="chart-wrap" style="flex:0 0 46%; max-width:240px; aspect-ratio:1; min-width:0;" data-chart="donut" data-segs=\'' + JSON.stringify(CONTRACT_SEGS) + '\'></div>' +
      contractLegend +
    '</div>' +
  '</section>';

/* ============ SLA Compliance Trend (3-series linechart) ============ */
const MONTHS = ['2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
const TREND = [
  { c: '--cstop-1a', name: 'SLA Compliance', pts: [83, 90, 82, 83, 83, 84, 83, 83, 82, 86, 88, 88, 88] },
  { c: '--cstop-1b', name: 'Response SLA', pts: [85, 91, 84, 85, 85, 86, 85, 85, 84, 88, 90, 90, 90] },
  { c: '--legend-1', name: 'Resolution SLA', pts: [84, 90, 83, 84, 84, 85, 84, 84, 83, 87, 89, 89, 89] },
];
const trendLegend =
  '<div class="dash-legend center">' +
    legItem('--cstop-1a', 'SLA Compliance') +
    legItem('--cstop-1b', 'Response SLA') +
    legItem('--legend-1', 'Resolution SLA') +
  '</div>';
const trendCard =
  '<section class="card span-12 metric" data-card style="min-height:300px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">SLA Compliance Trend</div>' +
    '<div class="paxis-label">&uarr; SLA Compliance, Response SLA, Resolution SLA</div>' +
    '<div class="chart-wrap" data-chart="linechart" data-ymax="100" data-pct="1" ' +
      'data-xlabels="' + MONTHS.join('|') + '" data-series=\'' + JSON.stringify(TREND) + '\'></div>' +
    '<div class="dash-xlabel">Month &rarr;</div>' +
    trendLegend +
  '</section>';

/* ============ Breached SLA Records table ============ */
const COLS = ['Task SLA Name', 'Contract SLA Type', 'SLA Stage', 'Business % Elapsed', 'SLA Type', 'Assignment Group'];
const ROWS = [
  ['2 - High Resolution SLA', '2 - High Resolution SLA', 'completed', '127 %', 'Other', '-'],
  ['3 - Moderate Resolution SLA', '3 - Moderate Resolution SLA', 'completed', '118 %', 'Resolution', 'Level 1 Service Desk'],
  ['4 - Low Response SLA', '4 - Low Response SLA', 'in progress', '103 %', 'Response', '-'],
  ['2 - High Response SLA', '2 - High Response SLA', 'completed', '156 %', 'Response', 'Level 3 - Network Operations'],
  ['1 - Critical Resolution SLA', '1 - Critical Resolution SLA', 'breached', '212 %', 'Resolution', 'Level 3 - Hardware Support'],
  ['3 - Moderate Response SLA', '3 - Moderate Response SLA', 'completed', '141 %', 'Response', '-'],
  ['4 - Low Resolution SLA', '4 - Low Resolution SLA', 'completed', '109 %', 'Resolution', 'Level 2 Service Desk Onsite'],
  ['2 - High Resolution SLA', '2 - High Resolution SLA', 'completed', '133 %', 'Other', '-'],
  ['1 - Critical Response SLA', '1 - Critical Response SLA', 'breached', '188 %', 'Response', 'Level 3 - Software Support'],
  ['3 - Moderate Resolution SLA', '3 - Moderate Resolution SLA', 'completed', '121 %', 'Resolution', '-'],
  ['2 - High Resolution SLA', '2 - High Resolution SLA', 'completed', '114 %', 'Resolution', 'Level 3 - Database Administration'],
];
// Business % Elapsed (index 3) is the sorted, numeric-aligned column.
const tHead = '<thead><tr>' + COLS.map((c, i) =>
  (i === 3 ? '<th class="num">' + SORT + ' ' + c + info + '</th>' : '<th>' + c + '</th>')).join('') +
  '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
const tBody = '<tbody>' + ROWS.map(r =>
  '<tr>' + r.map((c, i) => (i === 3 ? '<td class="num">' + c + '</td>' : '<td>' + c + '</td>')).join('') +
  '<td class="tr-kebab"></td></tr>').join('') + '</tbody>';
const recordsCard =
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-cardhead"><div class="card-title">Breached SLA Records</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
    '<div class="ptable-scroll"><table class="ptable">' + tHead + tBody + '</table></div>' +
  '</section>';

const dashboard =
  '<div class="bento sla-content" data-fixed>' +
    '<div class="inc-hero">' +
      '<p class="sub">Analyze SLA compliance across response and resolution types, identify breaching teams and contract types, and track compliance trends.</p></div>' +
    kpiStrip + breachCard + contractCard + trendCard + recordsCard +
  '</div>';

registerView({
  id: 'sla-performance',
  label: 'SLA Performance',
  icon,
  html: buildAssetHeader({ title: 'SLA Performance' }) + dashboard,
});
