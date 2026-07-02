// Loop 1 — a brand-new view added entirely through the registry.
// No markup, selectView, or tab wiring was touched by hand: this single
// registerView() call creates the tab, the section, the edit panel, and
// renders the charts/counters on activation. Use it as the template for
// adding more views.
import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

// Same shared "view" glyph as every other context view (single source: src/icons.js).
const icon = iconFor('view') + ' ';

// Five sub-tabs. The first (High density view) holds the showcase content — KPIs,
// charts and the order-detail table below; the rest are scaffolds to fill in.
const SUBTABS = [
  { id: 't1', label: 'High density view', on: true },
  { id: 't2', label: 'Low density' },
  { id: 't3', label: 'Process explorer' },
  { id: 't4', label: 'Network explorer' },
  { id: 't5', label: 'Adherence explorer' },
];

// ---- High-density data table: recent sales orders. Built from the global .ptable
// primitive so it inherits every theme / density / 3D knob. Columns mix text with
// time, currency, integers and percentages to read like a real operational grid. ----
const statusCell = (tok, label) =>
  '<span style="display:inline-flex;align-items:center;gap:7px;">' +
  '<span style="width:7px;height:7px;border-radius:50%;background:var(' + tok + ');"></span>' + label + '</span>';
const tint = (v, tok) => '<span style="color:var(' + tok + ');">' + v + '</span>';

const ORDER_COLS = ['Order ID', 'Customer', 'Cycle time', 'Order value', 'Items', 'On-time', 'Cost variance', 'Status'];
const ORDER_ROWS = [
  ['SO-48213', 'Northwind Traders',        '4.2 d',  '$124,900', '42', '96.4%', tint('-$2,310', '--success'), statusCell('--success', 'Delivered')],
  ['SO-48198', 'Contoso Ltd',              '6.8 d',  '$88,450',  '27', '91.2%', tint('+$1,180', '--danger'),  statusCell('--accent',  'In transit')],
  ['SO-48176', 'Fabrikam Inc',             '3.1 d',  '$215,300', '63', '98.1%', tint('-$540',   '--success'), statusCell('--success', 'Delivered')],
  ['SO-48155', 'Adventure Works',          '9.4 d',  '$52,120',  '18', '84.7%', tint('+$4,020', '--danger'),  statusCell('--danger',  'Delayed')],
  ['SO-48142', 'Tailspin Toys',            '5.5 d',  '$173,760', '51', '93.8%', tint('-$1,905', '--success'), statusCell('--success', 'Delivered')],
  ['SO-48120', 'Wingtip Toys',             '7.2 d',  '$61,540',  '22', '88.5%', tint('+$760',   '--danger'),  statusCell('--accent',  'In transit')],
  ['SO-48097', 'Litware Inc',              '2.8 d',  '$309,880', '88', '99.0%', tint('-$3,140', '--success'), statusCell('--success', 'Delivered')],
  ['SO-48083', 'Proseware Inc',            '8.1 d',  '$44,300',  '15', '82.3%', tint('+$2,650', '--danger'),  statusCell('--danger',  'Delayed')],
  ['SO-48061', 'Coho Vineyard',            '4.9 d',  '$138,470', '39', '95.1%', tint('-$980',   '--success'), statusCell('--success', 'Delivered')],
  ['SO-48044', 'Graphic Design Institute', '6.0 d',  '$97,210',  '31', '90.6%', tint('+$430',   '--danger'),  statusCell('--accent',  'In transit')],
  ['SO-48022', 'Alpine Ski House',         '3.7 d',  '$186,050', '57', '97.3%', tint('-$1,420', '--success'), statusCell('--success', 'Delivered')],
  ['SO-48009', 'Blue Yonder Airlines',     '10.3 d', '$73,690',  '24', '79.8%', tint('+$5,110', '--danger'),  statusCell('--danger',  'Delayed')],
];
const ORDER_NUM = [2, 3, 4, 5, 6]; // right-aligned numeric columns

