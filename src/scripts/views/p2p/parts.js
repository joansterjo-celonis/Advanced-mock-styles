// ============================================================
//  P2P Analytics — shared panel parts
// ============================================================
// Small, dependency-free HTML builders shared by the three P2P panels
// (KPI Overview / Cycle Time / Approval Workflow). Everything renders with
// the project's own primitives — .card / .kpi-strip / .ptable / .chart-wrap /
// .hpill / .dash-legend — so the panels inherit every theme, density and 3D
// knob for free. Panels only supply COMPOSITION + CONTENT; none of the source
// HTML's styling is copied.

/* ---- svg glyphs (stroke-based, same family as the shared header icons) ---- */
const svg = (size, sw, inner) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '">' + inner + '</svg>';

export const DL = svg(15, 1.8, '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>');
export const KEBAB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>';
const CHEV = svg(11, 2.4, '<path d="m6 9 6 6 6-6"/>');

/* ---- info bubble (opens the shared glass tooltip via [data-tip]) ---- */
export const info = tip => '<span class="i" tabindex="0" data-tip="' + tip + '">i</span>';

/* ---- card shell (gloss + rim match every other dashboard card) ---- */
export function card(spanClass, inner, style) {
  return '<section class="card ' + spanClass + '" data-card' + (style ? ' style="' + style + '"' : '') + '>' +
    '<span class="gloss"></span><span class="rim"></span>' + inner + '</section>';
}

/* ---- card title (+ optional info bubble) ---- */
export function cardTitle(text, tip) {
  return '<div class="card-title">' + text + (tip ? ' ' + info(tip) : '') + '</div>';
}

/* ---- chart wrap: type + a raw data-* attribute string (keeps JSON quoting simple) ---- */
export function chart(type, attrs, extraClass, style) {
  return '<div class="chart-wrap' + (extraClass ? ' ' + extraClass : '') + '" data-chart="' + type + '"' +
    (attrs ? ' ' + attrs : '') + (style ? ' style="' + style + '"' : '') + '></div>';
}

/* ---- filter pill row (reuses the header .hpill look; spans the full grid) ---- */
export function filterRow(pills) {
  return '<div class="p2p-filters">' + pills.map(([k, v]) =>
    '<div class="hpill"><span class="hp-k">' + k + '</span>' +
    '<span class="hp-v">' + v + CHEV + '</span></div>').join('') + '</div>';
}

/* ---- status badge (semantic: ok / warn / crit) ---- */
export function badge(kind, text) {
  return '<span class="p2p-badge ' + kind + '">' + text + '</span>';
}

/* ---- compact kpi-strip cell (count-up numeral + optional delta subtext) ---- */
export function kpiCell(label, o = {}) {
  const val = o.text != null
    ? '<div class="v">' + o.text + '</div>'
    : '<div class="v"><span data-counter data-to="' + o.to + '"' +
        (o.decimals ? ' data-decimals="' + o.decimals + '"' : '') +
        (o.prefix ? ' data-prefix="' + o.prefix + '"' : '') +
        (o.suffix ? ' data-suffix="' + o.suffix + '"' : '') + '>0</span></div>';
  const delta = o.delta ? '<span class="p2p-delta ' + (o.deltaKind || 'flat') + '">' + o.delta + '</span>' : '';
  return '<div class="kpi"><div class="k">' + label + (o.tip ? ' ' + info(o.tip) : '') + '</div>' + val + delta + '</div>';
}

/* ---- rich KPI card (label · big value · target line · optional mini-viz · badge).
   Mini-viz is either a `bullet` spec ({value,target,max,bands,color,unit}) or any
   raw chart HTML via `viz` (e.g. a dotgrid waffle) — keeps the card open to creative
   micro-charts, not just bullets. Pass `span` (e.g. 'span-4') to reuse the exact
   same component as a standalone bento card outside the compact KPI row. ---- */
export function kpiCardBig(o = {}) {
  const val = o.text != null
    ? '<div class="p2p-kval">' + o.text + '</div>'
    : '<div class="p2p-kval"><span data-counter data-to="' + o.to + '"' +
        (o.decimals ? ' data-decimals="' + o.decimals + '"' : '') +
        (o.prefix ? ' data-prefix="' + o.prefix + '"' : '') +
        (o.suffix ? ' data-suffix="' + o.suffix + '"' : '') + '>0</span></div>';
  const target = (o.target || o.delta)
    ? '<div class="p2p-ktarget"><span>' + (o.target || '') + '</span>' +
        (o.delta ? '<span class="p2p-kdelta ' + (o.deltaKind || 'flat') + '">' + o.delta + '</span>' : '') + '</div>'
    : '';
  const viz = o.viz ? o.viz
    : (o.bullet
        ? chart('bullet',
            'data-value="' + o.bullet.value + '" data-target="' + o.bullet.target + '" data-max="' + o.bullet.max + '"' +
            (o.bullet.bands ? ' data-bands="[' + o.bullet.bands.join(',') + ']"' : '') +
            (o.bullet.color ? ' data-color="' + o.bullet.color + '"' : '') +
            (o.bullet.unit ? ' data-unit="' + o.bullet.unit + '"' : ''),
            'p2p-kbullet')
        : '');
  const foot = o.badge ? '<div class="p2p-kfoot">' + badge(o.badge[0], o.badge[1]) + '</div>' : '';
  return '<section class="card ' + (o.span ? o.span + ' ' : '') + 'p2p-kcard" data-card>' +
    '<span class="gloss"></span><span class="rim"></span>' +
    '<div class="p2p-klabel">' + o.label + (o.tip ? ' ' + info(o.tip) : '') + '</div>' +
    val + target + viz + foot + '</section>';
}

/* ---- definition-style summary stat list ---- */
export function statList(items) {
  return '<div class="p2p-statlist">' + items.map(([l, v]) =>
    '<div class="p2p-statrow"><span class="l">' + l + '</span><span class="v">' + v + '</span></div>').join('') + '</div>';
}

/* ---- inline chart legend (swatch + label) ---- */
export function legend(items, center) {
  return '<div class="dash-legend' + (center ? ' center' : '') + '">' + items.map(([c, l]) =>
    '<span class="dash-legitem"><span class="dash-swatch" style="background:var(' + c + ')"></span>' + l + '</span>').join('') + '</div>';
}

/* ---- data table (.ptable) with a trailing kebab column, matching the other views.
   `cells` may contain raw HTML (e.g. badges). numIdx = right-aligned numeric columns. ---- */
export function table(cols, rows, numIdx = []) {
  const th = '<thead><tr>' + cols.map((c, ci) =>
    '<th' + (numIdx.indexOf(ci) >= 0 ? ' class="num"' : '') + '>' + c + '</th>').join('') +
    '<th class="tr-kebab">' + KEBAB + '</th></tr></thead>';
  const tb = '<tbody>' + rows.map(r =>
    '<tr>' + r.map((c, i) =>
      '<td' + (numIdx.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + c + '</td>').join('') +
    '<td class="tr-kebab"></td></tr>').join('') + '</tbody>';
  return '<div class="ptable-scroll"><table class="ptable">' + th + tb + '</table></div>';
}
