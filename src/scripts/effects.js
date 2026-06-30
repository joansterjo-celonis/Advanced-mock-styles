// ============================================================
//  Reusable visual-effects layer.
//  SVG isometric / glass / sheen builders + colour-resolution utils,
//  shared by every chart. Import these to add new glassy effects
//  without reaching into engine.js.
// ============================================================

const NS = 'http://www.w3.org/2000/svg';
export function E(t, a){ const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); return e; }

let _gid = 0;
export function nextGid(){ return _gid++; }

export function svgText(E2,x,y,s,a){ const t=E2('text',{x:x,y:y,'text-anchor':a||'start','font-size':9,fill:'rgba(128,128,128,0.85)','font-family':'Inter,sans-serif'}); t.textContent=s; return t; }

/* ============================================================
   3D / GLASS chart toolkit — shared across every chart type.
   Reads the live theme colours (CSS vars) so Mono/Color/Vivid/hue all apply.
   mode: null (flat) | 'iso' (isometric extrusion) | 'glass' (frosted low-relief)
   ============================================================ */
export function chartMode(wrap){ // returns 'iso'|'glass'|'webgl'|null
  // per-chart override (right-click menu) wins over the global knobs
  const ov = wrap && wrap.getAttribute ? wrap.getAttribute('data-chart-look') : null;
  if(ov==='flat') return null;
  if(ov==='iso' || ov==='glass' || ov==='webgl') return ov;
  // otherwise follow the global Charts-look + 3D-scope knobs
  const look = document.documentElement.getAttribute('data-charts3d'); if(!look) return null;
  let scope = document.documentElement.getAttribute('data-3dscope') || 'full';
  // The Rework & Quality galleries are an explicit style showcase: every chart there exists to
  // demonstrate the chosen look, so it should follow the iso/glass knob regardless of the
  // accent/full "extent" knob (which only exists to keep real dashboards from over-decorating).
  if(scope==='accent' && wrap && wrap.closest && wrap.closest('.rq-gallery')) scope='full';
  if(scope==='off') return null;
  if(scope==='accent') return (wrap && wrap.closest && wrap.closest('[data-hero]')) ? look : null;
  return look; // 'full'
}
// Resolve a CSS custom property. Pass `el` (e.g. a chart container) to read its
// cascaded value — this lets per-card overrides (right-click → Invert) reach baked
// chart colours; defaults to :root so existing callers are unaffected.
export function cssVar(name, el){ return getComputedStyle(el||document.documentElement).getPropertyValue(name).trim(); }
const _ccx = (function(){ try { return document.createElement('canvas').getContext('2d'); } catch(e){ return null; } })();
export function toRGB(c){ // resolve any CSS colour string -> {r,g,b}
  if(!_ccx) return {r:128,g:128,b:128};
  _ccx.fillStyle='#888'; try{ _ccx.fillStyle=c; }catch(e){}
  let s=_ccx.fillStyle;
  if(s[0]==='#'){ let h=s.slice(1); if(h.length===3)h=h.split('').map(x=>x+x).join(''); const n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
  const m=s.match(/\d+(\.\d+)?/g); return m?{r:+m[0],g:+m[1],b:+m[2]}:{r:128,g:128,b:128};
}
export function shadeC(c,amt){ const {r,g,b}=toRGB(c); const t=amt<0?0:255,p=Math.abs(amt); const f=v=>Math.round((t-v)*p+v); return `rgb(${f(r)},${f(g)},${f(b)})`; }
export function rgbaC(c,a){ const {r,g,b}=toRGB(c); return `rgba(${r},${g},${b},${a})`; }
export function resolveColor(c, el){ const m=/var\((--[^),]+)\)/.exec(c||''); return m?cssVar(m[1], el):c; }
// soft drop-shadow filter (added once per svg) — id returned
export function ensureSoftShadow(svg, dy, blur, alpha){
  let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs, svg.firstChild); }
  const id='sh'+(nextGid());
  const f=E('filter',{id:id,x:'-30%',y:'-30%',width:'160%',height:'160%'});
  const fe=E('feDropShadow',{dx:0,dy:dy,'stdDeviation':blur,'flood-color':'#000','flood-opacity':alpha}); f.appendChild(fe);
  defs.appendChild(f); return id;
}
// cached white sheen gradient (soft glass highlight) per svg + direction
export function sheenGrad(svg, horiz){
  const key=horiz?'_shH':'_shV'; if(svg[key]) return svg[key];
  let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);}
  const id=(horiz?'shh':'shv')+(nextGid()); const lg=E('linearGradient',{id:id,x1:0,y1:0,x2:horiz?1:0,y2:horiz?0:1});
  lg.appendChild(E('stop',{offset:'0%','stop-color':'rgba(255,255,255,0.5)'}));
  lg.appendChild(E('stop',{offset:'45%','stop-color':'rgba(255,255,255,0.1)'}));
  lg.appendChild(E('stop',{offset:'100%','stop-color':'rgba(255,255,255,0)'}));
  defs.appendChild(lg); svg[key]=id; return id;
}
// glossy sphere marker
export function sphere(svg, x, y, rad, color){
  const gid='sp'+(nextGid()); const rg=E('radialGradient',{id:gid,cx:'34%',cy:'28%',r:'75%'});
  rg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(color,0.55)}));
  rg.appendChild(E('stop',{offset:'52%','stop-color':color}));
  rg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(color,-0.38)}));
  let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);} defs.appendChild(rg);
  const c=E('circle',{cx:x,cy:y,r:rad,fill:`url(#${gid})`}); svg.appendChild(c); return c;
}
// vertical glassy/iso bar. (x,y)=top-left of front face; grows down to y+h.
export function bar3dV(svg, x, y, w, h, color, mode){
  if(h<0.5) h=0.5;
  const g=E('g',{});
  if(mode==='iso'){
    const d=Math.max(3, Math.min(w*0.55, 16)); const dx=d*0.82, dy=-d*0.5;
    // side (right) — darkest
    const side=E('path',{d:`M${x+w},${y} L${x+w+dx},${y+dy} L${x+w+dx},${y+h+dy} L${x+w},${y+h} Z`}); side.style.fill=shadeC(color,-0.26); g.appendChild(side);
    // top — lightest
    const top=E('path',{d:`M${x},${y} L${x+dx},${y+dy} L${x+w+dx},${y+dy} L${x+w},${y} Z`}); top.style.fill=shadeC(color,0.34); g.appendChild(top);
    // front — vertical gradient
    const gid='bg'+(nextGid()); const lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
    lg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(color,0.12)})); lg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(color,-0.14)}));
    let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);} defs.appendChild(lg);
    const front=E('rect',{x:x,y:y,width:w,height:h,rx:1.5,fill:`url(#${gid})`}); g.appendChild(front);
    // soft glass highlight (gradient, left→right fade)
    const hl=E('rect',{x:x,y:y,width:w,height:h,rx:1.5,fill:`url(#${sheenGrad(svg,true)})`}); g.appendChild(hl);
  } else if(mode==='glass'){
    const gid='gg'+(nextGid()); const lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
    lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(color,0.95)})); lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(color,0.6)}));
    let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);} defs.appendChild(lg);
    const front=E('rect',{x:x,y:y,width:w,height:h,rx:Math.min(3,w/2),fill:`url(#${gid})`}); front.style.stroke=rgbaC(color,0.9); front.style.strokeWidth='0.6'; g.appendChild(front);
    const edge=E('rect',{x:x,y:y,width:w,height:Math.min(2.5,h),rx:1,fill:'rgba(255,255,255,0.7)'}); g.appendChild(edge);
    const sheen=E('rect',{x:x,y:y,width:w,height:h,rx:Math.min(3,w/2),fill:`url(#${sheenGrad(svg,true)})`}); g.appendChild(sheen);
  } else {
    const front=E('rect',{x:x,y:y,width:w,height:h,rx:1.5}); front.style.fill=color; g.appendChild(front);
  }
  svg.appendChild(g); return g;
}
// horizontal glassy/iso bar. (x,y)=left of front face; grows right to x+len; thickness=th, centred on y.
export function bar3dH(svg, x, yTop, len, th, color, mode){
  if(len<0.5) len=0.5;
  const g=E('g',{});
  if(mode==='iso'){
    const d=Math.max(3, Math.min(th*0.55, 14)); const dx=d*0.82, dy=-d*0.5;
    // top face
    const top=E('path',{d:`M${x},${yTop} L${x+dx},${yTop+dy} L${x+len+dx},${yTop+dy} L${x+len},${yTop} Z`}); top.style.fill=shadeC(color,0.34); g.appendChild(top);
    // right cap (end face)
    const cap=E('path',{d:`M${x+len},${yTop} L${x+len+dx},${yTop+dy} L${x+len+dx},${yTop+th+dy} L${x+len},${yTop+th} Z`}); cap.style.fill=shadeC(color,-0.26); g.appendChild(cap);
    // front
    const gid='bh'+(nextGid()); const lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
    lg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(color,0.12)})); lg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(color,-0.14)}));
    let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);} defs.appendChild(lg);
    const front=E('rect',{x:x,y:yTop,width:len,height:th,rx:1.5,fill:`url(#${gid})`}); g.appendChild(front);
    const hl=E('rect',{x:x,y:yTop,width:len,height:th,rx:1.5,fill:`url(#${sheenGrad(svg,false)})`}); g.appendChild(hl);
  } else if(mode==='glass'){
    const gid='gh'+(nextGid()); const lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
    lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(color,0.95)})); lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(color,0.62)}));
    let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);} defs.appendChild(lg);
    const front=E('rect',{x:x,y:yTop,width:len,height:th,rx:Math.min(3,th/2),fill:`url(#${gid})`}); front.style.stroke=rgbaC(color,0.9); front.style.strokeWidth='0.6'; g.appendChild(front);
    const edge=E('rect',{x:x,y:yTop,width:len,height:Math.min(2,th),rx:1,fill:'rgba(255,255,255,0.65)'}); g.appendChild(edge);
  } else {
    const front=E('rect',{x:x,y:yTop,width:len,height:th,rx:3}); front.style.fill=color; g.appendChild(front);
  }
  svg.appendChild(g); return g;
}