// ---- Low-density data table: open purchase orders. Same .ptable primitive, 6 columns
// (text · supplier · category · currency · lead time · status) so it reads like the
// procurement grid that sits under the "PO Volume by Category" chart. ----
const PO_COLS = ['PO number', 'Supplier', 'Category', 'PO value', 'Lead time', 'Status'];
const PO_ROWS = [
  ['PO-90412', 'Siemens AG',          'Direct',   '$482,100', '12 d', statusCell('--success', 'Approved')],
  ['PO-90388', 'Bosch Rexroth',       'Direct',   '$318,540', '18 d', statusCell('--accent',  'Pending')],
  ['PO-90355', 'Accenture',           'Services', '$126,900', '6 d',  statusCell('--success', 'Approved')],
  ['PO-90341', 'Grainger Industrial', 'Indirect', '$54,220',  '9 d',  statusCell('--success', 'Approved')],
  ['PO-90319', 'SAP SE',              'Services', '$264,780', '21 d', statusCell('--accent',  'Pending')],
  ['PO-90302', 'Honeywell',           'Direct',   '$391,050', '15 d', statusCell('--danger',  'On hold')],
  ['PO-90287', 'Fastenal',            'Indirect', '$38,470',  '4 d',  statusCell('--success', 'Approved')],
  ['PO-90261', 'Schneider Electric',  'Direct',   '$205,610', '11 d', statusCell('--success', 'Approved')],
  ['PO-90244', 'Deloitte',            'Services', '$148,300', '19 d', statusCell('--accent',  'Pending')],
  ['PO-90228', 'WW Grainger',         'Indirect', '$62,940',  '7 d',  statusCell('--danger',  'On hold')],
  ['PO-90205', 'ABB Ltd',             'Direct',   '$337,880', '14 d', statusCell('--success', 'Approved')],
];
const PO_NUM = [3, 4]; // right-aligned numeric columns (value, lead time)

// ---- 4 KPI tiles: one shared composition — a metric headline + delta pill + a flush
// area spark. Each tile carries its OWN accent hue (data-tint) and its OWN series shape
// (data-seed/base/amp/trend) so the row reads as four distinct-but-consistent KPIs.
// Built from .card/.metric primitives because the playground's pg-combo-kpi styles are
// scoped to the .pg-build gallery. ----
const insKpi = (k, vAttrs, vFallback, delta, kind, chart) => `
      <section class="card span-3 metric ins-kpi" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="ins-kpi-k">${k}</div>
        <div class="ins-kpi-row">
          <div class="ins-kpi-v" ${vAttrs}>${vFallback}</div>
          <span class="ins-delta ${kind}">${delta}</span>
        </div>
        ${chart}
      </section>`;

// each KPI carries a theme legend token (--legend-1..4) rather than a fixed hex, so the sparks
// follow the active theme/hue — distinct multi-colour under Color/Vivid, monochrome under Mono.
const insSpark = (attrs) =>
  `<div class="chart-wrap ins-spark" style="height:96px" data-chart="area" data-flush="1" ${attrs}></div>`;

// inline chart legend (swatch + label), same primitive the dashboards use.
const insLegend = items => '<div class="dash-legend center">' + items.map(([c, l]) =>
  '<span class="dash-legitem"><span class="dash-swatch" style="background:var(' + c + ')"></span>' + l + '</span>').join('') + '</div>';

