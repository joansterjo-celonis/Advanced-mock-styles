// ============================================================
//  Functional chart tooltips.
//  Charts are SVG and get fully re-rendered on every knob/theme
//  change, so per-element listeners would die. Instead each chart
//  renderer tags its data slots with [data-ctip] (+ optional
//  [data-ctip-rows]); this module owns ONE shared glass bubble and
//  a single delegated pointer listener, so it survives re-renders.
//
//  Encoding (set by engine.js setTip()):
//    data-ctip       = title line
//    data-ctip-rows  = "label\u001fvalue" pairs joined by \u001e
// ============================================================

const RS = '\u001e'; // row separator
const US = '\u001f'; // label/value separator

const tip = document.createElement('div');
tip.className = 'chart-tip glass';
tip.setAttribute('role', 'tooltip');
tip.setAttribute('aria-hidden', 'true');
document.body.appendChild(tip);

let curEl = null;        // element whose content is currently shown
let curSig = '';         // content signature so a single host (e.g. a WebGL canvas) can update its rows as the hovered datum changes
let visible = false;
let px = 0, py = 0;      // last pointer position
let raf = 0;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(el) {
  const title = el.getAttribute('data-ctip');
  const rowsRaw = el.getAttribute('data-ctip-rows');
  let html = '';
  if (title) html += '<div class="ct-title">' + esc(title) + '</div>';
  if (rowsRaw) {
    html += '<div class="ct-rows">' + rowsRaw.split(RS).map(r => {
      const idx = r.indexOf(US);
      const l = idx >= 0 ? r.slice(0, idx) : r;
      const v = idx >= 0 ? r.slice(idx + 1) : '';
      return '<div class="ct-row"><span class="ct-l">' + esc(l) +
             '</span><span class="ct-v">' + esc(v) + '</span></div>';
    }).join('') + '</div>';
  }
  tip.innerHTML = html;
}

function position() {
  raf = 0;
  if (!visible) return;
  const pad = 12;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = px + 16, y = py + 16;
  if (x + w + pad > window.innerWidth) x = px - w - 16;   // flip left near right edge
  if (x < pad) x = pad;
  if (y + h + pad > window.innerHeight) y = py - h - 16;   // flip up near bottom edge
  if (y < pad) y = pad;
  tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
}

function show() {
  if (!visible) { visible = true; tip.classList.add('open'); tip.setAttribute('aria-hidden', 'false'); }
}
function hide() {
  if (!visible) return;
  visible = false; curEl = null; curSig = '';
  tip.classList.remove('open');
  tip.setAttribute('aria-hidden', 'true');
}

document.addEventListener('pointermove', (e) => {
  // ignore touch/coarse pointers — they have no hover affordance
  if (e.pointerType === 'touch') { hide(); return; }
  const el = e.target && e.target.closest ? e.target.closest('[data-ctip]') : null;
  if (!el) { hide(); return; }
  px = e.clientX; py = e.clientY;
  // Re-render on element change OR content change (the WebGL canvas keeps the same
  // host element but rewrites data-ctip/-rows as you move between 3D datums).
  const sig = (el.getAttribute('data-ctip') || '') + '\u0001' + (el.getAttribute('data-ctip-rows') || '');
  if (el !== curEl || sig !== curSig) { curEl = el; curSig = sig; render(el); }
  show();
  if (!raf) raf = requestAnimationFrame(position);
}, { passive: true });

// Hide when the underlying chart is rebuilt or removed, or on scroll/leave.
document.addEventListener('pointerleave', hide);
window.addEventListener('scroll', hide, true);
window.addEventListener('resize', hide);