/* ============================================================
   PATTERN FILL toolkit — the "Patterns" sub-variant of the Flat look.
   Keeps each series' colour fill and layers a distinct monochrome
   texture (hatch / cross / dots / grid …) on top, plus marker-shape
   and line-dash variation, so series read without relying on colour.
   Active only when the global knob data-chartfill='pattern' AND the
   chart is flat (chartMode === null). ============================================================ */
export function patternFillOn(){ return document.documentElement.getAttribute('data-chartfill')==='pattern'; }
export function usePattern(wrap){ return patternFillOn() && chartMode(wrap)===null; }
// Texture marks are "cut" to the surface colour behind the chart, so they always
// contrast with the (already surface-contrasting) coloured fill — in any theme / mode.
function patternInk(el){ return cssVar('--bg-1', el) || (document.documentElement.getAttribute('data-mode')==='light' ? '#ffffff' : '#16171b'); }
const PAT_PX = 6;   // target ON-SCREEN tile size (px) — held constant across every chart type
// user-units-per-CSS-pixel for this svg, so a PAT_PX on-screen tile is sized correctly no
// matter how the chart's viewBox scales (pie uses a fixed 440-wide viewBox; bars are ~1:1).
function patScaleFor(svg, el){
  try { const vb=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number); const vbw=vb.length>=4?vb[2]:0, px=(el&&el.clientWidth)||0;
    if(vbw>0 && px>0){ const s=vbw/px; if(s>0.2 && s<6) return s; } } catch(e){}
  return 1;
}
// Build (once per <svg> + texture kind) an SVG <pattern> and return its url(#id).
// kind 0 = solid → returns null (no overlay, so a solid/first series stays solid).
export function patternUrl(svg, idx, el){
  const kind=((idx|0)%8+8)%8; if(kind===0) return null;
  const k = (svg.__patScale!=null) ? svg.__patScale : (svg.__patScale = patScaleFor(svg, el));
  svg.__patCache = svg.__patCache || {}; if(svg.__patCache[kind]) return svg.__patCache[kind];
  let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs, svg.firstChild); }
  const ink=patternInk(el), sw=(1.15*k).toFixed(2), S=(PAT_PX*k).toFixed(2), f=n=>(n*k).toFixed(2), id='pat'+nextGid();
  const kids=[];
  const line=(d)=>{ kids.push(E('path',{d:d,stroke:ink,'stroke-width':sw,fill:'none','stroke-linecap':'square'})); };
  const fwd=()=>{ line(`M${f(-1)},${f(1)} l${f(2)},${f(-2)}`); line(`M0,${S} l${S},-${S}`); line(`M${f(5)},${f(7)} l${f(2)},${f(-2)}`); };   // 45° forward
  const back=()=>{ line(`M${f(-1)},${f(5)} l${f(2)},${f(2)}`); line(`M0,0 l${S},${S}`); line(`M${f(5)},${f(-1)} l${f(2)},${f(2)}`); };       // 45° backward
  switch(kind){
    case 1: fwd(); break;                                   // diagonal /
    case 2: back(); break;                                  // diagonal \
    case 3: fwd(); back(); break;                           // crosshatch
    case 4: kids.push(E('circle',{cx:f(3),cy:f(3),r:f(1.2),fill:ink})); break;   // dots
    case 5: line(`M0,${f(3)} H${S}`); break;                // horizontal rules
    case 6: line(`M${f(3)},0 V${S}`); break;                // vertical rules
    case 7: line(`M0,0 H${S} M0,0 V${S}`); break;           // grid / squares
  }
  const pat=E('pattern',{id:id,patternUnits:'userSpaceOnUse',width:S,height:S}); kids.forEach(c=>pat.appendChild(c)); defs.appendChild(pat);
  const url='url(#'+id+')'; svg.__patCache[kind]=url; return url;
}
// Drop a non-interactive textured copy over an already-painted coloured rect/bar.
export function overlayRect(svg, x, y, w, h, idx, el, rx){
  const u=patternUrl(svg, idx, el); if(!u) return null;
  const r=E('rect',{x:(+x).toFixed(1),y:(+y).toFixed(1),width:Math.max(0,+w).toFixed(1),height:Math.max(0,+h).toFixed(1),fill:u,'pointer-events':'none'});
  if(rx) r.setAttribute('rx', rx); svg.appendChild(r); return r;
}
// Drop a textured copy over an arbitrary path (donut/pie slice, violin/funnel body).
export function overlayPath(svg, d, idx, el){
  const u=patternUrl(svg, idx, el); if(!u) return null;
  const p=E('path',{d:d,fill:u,'pointer-events':'none'}); svg.appendChild(p); return p;
}
// Drop a textured copy over a circle (bubbles).
export function overlayCircle(svg, cx, cy, r, idx, el){
  const u=patternUrl(svg, idx, el); if(!u) return null;
  const c=E('circle',{cx:(+cx).toFixed(1),cy:(+cy).toFixed(1),r:(+r).toFixed(1),fill:u,'pointer-events':'none'}); svg.appendChild(c); return c;
}
// Marker shapes for scatter/line series. open=true → hollow (filled with the surface
// colour, outlined in the series colour) for an extra non-colour distinction.
export function marker(svg, cx, cy, r, idx, color, open, el){
  const kind=((idx|0)%5+5)%5; cx=+cx; cy=+cy; r=+r; let m;
  const tri=(dy)=>`${cx},${(cy-r*dy).toFixed(1)} ${(cx-r).toFixed(1)},${(cy+r*dy*0.85).toFixed(1)} ${(cx+r).toFixed(1)},${(cy+r*dy*0.85).toFixed(1)}`;
  if(kind===0) m=E('circle',{cx:cx,cy:cy,r:r});
  else if(kind===1) m=E('polygon',{points:tri(1)});                                   // triangle up
  else if(kind===2) m=E('rect',{x:(cx-r).toFixed(1),y:(cy-r).toFixed(1),width:(2*r).toFixed(1),height:(2*r).toFixed(1)});
  else if(kind===3) m=E('polygon',{points:`${cx},${(cy-r).toFixed(1)} ${(cx+r).toFixed(1)},${cy} ${cx},${(cy+r).toFixed(1)} ${(cx-r).toFixed(1)},${cy}`});  // diamond
  else m=E('polygon',{points:tri(-1)});                                               // triangle down
  if(open){ m.style.fill=patternInk(el); m.style.stroke=color; m.style.strokeWidth=1.4; }
  else m.style.fill=color;
  svg.appendChild(m); return m;
}
// Per-series line dash (solid, dashed, dotted, dash-dot …). idx 0 = solid.
export function dashFor(idx){ return ['','6 4','1 4','8 3 2 3','4 3'][((idx|0)%5+5)%5]; }
// CSS class for an HTML legend swatch so it mirrors the on-chart texture (see charts.css .lp1…lp7).
export function patternSwatchClass(idx){ const k=((idx|0)%8+8)%8; return k? ' lp'+k : ''; }