const kpiRow =
  insKpi('Net revenue [EUR]',
    'data-counter data-to="4.82" data-prefix="&euro;" data-suffix="M" data-decimals="2"', '&euro;0M',
    '&#8593; 12.4%', 'pos',
    insSpark('data-tint="--legend-1" data-seed="17" data-base="58" data-amp="26" data-trend="1.0"')) +
  insKpi('Orders fulfilled',
    'data-counter data-to="3240"', '0',
    '&#8593; 6.1%', 'pos',
    insSpark('data-tint="--legend-2" data-seed="23" data-base="52" data-amp="18" data-trend="0.6"')) +
  insKpi('Automation rate',
    'data-counter data-to="73.2" data-suffix="%" data-decimals="1"', '0%',
    '&#8593; 4.3 pts', 'pos',
    insSpark('data-tint="--legend-3" data-seed="44" data-base="44" data-amp="12" data-trend="1.3"')) +
  insKpi('Avg cycle time',
    'data-counter data-to="6.4" data-suffix=" d" data-decimals="1"', '0 d',
    '&#8593; 0.4 d', 'neg',
    insSpark('data-tint="--legend-4" data-seed="71" data-base="66" data-amp="32" data-trend="0.4"'));

const ordersCard = `
      <section class="card span-12 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Order Detail</div>
        <div class="metric-sub">Recent sales orders — cycle time, value &amp; on-time performance <span class="i">i</span></div>
        <div class="ptable-scroll"><table class="ptable"><thead><tr>${
          ORDER_COLS.map((c, i) => `<th${ORDER_NUM.includes(i) ? ' class="num"' : ''}>${c}</th>`).join('')
        }</tr></thead><tbody>${
          ORDER_ROWS.map(r => `<tr>${
            r.map((cell, i) => `<td${ORDER_NUM.includes(i) ? ' class="num"' : ''}>${cell}</td>`).join('')
          }</tr>`).join('')
        }</tbody></table></div>
      </section>`;

// Full-width procurement grid shown under the "PO Volume by Category" chart in the Low density view.
const poTableCard = `
      <section class="card span-12 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Open Purchase Orders</div>
        <div class="metric-sub">Active POs by supplier &mdash; value, lead time &amp; approval status <span class="i">i</span></div>
        <div class="ptable-scroll"><table class="ptable"><thead><tr>${
          PO_COLS.map((c, i) => `<th${PO_NUM.includes(i) ? ' class="num"' : ''}>${c}</th>`).join('')
        }</tr></thead><tbody>${
          PO_ROWS.map(r => `<tr>${
            r.map((cell, i) => `<td${PO_NUM.includes(i) ? ' class="num"' : ''}>${cell}</td>`).join('')
          }</tr>`).join('')
        }</tbody></table></div>
      </section>`;

const tab1 = `
    <div class="bento" data-ins-panel="t1">
      ${kpiRow}

      <section class="card span-6 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Throughput Trend</div>
        <div class="metric-sub">Orders processed per month <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="combo" data-key="default" data-rightmax="80" data-leftlabel="80K" data-rightline="green"></div>
        ${insLegend([['--cstop-1a', 'Orders processed'], ['--line-2', 'On-time %']])}
      </section>

      <section class="card span-6 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Cumulative Value</div>
        <div class="metric-sub">Net value over time &mdash; this year vs last <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="linechart" data-ymax="400" data-xlabels="Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec" data-series='[{"c":"--cstop-1a","name":"This year","pts":[45,88,132,175,214,250,283,311,332,348,359,366]},{"c":"--cstop-2a","name":"Last year","pts":[40,74,110,145,176,203,227,247,263,275,283,289]}]'></div>
        ${insLegend([['--cstop-1a', 'This year'], ['--cstop-2a', 'Last year']])}
      </section>

      <section class="card span-4 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Channel Mix</div>
        <div class="metric-sub">Share by channel <span class="i">i</span></div>
        <div class="chart-wrap" style="aspect-ratio:1; max-width:260px; margin:0 auto;" data-chart="donut" data-segs='[["Web self-service",44,"--legend-1"],["Mobile app",29,"--legend-2"],["Partner / EDI",19,"--legend-3"],["Phone &amp; email",8,"--legend-4"]]'></div>
        ${insLegend([['--legend-1', 'Web self-service 44%'], ['--legend-2', 'Mobile app 29%'], ['--legend-3', 'Partner / EDI 19%'], ['--legend-4', 'Phone &amp; email 8%']])}
      </section>

      <section class="card span-8 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Volume by region</div>
        <div class="metric-sub">Cases handled per region, last 12 months <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="hbarcat" data-xmax="50000" data-xticks="0,10000,20000,30000,40000,50000" data-labelw="104" data-unit="cases" data-bars='[["North America",48200],["EMEA",41600],["APAC",33900],["LATAM",18400],["Middle East",12700],["Africa",8300],["Oceania",6100]]'></div>
        ${insLegend([['--cstop-1a', 'Cases handled &middot; last 12 months']])}
      </section>
      ${ordersCard}
    </div>`;

