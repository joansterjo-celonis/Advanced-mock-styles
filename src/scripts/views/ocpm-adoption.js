// ============================================================
//  View: OCPM adoption view
// ============================================================
// Faithful reproduction of the Celonis "OCPM adoption view" (the
// "presales & CS projects" tab): a filter/overview panel with horizontal
// category-bar charts + KPIs, a presales table, and a failed "List of CS
// projects" widget. Registered as a standalone asset via the view registry.
// Its header (incl. many overflowing sub-tabs) is built from the shared
// asset-header component; the bar charts use the generic data-driven
// `hbarcat` builder in engine.js, so they react to the theme / density / 3D
// knobs like every other chart.

import { registerView } from '../engine.js';
import { icon as iconFor } from '../icons.js';
import { buildAssetHeader } from '../components/asset-header.js';

const icon = iconFor('view') + ' ';

/* ---- svg helpers ---- */
const s = (size, sw, inner) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';
const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';
const DL = s(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
const CHEV_L = s(14, 2.2, '<path d="m15 6-6 6 6 6"/>');
const CHEV_R = s(14, 2.2, '<path d="m9 6 6 6-6 6"/>');
const LIST = s(14, 2, '<path d="M4 6h16M4 12h16M4 18h16"/>');

/* ---- header extras specific to this view ----
   The bookmark/share/comments/more cluster, the predefined-filter pills, and the standard
   Filters / panel / Edit buttons all come from the shared header component; here we only add
   the "5 days" age badge (meta prefix). */
const ageBadge = '<span class="ocpm-age">' + s(13, 1.8, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '5 days</span>';

const tabNav = '<div class="ocpm-tabnav"><button class="ocpm-tnav" data-dir="-1" title="Scroll left">' + CHEV_L + '</button><button class="ocpm-tnav" data-dir="1" title="Scroll right">' + CHEV_R + '</button><button class="ocpm-tnav" title="All tabs">' + LIST + '</button></div>';

/* ---- generic horizontal category-bar chart ---- */
function hbar(bars, xmax, xticks, opts) {
  opts = opts || {};
  return '<div class="chart-wrap ocpm-hbar" data-chart="hbarcat" data-xmax="' + xmax + '" data-xticks="' + xticks + '"' +
    (opts.labelw ? ' data-labelw="' + opts.labelw + '"' : '') +
    " data-bars='" + JSON.stringify(bars) + "'></div>";
}

/* ---- table builder ---- */
function table(headers, rows) {
  const th = '<thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
  const tb = '<tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '<td class="tr-kebab"></td></tr>').join('') + '</tbody>';
  return '<div class="ptable-scroll"><table class="ptable">' + th + tb + '</table></div>';
}

const presalesHeaders = ['Account Name', 'Opportunity Name', 'Presales Name', 'Stage', 'Project Type', 'Owner Name', 'CreatedDate', 'Partner Implemen&hellip;', 'Process Mini&hellip;'];
const presalesRows = [
  ['HERAEUS HOLDING GmbH', 'Safe Harbor OnPrem&hellip;', 'Safe Harbor OnPrem&hellip;', '1 - Discovery', 'Value Assessment', 'Thomas Lippert', '2021-05-05', 'Customer', '-'],
  ['Exxon Mobil Corporation', 'Exxon Mobil Corpora&hellip;', 'Exxon Mobil Corpora&hellip;', '4 - Completed', 'Other', 'Philip Capps', '2021-05-06', 'Celonis', '-'],
  ['HARTING Stiftung &amp; Co', 'HARTING IT Services', 'HARTING IT Services', '4 - Completed', 'EMS Readiness (&hellip;)', 'Sara Medele', '2021-05-11', 'Celonis', 'Object centr&hellip;'],
  ['Antonio Puig SA', 'Antonio Puig Sa -&hellip;', 'Antonio Puig Sa -&hellip;', '4 - Completed', 'Value Assessment', 'Javier Sevilla', '2021-05-12', 'Partner', '-'],
];

/* ---- top filter/overview panel ---- */
const topPanel =
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-toprow">' +

      /* CS Projects column */
      '<div class="ocpm-col ocpm-side">' +
        '<div class="ocpm-coltitle">CS Projects</div>' +
        '<div class="ocpm-filter-dd">Filter on CS projects ' + s(11, 2.2, '<path d="m6 9 6 6 6-6"/>') + '</div>' +
        '<div class="ocpm-optlist">' +
          '<button class="ocpm-opt">ongoing CS project</button>' +
          '<button class="ocpm-opt">planned</button>' +
          '<button class="ocpm-opt">completed</button>' +
        '</div>' +
        '<div class="paxis-label">&uarr; Project Type</div>' +
        hbar([['Scoping', 950], ['Implementation', 430], ['Expert Services', 270], ['Add on', 175], ['Expert Service', 90]], 1000, '0,1000', { labelw: 48 }) +
        '<div class="ocpm-xlabel"># of projects &rarr;</div>' +
      '</div>' +

      /* middle column */
      '<div class="ocpm-col ocpm-mid">' +
        '<div class="ocpm-kpis">' +
          '<div class="ocpm-kpi"><div class="k"># of projects</div><div class="v">6,772</div></div>' +
          '<div class="ocpm-kpi"><div class="k"># of accounts</div><div class="v">734</div></div>' +
          '<div class="ocpm-kpi"><div class="k"># of presales</div><div class="v">5,709</div></div>' +
          '<div class="ocpm-kpi"><div class="k"># of accounts</div><div class="v">884</div></div>' +
        '</div>' +
        '<div class="ocpm-filterbar">' +
          '<span class="ocpm-fbtext">Filter accounts having either a PoV project OR CS project</span>' +
          '<div class="ocpm-seg"><button>ongoing</button><button>planned</button><button class="on">completed</button></div>' +
        '</div>' +
        '<div class="ocpm-filterbar"><span class="ocpm-fbtext">Filter accounts having no PoV project and no CS project</span></div>' +
        '<div class="ocpm-midcharts">' +
          '<div class="ocpm-chartcol">' +
            '<div class="paxis-label">&uarr; Project Stage</div>' +
            hbar([['Closed', 4300], ['Canceled', 520], ['Assignment Pending', 240], ['In Progress', 95]], 4500, '0,1000,2000,3000,4000', { labelw: 84 }) +
            '<div class="ocpm-xlabel"># of projects &rarr;</div>' +
          '</div>' +
          '<div class="ocpm-chartcol">' +
            '<div class="paxis-label">&uarr; Stage</div>' +
            hbar([['null', 1850], ['1 - Requested', 260], ['2 - Rejected', 120]], 2000, '0,1000,2000', { labelw: 56 }) +
            '<div class="ocpm-xlabel"># of presales &rarr;</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Presales (PoV) column */
      '<div class="ocpm-col ocpm-side">' +
        '<div class="ocpm-coltitle">Presales (PoV)</div>' +
        '<div class="ocpm-filter-dd">Filter on PoV projects ' + s(11, 2.2, '<path d="m6 9 6 6 6-6"/>') + '</div>' +
        '<div class="ocpm-optlist">' +
          '<button class="ocpm-opt">ongoing PoV</button>' +
          '<button class="ocpm-opt">planned PoV</button>' +
          '<button class="ocpm-opt">completed PoV</button>' +
        '</div>' +
        '<button class="ocpm-opt solo">process mining filter</button>' +
        '<div class="paxis-label">&uarr; Project_Type</div>' +
        hbar([['null', 1950], ['PoV', 1700], ['RFP', 520], ['Health Check', 240]], 2000, '0,2000', { labelw: 76 }) +
        '<div class="ocpm-xlabel"># of presales &rarr;</div>' +
      '</div>' +

    '</div>' +
  '</section>';

const presalesPanel = '<div class="bento ocpm-content" data-ocpanel="presales">' +
  topPanel +

  /* presales table */
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-cardhead"><div class="card-title">presales (PoVs after setting filter to PoV)</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
    table(presalesHeaders, presalesRows) +
  '</section>' +

  /* List of CS projects — failed widget */
  '<section class="card span-12" data-card style="min-height:200px;">' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="ocpm-cardhead"><div class="card-title">List of CS projects</div><span class="ocpm-dl" title="Download">' + DL + '</span></div>' +
    '<div class="ocpm-errstate"><span class="ocpm-errdot">!</span></div>' +
  '</section>' +
'</div>';

const emptyPanel = '<div class="bento ocpm-empty" data-ocpanel="empty" style="display:none;">' +
  '<section class="card span-12" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="tr-emptybox">' +
      '<svg class="tr-emico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8M8 17h5"/></svg>' +
      '<div class="tr-emt">Status</div>' +
      '<div>This section is not part of the prototype yet.</div>' +
    '</div>' +
  '</section>' +
'</div>';

registerView({
  id: 'ocpm-adoption',
  label: 'OCPM adoption view',
  icon,
  html: buildAssetHeader({
    title: 'OCPM adoption view',
    // standard meta cluster, prefixed with the "5 days" age badge
    meta: [ageBadge, 'bookmark', 'share', 'comments', 'more'],
    pills: [
      { k: 'Predefined filter', v: 'Enterprise / Sandbox&hellip;' },
      { k: 'Predefined filter', v: 'exclude PoV' },
      { k: 'Predefined filter', v: 'Direct Customers' },
    ],
    subtabs: {
      attr: 'data-ocsub',
      trailing: tabNav,
      items: [
        { id: 'actbreak2', label: 'activity breakdown II' },
        { id: 'proc', label: 'process, event &amp; objects' },
        { id: 'datajobs', label: 'data jobs' },
        { id: 'persp', label: 'perspectives' },
        { id: 'reuse', label: 'OCPM object re-use' },
        { id: 'valid', label: 'Validation' },
        { id: 'status', label: 'Status' },
        { id: 'presales', label: 'presales &amp; CS projects', on: true },
        { id: 'pqlquota', label: 'PQL quota' },
        { id: 'ccdm', label: 'ccdm version' },
      ],
    },
  }) + presalesPanel + emptyPanel,

  render(viewEl) {
    viewEl.classList.add('ocpm-view');
    const sub = viewEl.querySelector('.subtabs');
    const tabs = Array.from(viewEl.querySelectorAll('.subtab[data-ocsub]'));
    const presales = viewEl.querySelector('[data-ocpanel="presales"]');
    const empty = viewEl.querySelector('[data-ocpanel="empty"]');
    const emptyTitle = empty && empty.querySelector('.tr-emt');

    // overflow controls: ‹ › scroll the tab strip
    viewEl.querySelectorAll('.ocpm-tnav[data-dir]').forEach(b =>
      b.addEventListener('click', () => sub && sub.scrollBy({ left: 220 * parseInt(b.dataset.dir, 10), behavior: 'smooth' })));

    // center the active tab once the (initially hidden) view first becomes visible
    if (sub && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          const active = viewEl.querySelector('.subtab[data-ocsub].on');
          if (active) { const a = active.getBoundingClientRect(), r = sub.getBoundingClientRect(); sub.scrollLeft += (a.left - r.left) - r.width / 2 + a.width / 2; }
          io.disconnect();
        }
      });
      io.observe(viewEl);
    }

    tabs.forEach(s2 => s2.addEventListener('click', e => {
      if (e.target.closest('.x') || e.target.closest('.dots')) return;
      tabs.forEach(x => x.classList.remove('on'));
      s2.classList.add('on');
      const isP = s2.dataset.ocsub === 'presales';
      if (presales) presales.style.display = isP ? 'grid' : 'none';
      if (empty) empty.style.display = isP ? 'none' : 'grid';
      if (!isP && emptyTitle) emptyTitle.textContent = (s2.textContent || '').trim();
      if (isP && window.IA) { window.IA.renderChartsIn(viewEl); window.IA.runCounters(viewEl); }
    }));
  },
});
