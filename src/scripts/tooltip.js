// Lightweight, scalable glass tooltip.
// One shared bubble for the whole app: any element with a [data-tip]
// attribute gets a frosted tooltip that follows the global --glass slider
// (the surface comes from the shared .glass class). Delegated listeners mean
// dynamically-added elements work too — no per-element wiring.

const tip = document.createElement('div');
tip.className = 'glass-tip glass';
tip.setAttribute('role', 'tooltip');
tip.setAttribute('aria-hidden', 'true');

let anchor = null;
let raf = 0;

function place() {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  let top = r.top - t.height - 8;
  const below = top < 6;
  if (below) top = r.bottom + 8;
  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(6, Math.min(left, window.innerWidth - t.width - 6));
  tip.style.top = Math.round(top) + 'px';
  tip.style.left = Math.round(left) + 'px';
  tip.classList.toggle('below', below);
}

function show(el) {
  const txt = el.getAttribute('data-tip');
  if (!txt) return;
  anchor = el;
  tip.textContent = txt;
  tip.classList.add('open');
  tip.setAttribute('aria-hidden', 'false');
  place();
}

function hide() {
  if (!anchor) return;
  anchor = null;
  tip.classList.remove('open');
  tip.setAttribute('aria-hidden', 'true');
}

function onScroll() {
  if (!anchor || raf) return;
  raf = requestAnimationFrame(() => { place(); raf = 0; });
}

function init() {
  document.body.appendChild(tip);
  document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-tip]');
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) hide();
  });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', hide);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', hide);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
