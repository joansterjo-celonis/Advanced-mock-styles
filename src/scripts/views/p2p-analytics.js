// ============================================================
//  View: P2P Analytics  (Procure-to-Pay dashboard suite)
// ============================================================
// One registered asset with three sub-tabs, each a faithful rebuild of one of
// the three P2P prototype HTMLs — KPI Overview, Cycle Time and Approval
// Workflow. Only the composition and content come from the source HTML; all
// styling comes from the design system and every visualization is a chart-repo
// builder — a deliberately varied mix of vanilla (linechart / barcat / hbarcat)
// and bespoke (funnel / bullet / dotgrid waffle / dotplot lollipop / bubble
// quadrant / heatmap) buckets, so the views inherit the theme, density and 3D
// knobs automatically.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

import { kpiOverviewPanel } from './p2p/kpi-overview.js';
import { cycleTimePanel } from './p2p/cycle-time.js';
import { approvalWorkflowPanel } from './p2p/approval-workflow.js';

const icon = iconFor('view') + ' ';

const SUBTABS = [
  { id: 'kpi', label: 'KPI Overview', on: true },
  { id: 'cycle', label: 'Cycle Time' },
  { id: 'approval', label: 'Approval Workflow' },
];

const header = buildAssetHeader({
  title: 'Apollo views-revamped',
  pills: [
    { k: 'Predefined filter', v: 'FY 2024' },
    { k: 'Predefined filter', v: 'All Vendors' },
  ],
  subtabs: { attr: 'data-p2psub', items: SUBTABS },
});

registerView({
  id: 'p2p-analytics',
  label: 'Apollo views-revamped',
  icon,
  html: header + kpiOverviewPanel + cycleTimePanel + approvalWorkflowPanel,

  render(viewEl) {
    viewEl.classList.add('p2p-view');
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-p2psub]'));
    const panels = Array.from(viewEl.querySelectorAll('[data-p2p-panel]'));

    tabs.forEach(tab => tab.addEventListener('click', e => {
      // ignore the close / drag affordances baked into every sub-tab
      if (e.target.closest('.x') || e.target.closest('.dots')) return;
      const id = tab.dataset.p2psub;
      tabs.forEach(t => t.classList.toggle('on', t === tab));
      panels.forEach(p => { p.style.display = (p.dataset.p2pPanel === id) ? '' : 'none'; });
      // the newly revealed panel needs a measured render (hidden panels have 0 width)
      if (window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
