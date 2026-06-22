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

registerView({
  id: 'insights',
  label: 'Insights',
  icon,
  // Header comes from the shared component — Insights only needs the edit action.
  html: buildAssetHeader({ title: 'Insights', actions: ['edit'] }) + `

    <div class="bento">
      <section class="card span-12 kpi-strip" data-card style="min-height:auto;">
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="kpi"><div class="k">Active Cases <span style="opacity:.5">&#9432;</span></div><div class="v" data-counter data-to="12480">0</div></div>
        <div class="kpi"><div class="k">Avg Cycle Time <span style="opacity:.5">&#9432;</span></div><div class="v" data-counter data-to="6.4" data-suffix=" d" data-decimals="1">0</div></div>
        <div class="kpi"><div class="k">Automation Rate <span style="opacity:.5">&#9432;</span></div><div class="v" data-counter data-to="73.2" data-suffix="%" data-decimals="1">0</div></div>
      </section>

      <section class="card span-6 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Throughput Trend</div>
        <div class="metric-sub">Orders processed per month <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="combo" data-key="default" data-rightmax="80" data-leftlabel="80K"></div>
      </section>

      <section class="card span-6 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Cumulative Value</div>
        <div class="metric-sub">Net value over time <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="area"></div>
      </section>

      <section class="card span-4 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Channel Mix</div>
        <div class="metric-sub">Share by channel <span class="i">i</span></div>
        <div class="chart-wrap" style="aspect-ratio:1; max-width:260px; margin:0 auto;" data-chart="donut"></div>
      </section>

      <section class="card span-4 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Daily Variance</div>
        <div class="metric-sub">Deviation by day <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="dots"></div>
      </section>

      <section class="card span-4 metric" data-card>
        <span class="gloss"></span><span class="sheen"></span><span class="rim"></span>
        <div class="card-title">Monthly Volume</div>
        <div class="metric-sub">Cases per month <span class="i">i</span></div>
        <div class="chart-wrap" data-chart="pbars"></div>
      </section>
    </div>
  `,
});