// ---- Low density (t2): a classic ops dashboard rebuilt from repo primitives.
// Top   = three KPI + chart "hero" tiles (the .ins-kpi composition, full-size chart).
// Middle = the standard span-12 .kpi-strip (4 cells) used across almost every view.
// Bottom = two vanilla builders — a stacked bar chart + a multi-series line chart. ----

// hero tile: label + big value + delta pill + subtitle, then a full chart that fills.
// span defaults to a third of the row; callers override for the 2/4 + 1/4 + 1/4 split.
const kpiChart = (label, sub, vAttrs, vFallback, delta, kind, chartHtml, span = 'span-4') => `
      <section class="card ${span} metric ins-kpi ins-kpi-lg" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="ins-kpi-k">${label}</div>
        <div class="ins-kpi-row">
          <div class="ins-kpi-v" ${vAttrs}>${vFallback}</div>
          <span class="ins-delta ${kind}">${delta}</span>
        </div>
        <div class="metric-sub">${sub}</div>
        ${chartHtml}
      </section>`;

// standard kpi-strip cell: label + count-up value + delta pill + a dim caption line.
const insCell = (label, vAttrs, vFallback, delta, kind, sub) =>
  '<div class="kpi">' +
    '<div class="k">' + label + ' <span class="i">i</span></div>' +
    '<div class="v"><span ' + vAttrs + '>' + vFallback + '</span></div>' +
    '<div class="ins-kpi-meta"><span class="ins-delta ' + kind + '">' + delta + '</span></div>' +
    '<div class="ins-kpi-sub">' + sub + '</div>' +
  '</div>';

