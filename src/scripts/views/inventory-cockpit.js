// ============================================================
//  View: Inventory Cockpit 2.0  (Overview tab)
// ============================================================
// Faithful reproduction of the "Inventory Cockpit 2.0" dashboard. A right-hand
// "Filter By Attribute" drawer (toggled by the blue header button, same as the
// OCPM activity view) plus six stock sections — Total Stock, Unrestricted, Q-
// Stock, Blocked, Rework and thereof Disposal — each laid out as left KPIs ·
// centre chart · right KPIs. The screenshot's redacted pills are realised as
// real KPI cells. Charts use the generic data-driven `stackbars` builder (with
// the optional trend-line overlay) so they react to theme / density / 3D knobs.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';

/* ---- svg helpers ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const CHEV = s(11, 2.2, '<path d="m6 9 6 6 6-6"/>');
const DET = s(10, 2.2, '<path d="m9 6 6 6-6 6"/>');
const INFO = s(13, 1.8, '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>');
const GRID = s(14, 1.9, '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>');

/* ---- header extras ---- */
const ageBadge = '<span class="ocpm-age">' + s(13, 1.8, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '11 minutes</span>';

/* ---- KPI cells (these replace the screenshot's redacted pills) ---- */
const kpi = (k, v, o) => { o = o || {};
  return '<div class="inv-kpi' + (o.big ? ' big' : '') + '">' +
    '<div class="k">' + k + '</div>' +
    '<div class="v">' + v + (o.u ? '<span class="u">' + o.u + '</span>' : '') + '</div>' +
    (o.det ? '<span class="det">Details' + DET + '</span>' : '') +
  '</div>';
};
const kd = (k, v, dir) => '<div class="inv-kpi"><div class="k">' + k + '</div><div class="d ' + (dir || 'down') + '">' + v + '</div></div>';

/* ---- HTML chart legend ---- */
const leg = items => '<div class="ocpm2-legend">' + items.map(it =>
  typeof it === 'string' ? '<span>' + it + '</span>'
  : '<span class="ocpm2-legitem"><span class="ocpm2-swatch" style="background:var(' + it.c + ')"></span>' + it.t + '</span>').join('') + '</div>';

const chart = attrs => '<div class="chart-wrap inv-chart" data-chart="stackbars" ' + attrs + '></div>';
const MONTHS = '2024-07|2024-10|2025-01|2025-04|2025-07';

/* ============ TOP KPI ROW (4 cards) ============ */
const topRow =
  '<section class="card span-3" data-card><span class="gloss"></span><span class="rim"></span>' + kpi('Total', '1,284', { big: true, u: 'm€' }) + '</section>' +
  '<section class="card span-3" data-card><span class="gloss"></span><span class="rim"></span>' + kpi('Quality', '64', { big: true, u: 'm€' }) + '</section>' +
  '<section class="card span-3" data-card><span class="gloss"></span><span class="rim"></span>' + kpi('Sales', '312', { big: true, u: 'm€' }) + '</section>' +
  '<section class="card span-3" data-card><span class="gloss"></span><span class="rim"></span>' + kpi('Recipe Desk', '24', { big: true, u: 'm€' }) + '</section>';

/* ============ TOTAL STOCK (span-12) ============ */
const mcol = (name, me, kt, d, dir) => '<div class="inv-mcol">' + kpi(name + ' [m€]', me, { u: '€' }) + kpi(name + ' [kt]', kt) + kd('12M Delta', d, dir) + '</div>';
const totalStock =
  '<section class="card span-12" data-card><span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">Total Stock</div>' +
    '<div class="inv-body">' +
      '<div class="inv-left">' + kpi('Total Stock [m€]', '1,284', { big: true, u: 'm€' }) + kpi('Total Stock [kt]', '342') + kd('12M Delta', '-4.2 %', 'down') + '</div>' +
      '<div class="inv-mid">' +
        '<button class="inv-chartbtn">' + GRID + 'Total / KPI Drilldown</button>' +
        '<div class="paxis-label">Total Stock [m€]</div>' +
        chart('data-n="13" data-ymax="1500" data-seed="3" data-line="--cstop-4a" data-xlabels="' + MONTHS + '" data-series=\'[{"c":"--cstop-1a","w":4},{"c":"--cstop-1b","w":2.6},{"c":"--cstop-2a","w":2.4},{"c":"--cstop-3a","w":1.2},{"c":"--cstop-4a","w":0.5}]\'') +
        leg([{ c: '--cstop-1a', t: 'Raw [m€]' }, { c: '--cstop-1b', t: 'Sales [m€]' }, { c: '--cstop-2a', t: 'Finished [m€]' }, { c: '--cstop-3a', t: 'Others [m€]' }, { c: '--cstop-4a', t: 'Unassigned' }]) +
      '</div>' +
      '<div class="inv-right"><div class="inv-matrix">' +
        mcol('Raw', '486', '142', '-2.1 %', 'down') +
        mcol('Sales', '312', '78', '+1.4 %', 'up') +
        mcol('Finished', '298', '64', '-3.2 %', 'down') +
        mcol('Others', '142', '38', '+0.8 %', 'up') +
        mcol('Unassigned', '46', '20', '-1.1 %', 'down') +
      '</div></div>' +
    '</div>' +
  '</section>';

/* ============ UNRESTRICTED (FREE) STOCK (span-12) ============ */
const unrestricted =
  '<section class="card span-12" data-card><span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">Unrestricted (Free) Stock</div>' +
    '<div class="inv-body">' +
      '<div class="inv-left">' + kpi('Unrestricted [m€]', '918', { big: true, u: 'm€' }) + kpi('Unrestricted [kt]', '264') + kd('12M Delta', '-1.8 %', 'down') + '</div>' +
      '<div class="inv-mid">' +
        '<div class="paxis-label">Unrestricted [kt]</div>' +
        chart('data-n="13" data-ymax="400000" data-seed="7" data-line="--cstop-3a" data-xlabels="' + MONTHS + '" data-series=\'[{"c":"--cstop-1a"}]\'') +
        leg([{ c: '--cstop-1a', t: 'Unrestricted [k]' }, { c: '--cstop-3a', t: 'Unrestricted [kt]' }]) +
      '</div>' +
      '<div class="inv-right"><div class="inv-kpilist">' +
        kpi('ID Turns - Overall', '4.2', { det: true }) +
        kpi('FGDV &gt; 90 Days', '8.4 %') +
        kpi('Scrap-To-Expire [m€]', '12', { u: '€', det: true }) +
        kpi('No Forecast NIM [m€]', '22', { u: '€' }) +
        kpi('Non-Mover [m€]', '38', { u: '€', det: true }) +
        kpi('CCDV &gt; 90 Days', '5.1 %') +
        kpi('Slow-Mover (Excess) [m€]', '64', { u: '€', det: true }) +
      '</div></div>' +
    '</div>' +
  '</section>';

/* ============ small section (Q-Stock / Blocked / Rework / Disposal) ============ */
function smallSection(title, btn, leftK, chartAttrs, legItems, rightK) {
  return '<section class="card span-6" data-card><span class="gloss"></span><span class="rim"></span>' +
    '<div class="card-title">' + title + '</div>' +
    '<div class="inv-body">' +
      '<div class="inv-left">' + leftK + '</div>' +
      '<div class="inv-mid">' +
        (btn ? '<button class="inv-chartbtn">' + GRID + btn + '</button>' : '') +
        chart(chartAttrs) + leg(legItems) +
      '</div>' +
      '<div class="inv-right"><div class="inv-kpilist one">' + rightK + '</div></div>' +
    '</div>' +
  '</section>';
}

const qStock = smallSection('Q-Stock', 'Cockpit',
  kpi('Q-Stock [m€]', '64', { big: true, u: 'm€' }) + kpi('Q-Stock [kt]', '18') + kd('12M Delta', '+2.4 %', 'up'),
  'data-n="13" data-ymax="40000" data-seed="11" data-line="--cstop-3a" data-xlabels="' + MONTHS + '" data-series=\'[{"c":"--cstop-1a"}]\'',
  [{ c: '--cstop-1a', t: 'Q-Stock [k]' }, { c: '--cstop-3a', t: 'Q-Stock [kt]' }],
  kpi('Expired Q-Stock [m€]', '6', { u: '€' }) + kpi('WIP Exceeded [m€]', '14', { u: '€' }) + kpi('UD Overdue [m€]', '4', { u: '€' }));

const blocked = smallSection('Blocked Stock', 'L3 Cockpit',
  kpi('Blocked [m€]', '28', { big: true, u: 'm€' }) + kpi('Blocked [kt]', '9') + kd('12M Delta', '-0.9 %', 'down'),
  'data-n="13" data-ymax="30000" data-seed="13" data-line="--cstop-3a" data-xlabels="' + MONTHS + '" data-series=\'[{"c":"--cstop-1a"}]\'',
  [{ c: '--cstop-1a', t: 'Blocked [k]' }, { c: '--cstop-3a', t: 'Blocked [kt]' }],
  kpi('Blocked Stock &gt;7 days [m€]', '12', { u: '€' }) + kpi('ID Days since Blocking', '34') + kpi('Expired Blocked Stock [m€]', '3', { u: '€' }));

const rework = smallSection('Rework', 'Cockpit',
  kpi('Rework [m€]', '9', { big: true, u: 'm€' }) + kpi('Rework [kt]', '3') + kd('12M Delta', '-1.2 %', 'down'),
  'data-n="13" data-ymax="6000" data-seed="17" data-line="--cstop-3a" data-xlabels="' + MONTHS + '" data-series=\'[{"c":"--cstop-1a"}]\'',
  [{ c: '--cstop-1a', t: 'Rework [k]' }, { c: '--cstop-3a', t: 'Rework [m€]' }],
  kpi('# Rework Batches', '142') + kpi('Without Consumption [m€]', '5', { u: '€' }));

const disposal = smallSection('thereof Disposal', 'Cockpit',
  kpi('Total Disposal [m€]', '7', { big: true, u: 'm€' }) + kpi('Additional Disposal [kt]', '2') + kpi('Disposal Stock', '18'),
  'data-n="13" data-ymax="6000" data-seed="19" data-line="--cstop-3a" data-xlabels="' + MONTHS + '" data-series=\'[{"c":"--cstop-1a"}]\'',
  [{ c: '--cstop-1a', t: 'Disposal [k]' }, { c: '--cstop-3a', t: 'Disposal [m€]' }],
  kpi('# Batches Marked for Disposal', '64'));

const dashboard = '<div class="bento inv-content" data-invpanel="overview">' +
  topRow + totalStock + unrestricted + qStock + blocked + rework + disposal + '</div>';

const emptyPanel = '<div class="bento inv-empty" data-invpanel="empty" style="display:none;">' +
  '<section class="card span-12" data-card><span class="gloss"></span><span class="rim"></span>' +
    '<div class="tr-emptybox">' +
      '<svg class="tr-emico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8M8 17h5"/></svg>' +
      '<div class="tr-emt">Material Details</div>' +
      '<div>This section is not part of the prototype yet.</div>' +
    '</div>' +
  '</section></div>';

/* ---- filter drawer ("Filter By Attribute") ---- */
const dd = label => '<div class="ocpm2-fctl"><span>' + label + '</span>' + CHEV + '</div>';
const ATTRS = ['Plant Cluster', 'Plant', 'Inventory Group', 'Inventory Group L1', 'Inventory Group L2', 'Inventory Group L3', 'Valuation Class', 'Valuation Class Cluster', 'SC Classification', 'Material L1', 'Material L2', 'Material L3', 'Raw Material', 'Product Type', 'B2B Level 1', 'B2B Level 2', 'Unrestricted Stock Owner', 'KPI Indicator', 'SPM Material', 'SPM Material (External/Internal)', 'Procurement Type', 'Batch Shelf Life Status'];
const filterBar =
  '<aside class="ocpm2-fbar"><div class="ocpm2-fbar-inner">' +
    '<div class="ocpm2-fbar-head">Filter <span class="x" title="Close">' + s(13, 2.2, '<path d="M6 6l12 12M18 6L6 18"/>') + '</span></div>' +
    '<div class="inv-fhead-info">' + INFO + 'Information</div>' +
    '<div class="inv-fbar-attr">Filter By Attribute</div>' +
    '<div class="ocpm2-fsec" style="border-top:0;padding-top:4px;">' + ATTRS.map(dd).join('') + '</div>' +
  '</div></aside>';

registerView({
  id: 'inventory-cockpit',
  label: 'Inventory Cockpit 2.0',
  icon,
  html: buildAssetHeader({
    title: 'Inventory Cockpit 2.0',
    meta: [ageBadge, 'bookmark', 'share', 'comments', 'more'],
    subtabs: {
      attr: 'data-invsub',
      trailing: '',
      items: [
        { id: 'overview', label: 'Overview', on: true },
        { id: 'material', label: 'Material Details' },
        { id: 'batch', label: 'Batch Details' },
      ],
    },
  }) +
  '<div class="ocpm2-body" data-fbar="open"><div class="ocpm2-main">' + dashboard + emptyPanel + '</div>' + filterBar + '</div>',

  render(viewEl) {
    viewEl.classList.add('ocpm-view', 'inv-view');
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-invsub]'));
    const overview = viewEl.querySelector('[data-invpanel="overview"]');
    const empty = viewEl.querySelector('[data-invpanel="empty"]');
    const emptyTitle = empty && empty.querySelector('.tr-emt');

    // The filter drawer (.ocpm2-fbar) is toggled by the shared header panel button (.fbar-btn)
    // and its own "x" — both wired once, globally, in engine.js. Sync the button's pressed
    // state to the drawer's initial (open) state.
    const fbarBtn = viewEl.querySelector('.fbar-btn'), fbarBody = viewEl.querySelector('.ocpm2-body');
    if (fbarBtn && fbarBody) fbarBtn.classList.toggle('on', fbarBody.getAttribute('data-fbar') === 'open');

    tabs.forEach(s2 => s2.addEventListener('click', e => {
      if (e.target.closest('.x') || e.target.closest('.dots')) return;
      tabs.forEach(x => x.classList.remove('on'));
      s2.classList.add('on');
      const isOv = s2.dataset.invsub === 'overview';
      if (overview) overview.style.display = isOv ? 'grid' : 'none';
      if (empty) empty.style.display = isOv ? 'none' : 'grid';
      if (!isOv && emptyTitle) emptyTitle.textContent = (s2.textContent || '').trim();
      if (isOv && window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