const tab2 = `
    <div class="bento" data-ins-panel="t2" style="display:none;">
      ${kpiChart('Processing now', 'Net PO value across all suppliers &middot; updated 3 min ago',
        'data-counter data-to="2438901" data-prefix="$"', '$0',
        '&#8593; 12.4% vs prev period', 'pos',
        '<div class="chart-wrap" data-chart="barcat" data-ymax="2800000" data-yticks="0,1400000,2800000" data-color="--cstop-1a" data-bars=\'[["Jan",1620000],["Feb",1710000],["Mar",1780000],["Apr",1880000],["May",1955000],["Jun",2020000],["Jul",2110000],["Aug",2205000],["Sep",2280000],["Oct",2350000],["Nov",2405000],["Dec",2439000]]\'></div>',
        'span-6')}
      ${kpiChart('Cycle time target', 'Percent to on-time delivery plan',
        'data-counter data-to="57" data-suffix="%"', '0%',
        '&#8593; 4 days ahead', 'pos',
        '<div class="chart-wrap" style="aspect-ratio:1; max-width:200px; margin:0 auto;" data-chart="donut" data-segs=\'[["On-time",57,"--cstop-1a"],["Within grace",28,"--cstop-2a"],["Late",15,"--legend-3"]]\'></div>' +
        insLegend([['--cstop-1a', 'On-time 57%'], ['--cstop-2a', 'Within grace 28%'], ['--legend-3', 'Late 15%']]),
        'span-3')}
      ${kpiChart('Automation', 'Automated vs manual handling',
        'data-counter data-to="75" data-suffix="%"', '0%',
        'Capacity avg on track', 'flat',
        '<div class="chart-wrap" data-chart="linechart" data-ymax="100" data-xlabels="Q1|Q2|Q3|Q4" data-series=\'[{"c":"--cstop-1a","name":"Automated","pts":[58,64,70,75]},{"c":"--cstop-2a","name":"Manual","pts":[42,36,30,25]}]\'></div>' +
        insLegend([['--cstop-1a', 'Automated'], ['--cstop-2a', 'Manual']]),
        'span-3')}

      <section class="card span-12 kpi-strip kpi4" data-card style="min-height:auto;">
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        ${insCell('Processing now', 'data-counter data-to="1284"', '0', '&#8593; 12.4% this period', 'pos', 'Peak today 1,614')}
        ${insCell('Automation', 'data-counter data-to="64.2" data-suffix="%" data-decimals="1"', '0%', '&#8593; 0.6 pts', 'pos', '3 weeks rising')}
        ${insCell('Avg approval', 'data-counter data-to="184" data-suffix="h"', '0h', '&#8593; 12h regression', 'neg', 'Supplier batch delay')}
        ${insCell('Maverick buying', 'data-counter data-to="8" data-suffix="%"', '0%', '&#8595; 1.2 pts', 'pos', 'Off-contract spend within budget')}
      </section>

      <section class="card span-6 metric" data-card style="min-height:320px;">
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">PO Volume by Category</div>
        <div class="metric-sub">Monthly spend split by procurement type <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="stackbars" data-n="9" data-ymax="1000" data-seed="7" data-xlabels="Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep" data-series='[{"c":"--cstop-1a","w":5},{"c":"--cstop-2a","w":3},{"c":"--legend-2","w":1.5}]'></div>
        ${insLegend([['--legend-2', 'Direct'], ['--cstop-2a', 'Indirect'], ['--cstop-1a', 'Services']])}
      </section>

      <section class="card span-6 metric" data-card style="min-height:320px;">
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Order Volume by Location</div>
        <div class="metric-sub">Units shipped per region <span class="i">i</span></div>
        <div class="paxis-label">&uarr; units</div>
        <div class="chart-wrap" data-chart="linechart" data-fill="1" data-ymax="320" data-xlabels="Jan|Feb|Mar|Apr|May" data-series='[{"c":"--cstop-2a","name":"NAM","pts":[300,125,60,50,150]},{"c":"--cstop-1a","name":"EMEA","pts":[100,205,140,285,70]}]'></div>
        <div class="dash-xlabel">Month &rarr;</div>
        ${insLegend([['--cstop-2a', 'NAM'], ['--cstop-1a', 'EMEA']])}
      </section>

      ${poTableCard}
    </div>`;

// Empty scaffold panel for the not-yet-built tabs (hidden until its sub-tab is picked).
// Titled from the sub-tab's own label so the panel heading always matches the tab.
const placeholder = (id, label) =>
  `<div class="bento" data-ins-panel="${id}" style="display:none;">
      <section class="card span-12 metric" data-card style="min-height:240px;">
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">${label}</div>
        <div class="metric-sub">Content coming soon.</div>
      </section>
    </div>`;

registerView({
  id: 'insights',
  label: 'Showcase views 2.0',
  icon,
  // Header comes from the shared component with the standard Filters / panel / Edit buttons.
  html: buildAssetHeader({
    title: 'Showcase views 2.0',
    subtabs: { attr: 'data-inssub', items: SUBTABS },
  }) +
    tab1 +
    tab2 +
    SUBTABS.slice(2).map(t => placeholder(t.id, t.label)).join(''),

  render(viewEl) {
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-inssub]'));
    const panels = Array.from(viewEl.querySelectorAll('[data-ins-panel]'));

    tabs.forEach(tab => tab.addEventListener('click', e => {
      // ignore the close / drag affordances baked into every sub-tab
      if (e.target.closest('.x') || e.target.closest('.dots')) return;
      const id = tab.dataset.inssub;
      tabs.forEach(t => t.classList.toggle('on', t === tab));
      panels.forEach(p => { p.style.display = (p.dataset.insPanel === id) ? '' : 'none'; });
      // the newly revealed panel has real size now, so charts/counters can measure
      if (window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
