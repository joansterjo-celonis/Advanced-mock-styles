import { VIVID_COMBOS, VIVID_COMBO_MAP, DEFAULT_VIVID_COMBO, rng, series, N, RQ_BARS, RQ_PIE, RQ_CASES, RQ_ACTIVITIES } from '../data/data.js';
import { E, svgText, chartMode, cssVar, toRGB, shadeC, rgbaC, resolveColor, ensureSoftShadow, sheenGrad, sphere, bar3dV, bar3dH, nextGid, usePattern, patternUrl, overlayRect, overlayPath, overlayCircle, marker, dashFor, patternSwatchClass } from './effects.js';
import { icons, hydrateIcons } from './icons.js';
import { buildAssetHeader } from './components/asset-header.js';
import { getThemes, syncThemes, getAuthor, ensureAuthor, isCloudEnabled } from './cloud-store.js';

      const root = document.documentElement;
      // Swap static [data-icon] placeholders for real <svg> before anything reads
      // or clones them (tab cloning, view indexing). Single source = src/icons.js.
      hydrateIcons();

      /* ===== Unified view header (single source: components/asset-header.js) =====
         Markup-defined views declare only their title + sub-tabs here; the header
         structure and buttons live in ONE component, so a change there propagates to
         every view. This runs before the sub-tab / edit wiring below so the generated
         controls receive their listeners. Registered views (src/scripts/views/*.js)
         call buildAssetHeader() themselves. */
      const MARKUP_HEADERS = {
        'order-management': { title:'Order Management', subtabs:{ attr:'data-sub', items:[
          { id:'ops', label:'Operations View', on:true },
          { id:'process', label:'Process Explorer' },
          { id:'otd', label:'On-Time Delivery' },
        ]}},
        'purchase-order': { title:'Purchase Order' },
        'rework-quality': { title:'Rework and Quality', subtabs:{ attr:'data-rqsub', items:[
          { id:'charts', label:'Charts', on:true },
          { id:'more', label:'More charts' },
          { id:'even', label:'Even more charts' },
          { id:'evencopy', label:'Even more charts Copy' },
          { id:'play', label:'Playground' },
        ]}},
      };
      Object.keys(MARKUP_HEADERS).forEach(id=>{
        const v=document.querySelector('.view[data-view="'+id+'"]'); if(!v) return;
        const old=v.querySelector(':scope > .asset-bar'); if(old) old.remove();
        v.insertAdjacentHTML('afterbegin', buildAssetHeader(MARKUP_HEADERS[id]));
      });

      /* ===== TUNABLE LAYOUT CONFIG — edit these numbers to taste ===== */
      const CONFIG = {
        appRadius: 14,                                              // outer panel corner radius (px)
        spacious: { gap:12, pad:16, radius:12, radiusInner:9, rowMetric:330 },
        compact:  { gap:6,  pad:10, radius:9,  radiusInner:7, rowMetric:268 },
        dense:    { gap:4,  pad:8,  radius:9,  radiusInner:7, rowMetric:226 }
      };

      // Active VIVID per-chart palette = the selected combo (data-vivid-palette on <html>),
      // falling back to the default "Prism" combo for presets saved before combos existed.
      function activeVividChart(){ const c=VIVID_COMBO_MAP[document.documentElement.getAttribute('data-vivid-palette')]||VIVID_COMBO_MAP[DEFAULT_VIVID_COMBO]; return c.chart; }
      function vividTint(key){ return document.documentElement.getAttribute('data-theme')==='vivid' ? (activeVividChart()[key]||'#6366f1') : null; }
      function shade(hex,p){ const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255; const t=p<0?0:255,a=Math.abs(p); r=Math.round((t-r)*a)+r; g=Math.round((t-g)*a)+g; b=Math.round((t-b)*a)+b; return '#'+(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1); }

      /* ===== chart tooltips: tag data slots so chart-tips.js can show value-on-hover =====
         setTip writes the title + (label\u001fvalue) rows joined by \u001e; hitRect/hitPath add
         an invisible, always-hittable overlay so the tooltip works for thin lines and 3D bars too. */
      function fmt(n){ const a=Math.abs(n);
        if(a>=1e9) return (n/1e9).toFixed(a>=1e10?0:2).replace(/\.?0+$/,'')+'B';
        if(a>=1e6) return (n/1e6).toFixed(a>=1e7?0:2).replace(/\.?0+$/,'')+'M';
        if(a>=1e3) return (n/1e3).toFixed(a>=1e4?0:1).replace(/\.?0+$/,'')+'K';
        return String(Math.round(n)); }
      function monthLabel(i){ const d=new Date(2022,i,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
      function setTip(el,title,rows){ if(title!=null) el.setAttribute('data-ctip',String(title));
        if(rows&&rows.length) el.setAttribute('data-ctip-rows', rows.map(r=>r[0]+'\u001f'+r[1]).join('\u001e'));
        try{ el.style.cursor='default'; }catch(e){} return el; }
      function hitRect(svg,x,y,w,h,title,rows){ const r=E('rect',{x:(+x).toFixed(1),y:(+y).toFixed(1),width:Math.max(0.5,w).toFixed(1),height:Math.max(0.5,h).toFixed(1),fill:'transparent','pointer-events':'all'}); setTip(r,title,rows); svg.appendChild(r); return r; }
      function hitPath(svg,d,title,rows){ const p=E('path',{d:d,fill:'transparent','pointer-events':'all'}); setTip(p,title,rows); svg.appendChild(p); return p; }
      function svgDefs(svg){ let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild); } return defs; }
      // Smooth top-lit body gradient for a glass slice/ring: lighter at the top,
      // base in the middle, gently darker at the bottom — a single clean gradient
      // (no stacked highlight strokes) so it reads as one rounded glossy surface.
      function glassTopGrad(svg,color){
        const gid='glassTop'+nextGid(), lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
        lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(shadeC(color,0.30),0.97)}));
        lg.appendChild(E('stop',{offset:'50%','stop-color':rgbaC(color,0.95)}));
        lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(shadeC(color,-0.26),0.92)}));
        svgDefs(svg).appendChild(lg); return gid;
      }
      // Single soft specular sheen: a vertical white→transparent gradient. Applied
      // as a full-ring stroke or a slice fill it gives ONE clean top highlight that
      // fades out by the middle, with no dashed-arc streaks.
      function glassSheenGrad(svg, top){
        const gid='glassSheen'+nextGid(), lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
        lg.appendChild(E('stop',{offset:'0%','stop-color':`rgba(255,255,255,${top!=null?top:0.5})`}));
        lg.appendChild(E('stop',{offset:'34%','stop-color':'rgba(255,255,255,0.12)'}));
        lg.appendChild(E('stop',{offset:'66%','stop-color':'rgba(255,255,255,0)'}));
        svgDefs(svg).appendChild(lg); return gid;
      }

      /* ---- COMBO chart (bars + line, dual axis) — size-aware ---- */
      function combo(wrap){
        const key = wrap.dataset.key, rightMax = parseFloat(wrap.dataset.rightmax)||40, leftLabel = wrap.dataset.leftlabel||'';
        const n = Math.max(2, parseInt(wrap.dataset.n,10) || N);   // bar/line count; data-n trims it (e.g. theme-creator art)
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),110);
        const padL=30, padR=34, padT=8, padB=18, innerW=W-padL-padR, innerH=H-padT-padB;
        let bars, line;
        if(key==='otd'){ bars=series(11,n,18,26,0.4); line=series(21,n,30,8,0.1); }
        else if(key==='touch'){ bars=series(31,n,30,24,0.6); line=series(41,n,2.6,1.2,0.04); }
        else if(key==='blocks'){ bars=series(51,n,28,22,0.5); line=series(61,n,10,3,0.05); }
        else { bars=series(71,n,50,30,0.5); line=series(81,n,60,18,0.4); }
        const barMax=Math.max(...bars)*1.15, lineMax=rightMax;
        const tint=vividTint(key);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        const defs=E('defs',{}); const gid='cb_'+key+'_'+nextGid(); const g=E('linearGradient',{id:gid,x1:0,x2:0,y1:0,y2:1});
        if(tint){ g.appendChild(E('stop',{offset:'0%','stop-color':shade(tint,0.22)})); g.appendChild(E('stop',{offset:'100%','stop-color':shade(tint,-0.12)})); }
        else { g.appendChild(E('stop',{offset:'0%','class':'stop-1a'})); g.appendChild(E('stop',{offset:'100%','class':'stop-1b'})); }
        defs.appendChild(g); svg.appendChild(defs);
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*f; svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.18)','stroke-dasharray':'2 4'})); });
        const step=innerW/n, bw=step*0.6;
        const m3=chartMode(wrap), pat=usePattern(wrap), barCol = tint || cssVar('--cstop-1a', wrap);
        bars.forEach((v,i)=>{ const h=Math.max(2,(v/barMax)*innerH); const x=padL+step*i+(step-bw)/2; const y=padT+innerH-h;
          if(m3){ bar3dV(svg,x,y,bw,h,barCol,m3); }
          else { svg.appendChild(E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1.5,fill:`url(#${gid})`}));
            if(pat) overlayRect(svg, x, y, bw, h, 1, wrap, 1.5); } });
        let d=''; line.forEach((v,i)=>{ const x=padL+step*i+step/2; const y=padT+innerH-(Math.min(v,lineMax)/lineMax)*innerH; d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); });
        const path=E('path',{d:d,fill:'none','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'});
        path.style.stroke = tint ? shade(tint,-0.28) : (wrap.dataset.rightline==='green' ? 'var(--line-2)' : 'var(--text)'); svg.appendChild(path);
        const T=(x,y,s,a)=>svgText(E,x,y,s,a);
        if(leftLabel){ svg.appendChild(T(padL-4,padT+7,leftLabel,'end')); svg.appendChild(T(padL-4,padT+innerH,'0','end')); }
        svg.appendChild(T(W-padR+4,padT+7,rightMax+'%','start')); svg.appendChild(T(W-padR+4,padT+innerH,'0%','start'));
        svg.appendChild(T(padL,H-5,'2022-01','start')); svg.appendChild(T(padL+innerW/2,H-5,'2023-01','middle')); svg.appendChild(T(padL+innerW,H-5,'2024-01','end'));
        for(let i=0;i<bars.length;i++){ hitRect(svg,padL+step*i,padT,step,innerH,monthLabel(i),[[leftLabel||'Value',fmt(bars[i])],['Rate',line[i].toFixed(1)+'%']]); }
        wrap.appendChild(svg);
      }

      /* ---- DONUT (flat / iso-tilted cylinder / glass) — the single donut component.
         Data-driven via data-segs='[["Label",pct,"--colorVar"],…]'; falls back to a
         sample mix when omitted. Responsive: scales every effect to the rendered size
         so it looks identical at any dimension. ---- */
      function donut(wrap){
        let segs;
        try{ const raw=JSON.parse(wrap.dataset.segs||'null');
          if(Array.isArray(raw)&&raw.length) segs=raw.map(s=>({p:+s[1]||0,c:'var('+(s[2]||'--cstop-1a')+')',l:String(s[0])})); }catch(e){}
        if(!segs) segs=[{p:48.39,c:'var(--legend-4)',l:'UK test'},{p:41.94,c:'var(--legend-3)',l:'Others (13)'},{p:3.23,c:'var(--legend-2)',l:'BE test'},{p:3.23,c:'var(--legend-2)',l:'AU test'},{p:3.23,c:'var(--legend-1)',l:'AE test'}];
        const W=Math.max(Math.round(wrap.clientWidth),120), H=Math.max(Math.round(wrap.clientHeight),120);
        const cx=W/2, cy=H/2, minD=Math.min(W,H), r=minD*0.35, sw=minD*0.183, k=minD/120, C=2*Math.PI*r;
        const m3=chartMode(wrap);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`});
        function ring(target, cyy, shadeAmt, op, strokeFn){ let off=0; segs.forEach((s,i)=>{ const len=C*s.p/100, base=resolveColor(s.c, wrap);
          const cir=E('circle',{cx:cx,cy:cyy,r:r,fill:'none','stroke-width':sw,'stroke-dasharray':`${len.toFixed(2)} ${(C-len).toFixed(2)}`,'stroke-dashoffset':(-off).toFixed(2),transform:`rotate(-90 ${cx} ${cyy})`});
          cir.style.stroke = strokeFn ? strokeFn(s,i,base) : (shadeAmt!=null ? shadeC(base,shadeAmt) : s.c); if(op!=null) cir.style.strokeOpacity=op; target.appendChild(cir); off+=len; }); }
        if(m3){
          const tilt = m3==='iso'?0.58:0.86, depth = Math.max(1, Math.round((m3==='iso'?9:5)*k));
          const fid=ensureSoftShadow(svg, (m3==='iso'?5:3)*k, (m3==='iso'?5:4)*k, 0.30);
          const g=E('g',{transform:`translate(${cx} ${cy}) scale(1 ${tilt}) translate(${-cx} ${-cy})`,filter:`url(#${fid})`});
          for(let d=depth;d>=1;d--) ring(g, cy+d, m3==='glass' ? (-0.22-(d/depth)*0.16) : -0.30, m3==='glass'?0.96:null);     // extruded side wall (darker, behind)
          if(m3==='glass'){
            ring(g, cy, null, 1, (s,i,base)=>`url(#${glassTopGrad(svg,base)})`);  // glossy top-lit ring (one smooth gradient per segment)
            // one soft specular highlight: a full ring stroke painted with a vertical
            // white→transparent gradient → bright along the top, fading out by the middle.
            const sh=glassSheenGrad(svg, 0.5);
            g.appendChild(E('circle',{cx:cx,cy:cy,r:r,fill:'none','stroke-width':(sw*0.86).toFixed(2),stroke:`url(#${sh})`,'pointer-events':'none'}));
          } else {
            ring(g, cy, 0.04, 1);  // isometric top face
            // glassy top sheen
            const sheen=E('circle',{cx:cx,cy:cy,r:r,fill:'none','stroke-width':sw*0.46,'stroke-dasharray':`${(C*0.5).toFixed(1)} ${C}`,transform:`rotate(-150 ${cx} ${cy})`,stroke:'rgba(255,255,255,0.22)'}); g.appendChild(sheen);
          }
          svg.appendChild(g);
        } else {
          ring(svg, cy, null);
        }
        // Pattern sub-variant: lay a per-segment texture over the coloured ring (flat only).
        if(usePattern(wrap)){ let off=0; segs.forEach((s,i)=>{ const len=C*s.p/100, u=patternUrl(svg, i, wrap);
          if(u){ svg.appendChild(E('circle',{cx:cx,cy:cy,r:r,fill:'none','stroke-width':sw,'stroke-dasharray':`${len.toFixed(2)} ${(C-len).toFixed(2)}`,'stroke-dashoffset':(-off).toFixed(2),transform:`rotate(-90 ${cx} ${cy})`,stroke:u,'pointer-events':'none'})); } off+=len; }); }
        { let off=0; segs.forEach(s=>{ const len=C*s.p/100;
            const hit=E('circle',{cx:cx,cy:cy,r:r,fill:'none',stroke:'transparent','stroke-width':sw+6,'stroke-dasharray':`${len.toFixed(2)} ${(C-len).toFixed(2)}`,'stroke-dashoffset':(-off).toFixed(2),transform:`rotate(-90 ${cx} ${cy})`,'pointer-events':'stroke'});
            setTip(hit,s.l,[['Share',s.p.toFixed(2)+'%']]); svg.appendChild(hit); off+=len; }); }
        wrap.appendChild(svg);
      }

      /* ---- AREA — size-aware ---- */
      function area(wrap){
        const key=wrap.dataset.key||'rej';
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),100);
        const padL=30,padR=10,padT=8,padB=18, innerW=W-padL-padR, innerH=H-padT-padB;
        let pts; if(key==='po'){ pts=series(91,18,60,28,1.0); } else { pts=series(101,N,52,26,0.2); }
        const mx=Math.max(...pts)*1.15;
        const tint=vividTint(key);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        const defs=E('defs',{}); const gid='ar_'+key+'_'+nextGid(); const g=E('linearGradient',{id:gid,x1:0,x2:0,y1:0,y2:1});
        if(tint){ g.appendChild(E('stop',{offset:'0%','stop-color':tint,'stop-opacity':'0.5'})); g.appendChild(E('stop',{offset:'100%','stop-color':tint,'stop-opacity':'0'})); }
        else { g.appendChild(E('stop',{offset:'0%','class':'stop-area-top'})); g.appendChild(E('stop',{offset:'100%','class':'stop-area-mid'})); }
        defs.appendChild(g); svg.appendChild(defs);
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*f; svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); });
        const step=innerW/(pts.length-1); let d='';
        pts.forEach((v,i)=>{ const x=padL+step*i, y=padT+innerH-(v/mx)*innerH; d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); });
        const m3=chartMode(wrap), glassCol = tint || cssVar('--cstop-1a', wrap);
        if(m3){
          // frosted fill in the chart primary colour
          const fg=svg.querySelector('#'+gid); if(fg){ fg.innerHTML=''; fg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(glassCol,0.55)})); fg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(glassCol,0.05)})); }
          svg.appendChild(E('path',{d:d+`L${padL+innerW},${padT+innerH}L${padL},${padT+innerH}Z`,fill:`url(#${gid})`}));
          if(m3==='iso'){ // depth lip under the line
            const lip=E('path',{d:d,fill:'none','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 4)'}); lip.style.stroke=shadeC(glassCol,-0.3); lip.style.opacity='0.85'; svg.appendChild(lip);
          }
          const lp=E('path',{d:d,fill:'none','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'}); lp.style.stroke=glassCol; svg.appendChild(lp);
          const gloss=E('path',{d:d,fill:'none','stroke-width':1,'stroke-linecap':'round','transform':'translate(0 -1.4)'}); gloss.style.stroke='rgba(255,255,255,0.55)'; svg.appendChild(gloss);
          pts.forEach((v,i)=>{ if(i%3)return; const x=padL+step*i,y=padT+innerH-(v/mx)*innerH; sphere(svg,+x.toFixed(1),+y.toFixed(1),3,glassCol); });
        } else {
          const areaD=d+`L${padL+innerW},${padT+innerH}L${padL},${padT+innerH}Z`;
          svg.appendChild(E('path',{d:areaD,fill:`url(#${gid})`}));
          if(usePattern(wrap)) overlayPath(svg, areaD, 1, wrap);   // single texture over the area fill
          const lineCol = tint ? shade(tint,-0.1) : 'var(--text)';
          const lp=E('path',{d:d,fill:'none','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}); lp.style.stroke=lineCol; svg.appendChild(lp);
          pts.forEach((v,i)=>{ if(i%2)return; const x=padL+step*i,y=padT+innerH-(v/mx)*innerH; const c=E('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:2.2}); c.style.fill=lineCol; svg.appendChild(c); });
        }
        const T=(x,y,s,a)=>svgText(E,x,y,s,a);
        svg.appendChild(T(padL,padT+7,'50K','end'));
        svg.appendChild(T(padL,H-5,'2022-01','start')); svg.appendChild(T(padL+innerW,H-5,'2024-01','end'));
        for(let i=0;i<pts.length;i++){ const cxp=padL+step*i, x0=Math.max(padL,cxp-step/2), x1=Math.min(padL+innerW,cxp+step/2); hitRect(svg,x0,padT,x1-x0,innerH,monthLabel(i),[['Value',fmt(pts[i])]]); }
        wrap.appendChild(svg);
      }

      /* ---- DOT PLOT — size-aware ---- */
      function dots(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),100);
        const padL=34,padR=10,padT=8,padB=22, innerW=W-padL-padR, innerH=H-padT-padB;
        const n=24, r=rng(7), vals=[]; for(let i=0;i<n;i++){ vals.push(i===6?19500:(r()*3000+300)); }
        const mx=20000; const tint=vividTint('dots'); const hi = tint || 'var(--text)';
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*f; svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.22)','stroke-dasharray':'1 4'})); });
        const step=innerW/n;
        const m3=chartMode(wrap), hiCol = tint || cssVar('--cstop-1a', wrap);
        vals.forEach((v,i)=>{ const x=+(padL+step*i+step/2).toFixed(1); const y=+(padT+innerH-(v/mx)*innerH).toFixed(1); const rad=i===6?4:2.6;
          if(m3){ sphere(svg,x,y, i===6?4.6:2.9, i===6?hiCol:'rgb(150,150,156)'); }
          else { const c=E('circle',{cx:x,cy:y,r:rad}); c.style.fill = i===6?hi:'rgba(128,128,128,0.7)'; svg.appendChild(c); } });
        const T=(x,y,s,a)=>svgText(E,x,y,s,a);
        svg.appendChild(T(padL-4,padT+7,'20000','end')); svg.appendChild(T(padL-4,padT+innerH*0.5,'10000','end')); svg.appendChild(T(padL-4,padT+innerH,'0','end'));
        svg.appendChild(T(padL+innerW,H-5,'Country →','end'));
        for(let i=0;i<vals.length;i++){ hitRect(svg,padL+step*i,padT,step,innerH,'Country '+(i+1),[['Value',fmt(vals[i])]]); }
        wrap.appendChild(svg);
      }

      /* ---- Process Explorer monthly bars ---- */
      function pbars(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),140);
        const padL=38,padR=8,padT=8,padB=50, innerW=W-padL-padR, innerH=H-padT-padB;
        const vals=[47,33,35,26,13,41,20,34,34,40,49,70,47,35,33,25,13,41,21,34,34,41,49,70];
        const months=[]; for(let y=2022;y<=2023;y++) for(let m=1;m<=12;m++) months.push(y+'-'+String(m).padStart(2,'0'));
        const mx=80, svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,(f*80)+'K','end')); });
        const step=innerW/vals.length, bw=step*0.6;
        const m3p=chartMode(wrap), pat=usePattern(wrap), colp=cssVar('--cstop-1a', wrap);
        vals.forEach((v,i)=>{ const h=Math.max(1,(v/mx)*innerH), x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          if(m3p){ bar3dV(svg,x,y,bw,h,colp,m3p); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1.5}); r.style.fill='var(--cstop-1a)'; svg.appendChild(r);
            if(pat) overlayRect(svg, x, y, bw, h, 1, wrap, 1.5); } });
        months.forEach((mo,i)=>{ const x=padL+step*i+step/2; const t=svgText(E,x,padT+innerH+10,mo,'end'); t.setAttribute('transform',`rotate(-55 ${x} ${padT+innerH+10})`); t.setAttribute('font-size','7.5'); svg.appendChild(t); });
        for(let i=0;i<vals.length;i++){ hitRect(svg,padL+step*i,padT,step,innerH,months[i],[['Value',vals[i]+'K']]); }
        wrap.appendChild(svg);
      }
      /* ---- OTD classification (horizontal) ---- */
      function otdClass(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),240), H=Math.max(Math.round(wrap.clientHeight),170);
        const padL=100,padR=10,padT=6,padB=24, innerW=W-padL-padR, innerH=H-padT-padB;
        const rows=[{l:'Early',v:12000,c:'var(--cstop-1a)'},{l:'On Time',v:295000,c:'var(--cstop-1a)'},{l:'Late',v:312000,c:'var(--cstop-1b)'},{l:'No Goods Issue',v:290000,c:'var(--cstop-3a)'},{l:'No Confirmation',v:2000,c:'var(--cstop-1a)'}];
        const mx=320000, rh=innerH/rows.length, svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,100000,200000,300000].forEach(g=>{ const x=padL+(g/mx)*innerW; svg.appendChild(E('line',{x1:x,x2:x,y1:padT,y2:padT+innerH,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,x,padT+innerH+14,(g/1000)+'K','middle')); });
        const m3c=chartMode(wrap), pat=usePattern(wrap);
        rows.forEach((r,i)=>{ const cy=padT+rh*i+rh/2, bw=(r.v/mx)*innerW, bh=Math.min(40,rh*0.5), by=cy-bh/2;
          if(m3c){ bar3dH(svg,padL,by,Math.max(2,bw),bh,resolveColor(r.c, wrap),m3c); }
          else { const rect=E('rect',{x:padL,y:by.toFixed(1),width:Math.max(2,bw).toFixed(1),height:bh.toFixed(1),rx:3}); rect.style.fill=r.c; svg.appendChild(rect);
            if(pat) overlayRect(svg, padL, by, Math.max(2,bw), bh, i, wrap, 3); }   // per-row texture
          svg.appendChild(svgText(E,padL-8,cy+3,r.l,'end')); });
        rows.forEach((r,i)=>{ hitRect(svg,0,padT+rh*i,padL+innerW,rh,r.l,[['Orders',fmt(r.v)]]); });
        wrap.appendChild(svg);
      }
      /* ---- OTD distribution histogram ---- */
      function otdHist(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),240), H=Math.max(Math.round(wrap.clientHeight),170);
        const padL=46,padR=8,padT=8,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const bars=[[-4,1000,'l'],[-3,2000,'l'],[-2,8000,'l'],[-1,52000,'l'],[0,240000,'l'],[1,3000,'d'],[2,2000,'d'],[3,6000,'d'],[4,210000,'d'],[5,33000,'d'],[6,25000,'d'],[7,16000,'d'],[8,9000,'d'],[9,5000,'d'],[10,3000,'d'],[11,6000,'g']];
        const mx=250000, svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,50000,100000,150000,200000].forEach(g=>{ const y=padT+innerH-(g/mx)*innerH; svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,String(g),'end')); });
        const step=innerW/bars.length, bw=step*0.72;
        const m3h=chartMode(wrap), pat=usePattern(wrap);
        bars.forEach((b,i)=>{ const h=Math.max(1,(b[1]/mx)*innerH), x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          const cvar = b[2]==='l'?'--cstop-1a':b[2]==='d'?'--cstop-1b':'--cstop-3a';
          const pidx = b[2]==='l'?1:b[2]==='d'?2:3;        // texture keyed to the early / delayed / no-goods group
          if(m3h){ bar3dV(svg,x,y,bw,h,cssVar(cvar, wrap),m3h); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1}); r.style.fill='var('+cvar+')'; svg.appendChild(r);
            if(pat) overlayRect(svg, x, y, bw, h, pidx, wrap, 1); }
          if(b[0]%2===0) svg.appendChild(svgText(E,x+bw/2,padT+innerH+12,String(b[0]),'middle')); });
        bars.forEach((b,i)=>{ hitRect(svg,padL+step*i,padT,step,innerH,'Deviation '+b[0]+(Math.abs(b[0])===1?' day':' days'),[['Count',fmt(b[1])]]); });
        wrap.appendChild(svg);
      }
      /* ---- OTD development over time (placeholder block) ---- */
      function otdDev(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),240), H=Math.max(Math.round(wrap.clientHeight),170);
        const padL=42,padR=44,padT=8,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,(f*800)+(f>0?'K':''),'end')); svg.appendChild(svgText(E,W-padR+4,y+3,(f*50)+'%','start')); });
        const bx=padL+innerW*0.18, bw=innerW*0.64, bh=innerH*0.95, by=padT+innerH-bh;
        const m3d=chartMode(wrap), pat=usePattern(wrap);
        if(m3d){ bar3dV(svg,bx,by,bw,bh,cssVar('--cstop-1a', wrap),m3d); }
        else { const rect=E('rect',{x:bx.toFixed(1),y:by.toFixed(1),width:bw.toFixed(1),height:bh.toFixed(1),rx:3}); rect.style.fill='var(--cstop-1a)'; rect.style.opacity='0.9'; svg.appendChild(rect);
          if(pat) overlayRect(svg, bx, by, bw, bh, 1, wrap, 3); }
        const c=E('circle',{cx:(bx+bw/2).toFixed(1),cy:(by+5).toFixed(1),r:3}); c.style.fill='var(--bg-1)'; c.style.stroke='var(--cstop-1b)'; c.style.strokeWidth='1.5'; svg.appendChild(c);
        svg.appendChild(svgText(E,bx+bw/2,padT+innerH+12,'1970-01','middle'));
        hitRect(svg,bx,by,bw,bh,'1970-01',[['On-Time','760K'],['Rate','47.5%']]);
        wrap.appendChild(svg);
      }
      /* ---- Tracking Analysis: "time between events" frequency histogram (exponential decay) ---- */
      function freqhist(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),240), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=48,padR=10,padT=10,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const n=21, vals=[]; for(let i=0;i<n;i++) vals.push(Math.round(2150000*Math.exp(-i*0.42)));
        vals.push(180000);                          // far-right grey "200s+" catch-all bucket
        const mx=2200000, count=vals.length, svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,1000000,2000000].forEach(g=>{ const y=padT+innerH*(1-g/mx); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,g.toLocaleString('en-US'),'end')); });
        const step=innerW/count, bw=step*0.74;
        const m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar('--cstop-1a', wrap);
        vals.forEach((v,i)=>{ const last=i===count-1, h=Math.max(1,(v/mx)*innerH), x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          if(m3 && !last){ bar3dV(svg,x,y,bw,h,col,m3); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1.5}); r.style.fill = last?'rgba(140,142,150,0.6)':'var(--cstop-1a)'; svg.appendChild(r);
            if(pat && !last) overlayRect(svg, x, y, bw, h, 1, wrap, 1.5); } });
        [0,0.2,0.4,0.6,0.8,1].forEach(f=>{ svg.appendChild(svgText(E,padL+innerW*f,padT+innerH+12,String(Math.round(f*200)),'middle')); });
        for(let i=0;i<count;i++){ const lo=Math.round(i/count*200), hi=Math.round((i+1)/count*200); hitRect(svg,padL+step*i,padT,step,innerH,(i===count-1?'200+ s':lo+'\u2013'+hi+' s'),[['Frequency',fmt(vals[i])]]); }
        wrap.appendChild(svg);
      }
      /* ---- Tracking Analysis: avg time-between-events over time (line) ---- */
      function durline(wrap){
        const W=Math.max(Math.round(wrap.clientWidth),260), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=44,padR=12,padT=10,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const n=19, pts=[], r=rng(7); let base=13.0;
        for(let i=0;i<n;i++){ base+=0.06; pts.push(Math.max(11,Math.min(17, base+(r()-0.5)*2.0+Math.sin(i/2)*0.6))); }
        const mx=20, svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,5,10,15,20].forEach(g=>{ const y=padT+innerH*(1-g/mx); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,g+'sec.','end')); });
        const step=innerW/(n-1); let d=''; pts.forEach((v,i)=>{ const x=padL+step*i, y=padT+innerH-(v/mx)*innerH; d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); });
        const m3=chartMode(wrap), col=cssVar('--cstop-1a', wrap);   // honor the Charts-look (iso / glass) knob
        if(m3){
          let defs=svg.querySelector('defs'); if(!defs){ defs=E('defs',{}); svg.insertBefore(defs,svg.firstChild);} const gid='dl'+nextGid();
          const lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1}); lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(col,0.5)})); lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(col,0.04)})); defs.appendChild(lg);
          svg.appendChild(E('path',{d:d+`L${(padL+innerW).toFixed(1)},${(padT+innerH).toFixed(1)}L${padL.toFixed(1)},${(padT+innerH).toFixed(1)}Z`,fill:`url(#${gid})`}));   // frosted area fill
          if(m3==='iso'){ const lip=E('path',{d:d,fill:'none','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 4)'}); lip.style.stroke=shadeC(col,-0.3); lip.style.opacity='0.85'; svg.appendChild(lip); }  // depth lip
          const lp=E('path',{d:d,fill:'none','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'}); lp.style.stroke=col; svg.appendChild(lp);
          const gloss=E('path',{d:d,fill:'none','stroke-width':1,'stroke-linecap':'round',transform:'translate(0 -1.4)'}); gloss.style.stroke='rgba(255,255,255,0.55)'; svg.appendChild(gloss);
          pts.forEach((v,i)=>{ if(i%3)return; const x=padL+step*i,y=padT+innerH-(v/mx)*innerH; sphere(svg,+x.toFixed(1),+y.toFixed(1),3,col); });
        } else {
          const lp=E('path',{d:d,fill:'none','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}); lp.style.stroke=col; svg.appendChild(lp);
        }
        const dates=['2024-12-30','2025-03-31','2025-06-30','2025-09-29','2025-12-29','2026-06-30'];
        dates.forEach((dt,i)=>{ const x=padL+innerW*(i/(dates.length-1)); svg.appendChild(svgText(E,x,padT+innerH+12,dt,i===0?'start':(i===dates.length-1?'end':'middle'))); });
        for(let i=0;i<n;i++){ const cxp=padL+step*i, x0=Math.max(padL,cxp-step/2), x1=Math.min(padL+innerW,cxp+step/2); hitRect(svg,x0,padT,x1-x0,innerH,'duration',[['seconds',pts[i].toFixed(1)]]); }
        wrap.appendChild(svg);
      }
      /* ---- Generic data-driven horizontal category bars (self-describing via data-bars) ----
         data-bars='[["Label",value],…]'  data-xmax  data-xticks="0,1000,2000"  data-labelw  data-unit */
      function hbarcat(wrap){
        let bars=[]; try{ bars=JSON.parse(wrap.dataset.bars||'[]'); }catch(e){ bars=[]; }
        const xmax=parseFloat(wrap.dataset.xmax)|| (bars.length?Math.max(...bars.map(b=>b[1]))*1.1:1);
        const ticks=(wrap.dataset.xticks||'').split(',').map(s=>parseFloat(s)).filter(v=>!isNaN(v));
        const unit=wrap.dataset.unit||'', labelW=parseFloat(wrap.dataset.labelw)||62;
        // optional axis-tick formatting: data-xdec=decimals (skips fmt's K/M abbreviation), data-xsuffix appended (e.g. "%")
        const xsuffix=wrap.dataset.xsuffix||'', xdec=wrap.dataset.xdec, fmtX=v=>(xdec!=null?Number(v).toFixed(parseInt(xdec,10)):fmt(v))+xsuffix;
        const W=Math.max(Math.round(wrap.clientWidth),180), H=Math.max(Math.round(wrap.clientHeight),80);
        const padL=labelW, padR=10, padT=4, padB=15, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        (ticks.length?ticks:[0,xmax]).forEach(t=>{ const x=padL+(t/xmax)*innerW; svg.appendChild(E('line',{x1:x.toFixed(1),x2:x.toFixed(1),y1:padT,y2:padT+innerH,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,Math.min(padL+innerW-1,x),padT+innerH+11,fmtX(t),'middle')); });
        const n=Math.max(1,bars.length), rh=innerH/n, bh=Math.min(13,rh*0.6);
        const m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar('--cstop-1a', wrap);
        const cap=Math.max(4,Math.floor(labelW/5.2));
        bars.forEach((b,i)=>{ const cy=padT+rh*i+rh/2, w=Math.max(1,(Math.min(b[1],xmax)/xmax)*innerW), y=cy-bh/2;
          const shown=(String(b[0]).length>cap)?String(b[0]).slice(0,cap-1)+'\u2026':String(b[0]);
          const lt=svgText(E,padL-6,cy+3,shown,'end'); lt.setAttribute('font-size','9'); svg.appendChild(lt);
          const cvar=b[2]||'--cstop-1a';            // optional per-bar colour (a CSS var name)
          if(m3){ bar3dH(svg,padL,y,w,bh,cssVar(cvar, wrap),m3); }
          else { const r=E('rect',{x:padL.toFixed(1),y:y.toFixed(1),width:w.toFixed(1),height:bh.toFixed(1),rx:1.5}); r.style.fill='var('+cvar+')'; svg.appendChild(r);
            if(pat) overlayRect(svg, padL, y, w, bh, i, wrap, 1.5); }   // per-category texture
          hitRect(svg,padL,padT+rh*i,innerW,rh,String(b[0]),[['Value',fmt(b[1])+(unit?' '+unit:'')]]); });
        wrap.appendChild(svg);
      }
      /* ---- Generic pie (self-describing via data-segs='[["Label",pct,"--colorVar"],…]') ---- */
      function pieGen(wrap){
        let segs=[]; try{ segs=JSON.parse(wrap.dataset.segs||'[]'); }catch(e){ segs=[]; }
        const W=Math.max(Math.round(wrap.clientWidth),140), H=Math.max(Math.round(wrap.clientHeight),120);
        // a sibling legend (donut/ocpm style) replaces the in-SVG leader labels and
        // lets the disc sit centred and a touch larger.
        const legBox=wrap.parentElement?wrap.parentElement.querySelector('.ocpm2-legend, .donut-legend'):null;
        const cx=W*(legBox?0.5:0.40), cy=H/2, r=Math.min(W*(legBox?0.44:0.34),H*0.42);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`});
        const pal=['--cstop-1b','--legend-3','--cstop-1a','--legend-2','--legend-1','--cstop-3a'];
        const m3=chartMode(wrap);                                  // honor the Charts-look (iso / glass) knob
        const yS = m3==='iso'?0.6 : m3==='glass'?0.92 : 1;          // vertical squash → tilted cylinder
        const depth = m3==='iso'?Math.max(7,r*0.2) : m3==='glass'?Math.max(6,r*0.08) : 0;   // extrusion thickness
        const cvarOf=i=>segs[i][2]||pal[i%pal.length];
        const arcs=[]; let ang=-Math.PI/2; segs.forEach(sg=>{ const a1=ang+Math.max(0,sg[1])/100*2*Math.PI; arcs.push([ang,a1]); ang=a1; });
        function slicePath(a0,a1,yy){ const large=(a1-a0)>Math.PI?1:0; const x0=cx+r*Math.cos(a0), y0=yy+r*Math.sin(a0)*yS, x1=cx+r*Math.cos(a1), y1=yy+r*Math.sin(a1)*yS;
          return `M${cx.toFixed(1)},${yy.toFixed(1)} L${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${(r*yS).toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`; }
        const body = m3 ? E('g',{filter:`url(#${ensureSoftShadow(svg, m3==='iso'?7:4, m3==='iso'?6:5, 0.3)})`}) : svg;
        // 1) extruded side wall (darker copies stacked behind the top faces)
        if(m3){ for(let k=Math.round(depth);k>=1;k--){ segs.forEach((sg,i)=>{ const p=E('path',{d:slicePath(arcs[i][0],arcs[i][1],cy+k)}); p.style.fill=shadeC(cssVar(cvarOf(i),wrap),m3==='glass'?(-0.22-(k/depth)*0.20):-0.34); if(m3==='glass')p.style.opacity='0.94'; body.appendChild(p); }); } }
        // 2) top faces (+ tooltips)
        segs.forEach((sg,i)=>{ const p=E('path',{d:slicePath(arcs[i][0],arcs[i][1],cy)}), col=cssVar(cvarOf(i),wrap);
          if(m3==='glass'){ p.style.fill=`url(#${glassTopGrad(svg,col)})`; p.style.fillOpacity='0.98'; p.style.stroke=rgbaC(shadeC(col,0.48),0.55); p.style.strokeWidth='1.25'; }
          else { p.style.fill='var('+cvarOf(i)+')'; p.style.stroke='var(--bg-1)'; p.style.strokeWidth='1'; }
          body.appendChild(p);
          setTip(p,String(sg[0]),[['Share',sg[1].toFixed(2)+'%']]); });
        // Pattern sub-variant: texture each slice over its colour (flat only).
        if(usePattern(wrap)){ segs.forEach((sg,i)=>overlayPath(svg, slicePath(arcs[i][0],arcs[i][1],cy), i, wrap)); }
        // 3) glassy sheen across the top face
        if(m3){ let pd=svgDefs(svg); const sid='pgSheen'+nextGid(), glass=m3==='glass';
          const rg=E('radialGradient',{id:sid,cx:glass?'46%':'50%',cy:glass?'24%':'30%',r:glass?'74%':'68%'});
          rg.appendChild(E('stop',{offset:'0%','stop-color':glass?'rgba(255,255,255,0.48)':'rgba(255,255,255,0.28)'}));
          rg.appendChild(E('stop',{offset:'52%','stop-color':glass?'rgba(255,255,255,0.13)':'rgba(255,255,255,0.06)'}));
          rg.appendChild(E('stop',{offset:'100%','stop-color':'rgba(255,255,255,0)'})); pd.appendChild(rg);
          body.appendChild(E('ellipse',{cx:cx,cy:cy,rx:(r*0.99).toFixed(1),ry:(r*yS*0.99).toFixed(1),fill:`url(#${sid})`,'pointer-events':'none'})); }
        if(m3) svg.appendChild(body);
        // 4) labels — a sibling legend (donut/ocpm style) when present, else in-SVG leader labels
        if(legBox){
          const isDonut=legBox.classList.contains('donut-legend'), pat=usePattern(wrap);
          legBox.innerHTML = segs.map((sg,i)=>{ const c='var('+cvarOf(i)+')', txt=sg[1].toFixed(2)+'% '+sg[0], pc=pat?patternSwatchClass(i):'';
            return isDonut
              ? '<div class="li"><span class="sw'+pc+'" style="background-color:'+c+'"></span>'+txt+'</div>'
              : '<span class="ocpm2-legitem"><span class="ocpm2-swatch'+pc+'" style="background-color:'+c+'"></span>'+txt+'</span>'; }).join('');
        } else {
          // leader labels (offset below the extrusion in 3D)
          segs.forEach((sg,i)=>{ const am=(arcs[i][0]+arcs[i][1])/2, lx=cx+(r+10)*Math.cos(am), ly=cy+(r+10)*Math.sin(am)*yS+(m3?depth*0.5:0);
            const nm=String(sg[0]); const lab=sg[1].toFixed(2)+'% '+(nm.length>9?nm.slice(0,8)+'\u2026':nm);
            const t=svgText(E,lx,ly+3,lab,Math.cos(am)<0?'end':'start'); t.setAttribute('font-size','8'); svg.appendChild(t); });
        }
        wrap.appendChild(svg);
      }
      /* ---- Generic stacked bars over a category axis (seeded; data-series='[{"c":"--var","w":weight},…]')
         Options: data-shape='bell'|'grow'|'rand'  data-full='1' (each bar≈ymax, % stack)
                  data-bias='1' (last series grows toward the right; final bar all-last)
                  data-pct='1' (y labels as %)  data-xlabels='a|b|c' (evenly-spaced x labels) ---- */
      function stackbars(wrap){
        let series=[]; try{ series=JSON.parse(wrap.dataset.series||'[]'); }catch(e){ series=[]; }
        if(!series.length) series=[{c:'--cstop-1a'}];
        const n=parseInt(wrap.dataset.n||'26',10), ymax=parseFloat(wrap.dataset.ymax)||200000, seed=parseInt(wrap.dataset.seed||'7',10);
        const shape=wrap.dataset.shape||'bell', full=wrap.dataset.full==='1', bias=wrap.dataset.bias==='1', pct=wrap.dataset.pct==='1';
        const line=wrap.dataset.line||'';   // optional trend line across the stack tops (a CSS var name)
        const xl=(wrap.dataset.xlabels||'').split('|').filter(Boolean);
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),120);
        const padL=pct?34:46,padR=8,padT=8,padB=22, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,pct?Math.round(ymax*f)+'%':fmt(ymax*f),'end')); });
        const m3=chartMode(wrap), pat=usePattern(wrap);            // honor the Charts-look (iso / glass) knob + pattern sub-variant
        const r=rng(seed), step=innerW/n, bw=step*0.74, last=series.length-1, tops=[];
        const isoD=Math.max(2,Math.min(bw*0.5,10)), dvx=isoD*0.82, dvy=-isoD*0.5;
        const _defs=()=>{ let d=svg.querySelector('defs'); if(!d){ d=E('defs',{}); svg.insertBefore(d,svg.firstChild);} return d; };
        const _cc={}, _cv=cv=>(_cc[cv]||(_cc[cv]=cssVar(cv,wrap)));   // cache resolved colours (per series colour var)
        const _gc={}, _grad=(cv,glass)=>{ const k=(glass?'g':'i')+cv; if(_gc[k])return _gc[k]; const col=_cv(cv),gid=(glass?'sbg':'sbv')+nextGid(),lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
          if(glass){ lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(col,0.95)})); lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(col,0.6)})); }
          else { lg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(col,0.12)})); lg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(col,-0.14)})); }
          _defs().appendChild(lg); return (_gc[k]=gid); };
        for(let i=0;i<n;i++){ const t=n>1?i/(n-1):0;
          const profile=shape==='grow'?(0.12+0.85*t)*(0.85+r()*0.2):shape==='rand'?(0.2+r()*0.78):Math.pow(Math.sin(Math.min(1,t*1.12)*Math.PI),0.7);
          const total=full?ymax*(0.9+r()*0.08):ymax*(0.30+0.62*profile)*(0.82+r()*0.3);
          const finalAllLast=bias&&i===n-1;
          const shares=series.map((s,si)=>{ if(finalAllLast) return si===last?1:0.0001; let base=(s.w||1)*(0.55+0.9*r()); if(bias&&si===last) base*=(0.1+t*t*4); return base; });
          const sum=shares.reduce((a,b)=>a+b,0);
          let yb=padT+innerH; const x=padL+step*i+(step-bw)/2, x2=x+bw; let topCol=null;
          series.forEach((s,si)=>{ const h=(shares[si]/sum)*(Math.min(total,ymax)/ymax)*innerH; if(h<=0)return; const y=yb-h, cv=s.c||'--cstop-1a';
            if(m3==='iso'){ const col=_cv(cv);
              svg.appendChild(E('path',{d:`M${x2.toFixed(1)},${y.toFixed(1)} L${(x2+dvx).toFixed(1)},${(y+dvy).toFixed(1)} L${(x2+dvx).toFixed(1)},${(yb+dvy).toFixed(1)} L${x2.toFixed(1)},${yb.toFixed(1)} Z`,fill:shadeC(col,-0.26)}));   // right side wall
              svg.appendChild(E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),fill:`url(#${_grad(cv,false)})`}));   // front face
              topCol=col; }
            else if(m3==='glass'){ const col=_cv(cv);
              const fr=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),fill:`url(#${_grad(cv,true)})`}); fr.style.stroke=rgbaC(col,0.85); fr.style.strokeWidth='0.5'; svg.appendChild(fr); }
            else { const rect=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:Math.max(0.4,h).toFixed(1)}); rect.style.fill='var('+cv+')'; svg.appendChild(rect);
              if(pat) overlayRect(svg, x, y, bw, Math.max(0.4,h), si, wrap); }
            yb=y; });
          if(m3==='iso' && topCol!=null){ svg.appendChild(E('path',{d:`M${x.toFixed(1)},${yb.toFixed(1)} L${(x+dvx).toFixed(1)},${(yb+dvy).toFixed(1)} L${(x2+dvx).toFixed(1)},${(yb+dvy).toFixed(1)} L${x2.toFixed(1)},${yb.toFixed(1)} Z`,fill:shadeC(topCol,0.34)})); }  // single top face (lightest)
          else if(m3==='glass'){ const cb=padT+innerH; if(cb-yb>1){ svg.appendChild(E('rect',{x:x.toFixed(1),y:yb.toFixed(1),width:bw.toFixed(1),height:(cb-yb).toFixed(1),fill:`url(#${sheenGrad(svg,true)})`,'pointer-events':'none'})); svg.appendChild(E('rect',{x:x.toFixed(1),y:yb.toFixed(1),width:bw.toFixed(1),height:Math.min(2.2,cb-yb).toFixed(1),rx:1,fill:'rgba(255,255,255,0.55)'})); } }
          tops.push((x+bw/2).toFixed(1)+','+yb.toFixed(1)); }
        if(line){ svg.appendChild(E('polyline',{points:tops.join(' '),fill:'none',stroke:'var('+line+')','stroke-width':1.6,'stroke-linejoin':'round'})); }
        if(xl.length){ xl.forEach((lab,idx)=>{ const x=padL+(xl.length===1?innerW/2:innerW*idx/(xl.length-1)); const tx=svgText(E,Math.max(padL+8,Math.min(padL+innerW-8,x)),padT+innerH+12,lab,'middle'); tx.setAttribute('font-size','8'); svg.appendChild(tx); }); }
        else { const stepX=Math.max(1,Math.ceil(n/12)); for(let i=0;i<n;i+=stepX){ svg.appendChild(svgText(E,padL+step*i+step/2,padT+innerH+11,String(i),'middle')); } }
        wrap.appendChild(svg);
      }
      /* ---- Horizontal stacked bars per category (rows). data-cats='["m1",…]', data-series='[{"c","w"},…]'
         data-xmax (e.g. 150), data-xticks='0,50,100,150', data-labelw, seeded; older rows fuller. ---- */
      function hstackbars(wrap){
        let cats=[],series=[]; try{cats=JSON.parse(wrap.dataset.cats||'[]');}catch(e){} try{series=JSON.parse(wrap.dataset.series||'[]');}catch(e){}
        if(!series.length) series=[{c:'--cstop-1a'}];
        const xmax=parseFloat(wrap.dataset.xmax)||100, seed=parseInt(wrap.dataset.seed||'9',10), labelW=parseFloat(wrap.dataset.labelw)||46;
        const ticks=(wrap.dataset.xticks||('0,'+xmax)).split(',').map(Number);
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),120);
        const padL=labelW,padR=8,padT=6,padB=18, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        ticks.forEach(tk=>{ const x=padL+(tk/xmax)*innerW; svg.appendChild(E('line',{x1:x.toFixed(1),x2:x.toFixed(1),y1:padT,y2:padT+innerH,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,x,padT+innerH+11,tk+'%','middle')); });
        const m3=chartMode(wrap), pat=usePattern(wrap);            // honor the Charts-look (iso / glass) knob + pattern sub-variant
        const m=Math.max(1,cats.length), rh=innerH/m, bh=Math.min(13,rh*0.7), r=rng(seed), labCap=Math.max(4,Math.floor(labelW/5));
        const hD=Math.max(2,Math.min(bh*0.5,8)), hdx=hD*0.82, hdy=-hD*0.5;
        const _defs=()=>{ let d=svg.querySelector('defs'); if(!d){ d=E('defs',{}); svg.insertBefore(d,svg.firstChild);} return d; };
        const _cc={}, _cv=cv=>(_cc[cv]||(_cc[cv]=cssVar(cv,wrap)));
        const _gc={}, _grad=(cv,glass)=>{ const k=(glass?'g':'i')+cv; if(_gc[k])return _gc[k]; const col=_cv(cv),gid=(glass?'hsg':'hsv')+nextGid(),lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
          if(glass){ lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(col,0.95)})); lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(col,0.62)})); }
          else { lg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(col,0.12)})); lg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(col,-0.14)})); }
          _defs().appendChild(lg); return (_gc[k]=gid); };
        cats.forEach((cat,i)=>{ const cy=padT+rh*i+rh/2, y=cy-bh/2; const t=m>1?i/(m-1):0;
          const shown=(String(cat).length>labCap)?String(cat).slice(0,labCap-1)+'\u2026':String(cat);
          const lt=svgText(E,padL-5,cy+3,shown,'end'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt);
          const total=(0.34+0.62*t)*(0.9+r()*0.2)*100;
          const shares=series.map(s=>(s.w||1)*(0.45+0.95*r())), sum=shares.reduce((a,b)=>a+b,0);
          let x=padL, lastCol=null;
          series.forEach((s,si)=>{ const w=(shares[si]/sum)*(Math.min(total,xmax)/xmax)*innerW; if(w<=0)return; const cv=s.c||'--cstop-1a';
            if(m3==='iso'){ const col=_cv(cv);
              svg.appendChild(E('path',{d:`M${x.toFixed(1)},${y.toFixed(1)} L${(x+hdx).toFixed(1)},${(y+hdy).toFixed(1)} L${(x+w+hdx).toFixed(1)},${(y+hdy).toFixed(1)} L${(x+w).toFixed(1)},${y.toFixed(1)} Z`,fill:shadeC(col,0.30)}));   // top face (tiles along length)
              svg.appendChild(E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:Math.max(0.4,w).toFixed(1),height:bh.toFixed(1),fill:`url(#${_grad(cv,false)})`}));
              lastCol=col; }
            else if(m3==='glass'){ const col=_cv(cv);
              const fr=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:Math.max(0.4,w).toFixed(1),height:bh.toFixed(1),fill:`url(#${_grad(cv,true)})`}); fr.style.stroke=rgbaC(col,0.85); fr.style.strokeWidth='0.5'; svg.appendChild(fr); }
            else { const rect=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:Math.max(0.4,w).toFixed(1),height:bh.toFixed(1)}); rect.style.fill='var('+cv+')'; svg.appendChild(rect);
              if(pat) overlayRect(svg, x, y, Math.max(0.4,w), bh, si, wrap); }
            x+=w; });
          if(m3==='iso' && lastCol!=null){ svg.appendChild(E('path',{d:`M${x.toFixed(1)},${y.toFixed(1)} L${(x+hdx).toFixed(1)},${(y+hdy).toFixed(1)} L${(x+hdx).toFixed(1)},${(y+bh+hdy).toFixed(1)} L${x.toFixed(1)},${(y+bh).toFixed(1)} Z`,fill:shadeC(lastCol,-0.26)})); }  // right end cap (rightmost only)
          else if(m3==='glass' && x>padL){ svg.appendChild(E('rect',{x:padL.toFixed(1),y:y.toFixed(1),width:(x-padL).toFixed(1),height:Math.min(2,bh).toFixed(1),rx:1,fill:'rgba(255,255,255,0.5)','pointer-events':'none'})); }
          hitRect(svg,padL,padT+rh*i,innerW,rh,String(cat),[['Total',Math.round(total)+'%']]); });
        wrap.appendChild(svg);
      }
      /* ---- Generic multi-line time series (data-series='[{"c":"--var","name":"…","pts":[…]},…]')
         data-ymax, data-pct='1' (y labels as %), data-xlabels='a|b|c'. Honors the 3D knob (sphere markers). ---- */
      function linechart(wrap){
        let series=[]; try{ series=JSON.parse(wrap.dataset.series||'[]'); }catch(e){ series=[]; }
        if(!series.length) return;
        const ymax=parseFloat(wrap.dataset.ymax)||100, pct=wrap.dataset.pct==='1';
        const xl=(wrap.dataset.xlabels||'').split('|').filter(Boolean);
        const W=Math.max(Math.round(wrap.clientWidth),260), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=pct?44:40,padR=14,padT=10,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.2,0.4,0.6,0.8,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,pct?(ymax*f).toFixed(1)+'%':fmt(ymax*f),'end')); });
        const n=Math.max(1,...series.map(s=>(s.pts||[]).length)), step=n>1?innerW/(n-1):innerW;
        const m3=chartMode(wrap), pat=usePattern(wrap);
        series.forEach((s,si)=>{ const pts=s.pts||[], col=cssVar(s.c||'--cstop-1a', wrap);
          let d=''; pts.forEach((v,i)=>{ const x=padL+step*i, y=padT+innerH-(Math.min(v,ymax)/ymax)*innerH; d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); });
          const lp=E('path',{d:d,fill:'none','stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}); lp.style.stroke=col;
          if(pat){ const da=dashFor(si); if(da){ lp.setAttribute('stroke-dasharray',da); lp.setAttribute('stroke-linecap','butt'); } } svg.appendChild(lp);
          pts.forEach((v,i)=>{ const x=padL+step*i, y=padT+innerH-(Math.min(v,ymax)/ymax)*innerH;
            if(m3){ sphere(svg,+x.toFixed(1),+y.toFixed(1),3.2,col); }
            else if(pat){ marker(svg,+x.toFixed(1),+y.toFixed(1),3,si,col,si%2===1,wrap); }
            else { const c=E('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:2.6}); c.style.fill=col; svg.appendChild(c); } }); });
        if(xl.length){ xl.forEach((lab,i)=>{ const x=padL+(xl.length===1?innerW/2:innerW*i/(xl.length-1)); const t=svgText(E,Math.max(padL,Math.min(padL+innerW,x)),padT+innerH+13,lab,'middle'); t.setAttribute('font-size','8.5'); svg.appendChild(t); }); }
        for(let i=0;i<n;i++){ const cxp=padL+step*i, x0=Math.max(padL,cxp-step/2), x1=Math.min(padL+innerW,cxp+step/2);
          const rows=series.map((s,si)=>[s.name||('series '+(si+1)), (s.pts&&s.pts[i]!=null)?s.pts[i].toFixed(1)+(pct?'%':''):'-']);
          hitRect(svg,x0,padT,x1-x0,innerH,(xl[i]||('#'+i)),rows); }
        wrap.appendChild(svg);
      }
      /* ============================================================
         GENERIC GALLERY CHARTS — reusable, data-driven renderers.
         Each is size-aware (reads clientWidth/Height), theme-token aware
         (cssVar('--cstop-*'/'--legend-*')) and tooltip-enabled (hitRect/setTip).
         Drive them from any view via a <div class="chart-wrap" data-chart="TYPE"
         data-…='…'> — exactly like hbarcat / linechart / pie.
         ============================================================ */
      /* ---- Vertical / column bar chart (data-bars='[["Label",v],…]')
         data-ymax data-yticks="0,25,50" data-unit data-color. Honors the 3D knob. ---- */
      function barcat(wrap){
        let bars=[]; try{ bars=JSON.parse(wrap.dataset.bars||'[]'); }catch(e){ bars=[]; }
        const ymax=parseFloat(wrap.dataset.ymax)|| (bars.length?Math.max(...bars.map(b=>b[1]))*1.12:1);
        const ticks=(wrap.dataset.yticks||'').split(',').map(s=>parseFloat(s)).filter(v=>!isNaN(v));
        const unit=wrap.dataset.unit||'', cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),140);
        const padL=40,padR=10,padT=10,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        (ticks.length?ticks:[0,ymax/2,ymax]).forEach(t=>{ const y=padT+innerH*(1-t/ymax); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(t)+unit,'end')); });
        const n=Math.max(1,bars.length), step=innerW/n, bw=Math.min(46,step*0.62);
        const m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar(cvar, wrap);
        bars.forEach((b,i)=>{ const h=Math.max(1,(Math.min(b[1],ymax)/ymax)*innerH), x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          if(m3){ bar3dV(svg,x,y,bw,h,col,m3); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:2}); r.style.fill='var('+cvar+')'; svg.appendChild(r);
            if(pat) overlayRect(svg, x, y, bw, h, i, wrap, 2); }   // per-category texture
          const lt=svgText(E,padL+step*i+step/2,padT+innerH+12,String(b[0]),'middle'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt);
          hitRect(svg,padL+step*i,padT,step,innerH,String(b[0]),[['Value',fmt(b[1])+(unit?' '+unit:'')]]); });
        wrap.appendChild(svg);
      }
      /* ---- Grouped / clustered bars (data-cats='["A","B"]',
         data-series='[{"c":"--legend-1","name":"X","vals":[…]},…]') data-ymax data-unit. Honors 3D. ---- */
      function groupbars(wrap){
        let cats=[],series=[]; try{cats=JSON.parse(wrap.dataset.cats||'[]');}catch(e){} try{series=JSON.parse(wrap.dataset.series||'[]');}catch(e){}
        if(!series.length) series=[{c:'--cstop-1a',name:'series',vals:cats.map(()=>0)}];
        const allv=series.reduce((a,s)=>a.concat(s.vals||[]),[]);
        const ymax=parseFloat(wrap.dataset.ymax)|| (allv.length?Math.max(...allv)*1.12:1);
        const unit=wrap.dataset.unit||'';
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=42,padR=10,padT=12,padB=26, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(ymax*f),'end')); });
        const m3=chartMode(wrap), pat=usePattern(wrap), m=Math.max(1,cats.length), step=innerW/m, g=Math.max(1,series.length), gap=step*0.2, slot=(step-gap)/g, bw=slot*0.84;
        cats.forEach((cat,i)=>{ const x0=padL+step*i+gap/2;
          series.forEach((s,si)=>{ const v=(s.vals&&s.vals[i])||0, h=Math.max(1,(Math.min(v,ymax)/ymax)*innerH), x=x0+si*slot+(slot-bw)/2, y=padT+innerH-h, col=cssVar(s.c||'--cstop-1a',wrap);
            if(m3){ bar3dV(svg,x,y,bw,h,col,m3); }
            else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1.5}); r.style.fill='var('+(s.c||'--cstop-1a')+')'; svg.appendChild(r);
              if(pat) overlayRect(svg, x, y, bw, h, si, wrap, 1.5); } });
          const lt=svgText(E,padL+step*i+step/2,padT+innerH+12,String(cat),'middle'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt);
          hitRect(svg,padL+step*i,padT,step,innerH,String(cat),series.map(s=>[s.name||'series',fmt((s.vals&&s.vals[i])||0)+(unit?' '+unit:'')])); });
        wrap.appendChild(svg);
      }
      /* ---- Dot plot (data-dots='[["Label",v],…]') data-xmin data-xmax data-xticks data-labelw data-unit data-color.
         Categorical rows; value encoded by point position (no zero baseline implied). ---- */
      function dotplot(wrap){
        let dots=[]; try{ dots=JSON.parse(wrap.dataset.dots||'[]'); }catch(e){ dots=[]; }
        const vals=dots.map(d=>d[1]);
        const xmin=wrap.dataset.xmin!=null?parseFloat(wrap.dataset.xmin):Math.min(0,...(vals.length?vals:[0]));
        const xmax=parseFloat(wrap.dataset.xmax)|| (vals.length?Math.max(...vals)*1.08:1);
        const ticks=(wrap.dataset.xticks||'').split(',').map(s=>parseFloat(s)).filter(v=>!isNaN(v));
        const unit=wrap.dataset.unit||'', labelW=parseFloat(wrap.dataset.labelw)||96, cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),120);
        const padL=labelW,padR=14,padT=8,padB=22, innerW=W-padL-padR, innerH=H-padT-padB, sxden=(xmax-xmin)||1;
        const sx=v=>padL+((v-xmin)/sxden)*innerW;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        (ticks.length?ticks:[xmin,(xmin+xmax)/2,xmax]).forEach(t=>{ const x=sx(t); svg.appendChild(E('line',{x1:x.toFixed(1),x2:x.toFixed(1),y1:padT,y2:padT+innerH,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,x,padT+innerH+12,fmt(t)+unit,'middle')); });
        const n=Math.max(1,dots.length), rh=innerH/n, m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar(cvar, wrap);
        dots.forEach((d,i)=>{ const cy=padT+rh*i+rh/2, cx=sx(d[1]);
          svg.appendChild(E('line',{x1:padL,x2:cx.toFixed(1),y1:cy.toFixed(1),y2:cy.toFixed(1),stroke:'rgba(128,128,128,0.22)','stroke-width':1}));
          if(m3){ sphere(svg,+cx.toFixed(1),+cy.toFixed(1),4.6,col); }
          else if(pat){ marker(svg, cx, cy, 4.8, i, col, false, wrap); }   // per-category marker shape
          else { const c=E('circle',{cx:cx.toFixed(1),cy:cy.toFixed(1),r:4.6}); c.style.fill='var('+cvar+')'; svg.appendChild(c); }
          const lt=svgText(E,padL-8,cy+3,String(d[0]),'end'); lt.setAttribute('font-size','9'); svg.appendChild(lt);
          hitRect(svg,0,padT+rh*i,W,rh,String(d[0]),[['Value',fmt(d[1])+(unit?' '+unit:'')]]); });
        wrap.appendChild(svg);
      }
      /* ---- Scatter plot. Single series via data-points='[[x,y],…]' (+ data-color,
         data-trend="1"), or multi-series via data-series='[{"c":"--var","name":"…",
         "pts":[[x,y],…],"trend":true},…]'. data-xmax data-ymax. Pattern sub-variant
         gives each series its own marker shape + trend dash. ---- */
      function scatter(wrap){
        const cvar=wrap.dataset.color||'--cstop-1a', gtrend=wrap.dataset.trend==='1';
        let series=[]; try{ series=JSON.parse(wrap.dataset.series||'[]'); }catch(e){ series=[]; }
        if(!series.length){ let pts=[]; try{ pts=JSON.parse(wrap.dataset.points||'[]'); }catch(e){ pts=[]; } series=[{c:cvar,name:'Point',pts:pts,trend:gtrend}]; }
        const allpts=series.reduce((a,s)=>a.concat(s.pts||[]),[]);
        const xs=allpts.map(p=>p[0]), ys=allpts.map(p=>p[1]);
        const xmax=parseFloat(wrap.dataset.xmax)|| (xs.length?Math.max(...xs)*1.1:1);
        const ymax=parseFloat(wrap.dataset.ymax)|| (ys.length?Math.max(...ys)*1.1:1);
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),140);
        const padL=38,padR=12,padT=10,padB=24, innerW=W-padL-padR, innerH=H-padT-padB;
        const sx=v=>padL+(v/xmax)*innerW, sy=v=>padT+innerH-(v/ymax)*innerH;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(ymax*f),'end')); });
        [0,0.5,1].forEach(f=>{ svg.appendChild(svgText(E,padL+innerW*f,padT+innerH+12,fmt(xmax*f),f===0?'start':(f===1?'end':'middle'))); });
        const m3=chartMode(wrap), pat=usePattern(wrap);
        series.forEach((s,si)=>{ const pts=s.pts||[], col=cssVar(s.c||cvar, wrap), showTrend=(s.trend!==undefined?s.trend:gtrend);
          if(showTrend && pts.length>1){ const sxv=pts.map(p=>p[0]), syv=pts.map(p=>p[1]), n=pts.length;
            const sX=sxv.reduce((a,b)=>a+b,0), sY=syv.reduce((a,b)=>a+b,0), sXY=pts.reduce((a,p)=>a+p[0]*p[1],0), sXX=sxv.reduce((a,b)=>a+b*b,0);
            const m=(n*sXY-sX*sY)/((n*sXX-sX*sX)||1), b=(sY-m*sX)/n;
            const tl=E('line',{x1:sx(0).toFixed(1),x2:sx(xmax).toFixed(1),y1:sy(Math.max(0,Math.min(ymax,b))).toFixed(1),y2:sy(Math.max(0,Math.min(ymax,m*xmax+b))).toFixed(1),stroke:rgbaC(col,0.6),'stroke-width':2,'stroke-dasharray':(pat?(dashFor(si)||'5 4'):'5 4')}); svg.appendChild(tl); }
          pts.forEach(p=>{ const cx=sx(Math.min(p[0],xmax)), cy=sy(Math.min(p[1],ymax));
            if(m3){ sphere(svg,+cx.toFixed(1),+cy.toFixed(1),3.6,col); }
            else if(pat){ marker(svg,+cx.toFixed(1),+cy.toFixed(1),3.4,si,col,si%2===1,wrap); }
            else { const c=E('circle',{cx:cx.toFixed(1),cy:cy.toFixed(1),r:3.4}); c.style.fill=rgbaC(col,0.8); svg.appendChild(c); }
            const h=E('circle',{cx:cx.toFixed(1),cy:cy.toFixed(1),r:8,fill:'transparent','pointer-events':'all'}); setTip(h,s.name||'Point',[['x',fmt(p[0])],['y',fmt(p[1])]]); svg.appendChild(h); }); });
        wrap.appendChild(svg);
      }
      /* ---- Bubble chart (data-points='[[x,y,size,"label"?],…]') data-xmax data-ymax data-smax data-rmax data-rmin data-color. ---- */
      function bubble(wrap){
        let pts=[]; try{ pts=JSON.parse(wrap.dataset.points||'[]'); }catch(e){ pts=[]; }
        const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]), ss=pts.map(p=>p[2]||0);
        const xmax=parseFloat(wrap.dataset.xmax)|| (xs.length?Math.max(...xs)*1.1:1);
        const ymax=parseFloat(wrap.dataset.ymax)|| (ys.length?Math.max(...ys)*1.1:1);
        const smax=parseFloat(wrap.dataset.smax)|| (ss.length?Math.max(...ss):1);
        const rmax=parseFloat(wrap.dataset.rmax)||22, rmin=parseFloat(wrap.dataset.rmin)||5, cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=38,padR=14,padT=12,padB=24, innerW=W-padL-padR, innerH=H-padT-padB;
        const sx=v=>padL+(v/xmax)*innerW, sy=v=>padT+innerH-(v/ymax)*innerH, sr=v=>rmin+Math.sqrt((v/smax)||0)*(rmax-rmin);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(ymax*f),'end')); });
        [0,0.5,1].forEach(f=>{ svg.appendChild(svgText(E,padL+innerW*f,padT+innerH+12,fmt(xmax*f),f===0?'start':(f===1?'end':'middle'))); });
        const m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar(cvar, wrap);
        pts.forEach(p=>{ const cx=sx(Math.min(p[0],xmax)), cy=sy(Math.min(p[1],ymax)), r=sr(p[2]||0);
          if(m3){ sphere(svg,+cx.toFixed(1),+cy.toFixed(1),r,col); }
          else { const c=E('circle',{cx:cx.toFixed(1),cy:cy.toFixed(1),r:r.toFixed(1)}); c.style.fill=rgbaC(col,0.45); c.style.stroke=rgbaC(col,0.9); c.style.strokeWidth='1'; svg.appendChild(c);
            if(pat) overlayCircle(svg, cx, cy, r, 1, wrap); }   // texture inside each bubble
          const h=E('circle',{cx:cx.toFixed(1),cy:cy.toFixed(1),r:Math.max(r,8).toFixed(1),fill:'transparent','pointer-events':'all'}); setTip(h,p[3]||'Bubble',[['x',fmt(p[0])],['y',fmt(p[1])],['size',fmt(p[2]||0)]]); svg.appendChild(h); });
        wrap.appendChild(svg);
      }
      /* ---- Box plot (data-boxes='[["Group",min,q1,med,q3,max],…]') data-ymin data-ymax data-unit data-color. ---- */
      function boxplot(wrap){
        let boxes=[]; try{ boxes=JSON.parse(wrap.dataset.boxes||'[]'); }catch(e){ boxes=[]; }
        const allv=boxes.reduce((a,b)=>a.concat(b.slice(1)),[]);
        const ymax=parseFloat(wrap.dataset.ymax)|| (allv.length?Math.max(...allv)*1.1:1);
        const ymin=wrap.dataset.ymin!=null?parseFloat(wrap.dataset.ymin):0, unit=wrap.dataset.unit||'', cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=40,padR=12,padT=10,padB=24, innerW=W-padL-padR, innerH=H-padT-padB, yspan=(ymax-ymin)||1;
        const sy=v=>padT+innerH-((v-ymin)/yspan)*innerH;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const v=ymin+yspan*f, y=sy(v); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(v)+unit,'end')); });
        const n=Math.max(1,boxes.length), step=innerW/n, bw=Math.min(54,step*0.5), m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar(cvar, wrap), wcol=rgbaC(col,0.85);
        boxes.forEach((b,i)=>{ const cx=padL+step*i+step/2, x=cx-bw/2, mn=b[1],q1=b[2],med=b[3],q3=b[4],mx=b[5];
          svg.appendChild(E('line',{x1:cx,x2:cx,y1:sy(mx).toFixed(1),y2:sy(q3).toFixed(1),stroke:wcol,'stroke-width':1.4}));
          svg.appendChild(E('line',{x1:cx,x2:cx,y1:sy(q1).toFixed(1),y2:sy(mn).toFixed(1),stroke:wcol,'stroke-width':1.4}));
          svg.appendChild(E('line',{x1:(cx-bw*0.3).toFixed(1),x2:(cx+bw*0.3).toFixed(1),y1:sy(mx).toFixed(1),y2:sy(mx).toFixed(1),stroke:wcol,'stroke-width':1.4}));
          svg.appendChild(E('line',{x1:(cx-bw*0.3).toFixed(1),x2:(cx+bw*0.3).toFixed(1),y1:sy(mn).toFixed(1),y2:sy(mn).toFixed(1),stroke:wcol,'stroke-width':1.4}));
          const by=sy(q3), bhh=Math.max(1,sy(q1)-sy(q3));
          if(m3){ bar3dV(svg,x,by,bw,bhh,col,m3); }   // IQR box extrudes (iso) / glosses (glass) via the shared toolkit
          else { const r=E('rect',{x:x.toFixed(1),y:by.toFixed(1),width:bw.toFixed(1),height:bhh.toFixed(1),rx:2}); r.style.fill=rgbaC(col,0.32); r.style.stroke=col; r.style.strokeWidth='1.4'; svg.appendChild(r);
            if(pat) overlayRect(svg, x, by, bw, bhh, i, wrap, 2); }   // per-group texture
          svg.appendChild(E('line',{x1:x.toFixed(1),x2:(x+bw).toFixed(1),y1:sy(med).toFixed(1),y2:sy(med).toFixed(1),stroke:m3?'rgba(255,255,255,0.92)':col,'stroke-width':2}));
          const lt=svgText(E,cx,padT+innerH+12,String(b[0]),'middle'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt);
          hitRect(svg,padL+step*i,padT,step,innerH,String(b[0]),[['Max',fmt(mx)],['Q3',fmt(q3)],['Median',fmt(med)],['Q1',fmt(q1)],['Min',fmt(mn)]]); });
        wrap.appendChild(svg);
      }
      /* ---- Violin plot (data-violins='[{"name":"X","values":[…],"c":"--var"?},…]') data-ymin data-ymax data-bw. ---- */
      function violin(wrap){
        let groups=[]; try{ groups=JSON.parse(wrap.dataset.violins||'[]'); }catch(e){ groups=[]; }
        const allv=groups.reduce((a,g)=>a.concat(g.values||[]),[]);
        if(!allv.length){ wrap.appendChild(E('svg',{})); return; }
        const ymin=wrap.dataset.ymin!=null?parseFloat(wrap.dataset.ymin):Math.min(...allv);
        const ymax=wrap.dataset.ymax!=null?parseFloat(wrap.dataset.ymax):Math.max(...allv);
        const span=(ymax-ymin)||1, bw=parseFloat(wrap.dataset.bw)||span/10, cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=40,padR=12,padT=10,padB=24, innerW=W-padL-padR, innerH=H-padT-padB;
        const sy=v=>padT+innerH-((v-ymin)/span)*innerH;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.25,0.5,0.75,1].forEach(f=>{ const v=ymin+span*f, y=sy(v); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(v),'end')); });
        const n=Math.max(1,groups.length), step=innerW/n, halfW=Math.min(step*0.4,40), M=40, m3=chartMode(wrap), pat=usePattern(wrap);
        groups.forEach((g,gi)=>{ const cx=padL+step*gi+step/2, vals=g.values||[], col=cssVar(g.c||cvar, wrap);
          const dens=[]; let dmax=0; for(let i=0;i<=M;i++){ const y=ymin+span*i/M; let s=0; vals.forEach(v=>{ const u=(y-v)/bw; s+=Math.exp(-0.5*u*u); }); dens.push([y,s]); if(s>dmax)dmax=s; }
          let dPath=''; dens.forEach((p,i)=>{ const w=(p[1]/(dmax||1))*halfW; dPath+=(i?'L':'M')+(cx+w).toFixed(1)+','+sy(p[0]).toFixed(1); });
          for(let i=dens.length-1;i>=0;i--){ const w=(dens[i][1]/(dmax||1))*halfW; dPath+='L'+(cx-w).toFixed(1)+','+sy(dens[i][0]).toFixed(1); }
          dPath+='Z';
          if(m3==='iso'){
            // rounded-volume shading across the width (dark edges -> lit centre spine) — no offset
            // duplicate, which used to ghost the thin KDE tails into broken double spikes.
            const gid='vi'+nextGid(), lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:1,y2:0});
            lg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(col,-0.26)})); lg.appendChild(E('stop',{offset:'50%','stop-color':shadeC(col,0.18)})); lg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(col,-0.26)}));
            svgDefs(svg).appendChild(lg);
            const front=E('path',{d:dPath,fill:`url(#${gid})`}); front.style.stroke=shadeC(col,-0.12); front.style.strokeWidth='1'; svg.appendChild(front);
          } else if(m3==='glass'){
            const front=E('path',{d:dPath,fill:`url(#${glassTopGrad(svg,col)})`}); front.style.fillOpacity='0.96'; front.style.stroke=rgbaC(shadeC(col,0.45),0.6); front.style.strokeWidth='1.1'; svg.appendChild(front);
            svg.appendChild(E('path',{d:dPath,fill:`url(#${glassSheenGrad(svg,0.5)})`,'pointer-events':'none'}));   // single soft specular sheen
          } else {
            const body=E('path',{d:dPath}); body.style.fill=rgbaC(col,0.3); body.style.stroke=col; body.style.strokeWidth='1.4'; svg.appendChild(body);
            if(pat) overlayPath(svg, dPath, gi, wrap);   // per-group texture
          }
          const sorted=vals.slice().sort((a,b)=>a-b), q=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.round(p*(sorted.length-1)))]:0;
          const med=q(0.5),q1=q(0.25),q3=q(0.75);
          const r=E('rect',{x:(cx-3).toFixed(1),y:sy(q3).toFixed(1),width:6,height:Math.max(1,sy(q1)-sy(q3)).toFixed(1)}); r.style.fill=rgbaC(shadeC(col,-0.25),0.96); svg.appendChild(r);
          svg.appendChild(E('circle',{cx:cx.toFixed(1),cy:sy(med).toFixed(1),r:2.4,fill:'#fff'}));
          const lt=svgText(E,cx,padT+innerH+12,String(g.name||''),'middle'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt);
          hitRect(svg,padL+step*gi,padT,step,innerH,String(g.name||''),[['Median',fmt(med)],['Q3',fmt(q3)],['Q1',fmt(q1)],['n',String(vals.length)]]); });
        wrap.appendChild(svg);
      }
      /* ---- Density curve / KDE (data-values='[…]') data-xmin data-xmax data-bw data-color. ---- */
      function density(wrap){
        let vals=[]; try{ vals=JSON.parse(wrap.dataset.values||'[]'); }catch(e){ vals=[]; }
        if(!vals.length){ wrap.appendChild(E('svg',{})); return; }
        const xmin=wrap.dataset.xmin!=null?parseFloat(wrap.dataset.xmin):Math.min(...vals);
        const xmax=wrap.dataset.xmax!=null?parseFloat(wrap.dataset.xmax):Math.max(...vals);
        const span=(xmax-xmin)||1, bw=parseFloat(wrap.dataset.bw)||span/12, cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),140);
        const padL=34,padR=12,padT=10,padB=24, innerW=W-padL-padR, innerH=H-padT-padB, M=64;
        const dens=[]; let dmax=0;
        for(let i=0;i<=M;i++){ const x=xmin+span*i/M; let s=0; vals.forEach(v=>{ const u=(x-v)/bw; s+=Math.exp(-0.5*u*u); }); s/=(vals.length*bw*Math.sqrt(2*Math.PI)); dens.push([x,s]); if(s>dmax)dmax=s; }
        const sx=x=>padL+((x-xmin)/span)*innerW, sy=d=>padT+innerH-(d/(dmax||1))*innerH;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.14)','stroke-dasharray':'2 4'})); });
        [0,0.5,1].forEach(f=>{ svg.appendChild(svgText(E,padL+innerW*f,padT+innerH+12,fmt(xmin+span*f),f===0?'start':(f===1?'end':'middle'))); });
        const m3=chartMode(wrap), col=cssVar(cvar, wrap);
        let d=''; dens.forEach((p,i)=>{ d+=(i?'L':'M')+sx(p[0]).toFixed(1)+','+sy(p[1]).toFixed(1); });
        const gid='dn'+nextGid(), lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
        lg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(col,m3?0.55:0.42)})); lg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(col,m3?0.05:0.04)})); svgDefs(svg).appendChild(lg);
        const areaD=d+`L${sx(xmax).toFixed(1)},${(padT+innerH).toFixed(1)}L${sx(xmin).toFixed(1)},${(padT+innerH).toFixed(1)}Z`;
        svg.appendChild(E('path',{d:areaD,fill:`url(#${gid})`}));
        if(usePattern(wrap)) overlayPath(svg, areaD, 1, wrap);   // single texture over the KDE area
        if(m3==='iso'){ const lip=E('path',{d:d,fill:'none','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 4)'}); lip.style.stroke=shadeC(col,-0.3); lip.style.opacity='0.85'; svg.appendChild(lip); }   // depth lip
        const lp=E('path',{d:d,fill:'none','stroke-width':m3?2.6:2.2,'stroke-linecap':'round','stroke-linejoin':'round'}); lp.style.stroke=col; svg.appendChild(lp);
        if(m3){ const gloss=E('path',{d:d,fill:'none','stroke-width':1,'stroke-linecap':'round',transform:'translate(0 -1.4)'}); gloss.style.stroke='rgba(255,255,255,0.55)'; svg.appendChild(gloss);
          dens.forEach((p,i)=>{ if(i%8)return; sphere(svg,+sx(p[0]).toFixed(1),+sy(p[1]).toFixed(1),3,col); }); }
        dens.forEach((p,i)=>{ if(i%6)return; const x0=Math.max(padL,sx(p[0])-innerW/M*3),x1=Math.min(padL+innerW,sx(p[0])+innerW/M*3); hitRect(svg,x0,padT,x1-x0,innerH,'x \u2248 '+fmt(p[0]),[['density',p[1].toFixed(4)]]); });
        wrap.appendChild(svg);
      }
      /* ---- Histogram (data-values='[…]') data-bins data-xmin data-xmax data-unit data-color. Honors 3D. ---- */
      function histogram(wrap){
        let vals=[]; try{ vals=JSON.parse(wrap.dataset.values||'[]'); }catch(e){ vals=[]; }
        if(!vals.length){ wrap.appendChild(E('svg',{})); return; }
        const bins=parseInt(wrap.dataset.bins,10)||12;
        const xmin=wrap.dataset.xmin!=null?parseFloat(wrap.dataset.xmin):Math.min(...vals);
        const xmax=wrap.dataset.xmax!=null?parseFloat(wrap.dataset.xmax):Math.max(...vals);
        const span=(xmax-xmin)||1, bwv=span/bins, cvar=wrap.dataset.color||'--cstop-1a', unit=wrap.dataset.unit||'';
        const counts=new Array(bins).fill(0); vals.forEach(v=>{ let k=Math.floor((v-xmin)/bwv); if(k>=bins)k=bins-1; if(k<0)k=0; counts[k]++; });
        const cmax=Math.max(...counts)*1.1||1;
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),140);
        const padL=36,padR=10,padT=10,padB=24, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*(1-f); svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,padL-4,y+3,fmt(cmax*f),'end')); });
        const step=innerW/bins, bw=step*0.92, m3=chartMode(wrap), pat=usePattern(wrap), col=cssVar(cvar, wrap);
        counts.forEach((c,i)=>{ const h=Math.max(0.5,(c/cmax)*innerH), x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          if(m3){ bar3dV(svg,x,y,bw,h,col,m3); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1)}); r.style.fill='var('+cvar+')'; svg.appendChild(r);
            if(pat) overlayRect(svg, x, y, bw, h, 1, wrap, 0); }
          hitRect(svg,padL+step*i,padT,step,innerH,fmt(xmin+i*bwv)+'\u2013'+fmt(xmin+(i+1)*bwv)+(unit?' '+unit:''),[['Count',String(c)]]); });
        [0,0.5,1].forEach(f=>{ svg.appendChild(svgText(E,padL+innerW*f,padT+innerH+12,fmt(xmin+span*f),f===0?'start':(f===1?'end':'middle'))); });
        wrap.appendChild(svg);
      }
      /* ---- Heatmap (data-rows='[…]', data-cols='[…]', data-matrix='[[…],…]') data-vmin data-vmax data-unit data-labelw. ---- */
      function heatmap(wrap){
        let rows=[],cols=[],mat=[]; try{rows=JSON.parse(wrap.dataset.rows||'[]');}catch(e){} try{cols=JSON.parse(wrap.dataset.cols||'[]');}catch(e){} try{mat=JSON.parse(wrap.dataset.matrix||'[]');}catch(e){}
        const flat=mat.reduce((a,r)=>a.concat(r),[]);
        const vmax=parseFloat(wrap.dataset.vmax)|| (flat.length?Math.max(...flat):1);
        const vmin=wrap.dataset.vmin!=null?parseFloat(wrap.dataset.vmin):0, unit=wrap.dataset.unit||'';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),140);
        const padL=parseFloat(wrap.dataset.labelw)||64, padR=8, padT=8, padB=22, innerW=W-padL-padR, innerH=H-padT-padB;
        const nr=Math.max(1,rows.length), nc=Math.max(1,cols.length), cw=innerW/nc, ch=innerH/nr, vspan=(vmax-vmin)||1;
        const ramp=['--cstop-1b','--cstop-1a','--cstop-2a','--cstop-3a','--cstop-4a'].map(v=>cssVar(v,wrap)).filter(Boolean);
        const stops=ramp.length?ramp:[cssVar('--cstop-1a',wrap)||'#6366f1'];
        const rampColor=t=>{ if(stops.length===1)return rgbaC(stops[0],0.2+0.72*t); const p=t*(stops.length-1), i=Math.min(stops.length-2,Math.floor(p)), f=p-i, a=toRGB(stops[i]), b=toRGB(stops[i+1]); return `rgb(${Math.round(a.r+(b.r-a.r)*f)},${Math.round(a.g+(b.g-a.g)*f)},${Math.round(a.b+(b.b-a.b)*f)})`; };
        const m3=chartMode(wrap), svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        rows.forEach((rl,ri)=>{ cols.forEach((cl,ci)=>{ const v=(mat[ri]&&mat[ri][ci])||0, t=Math.max(0,Math.min(1,(v-vmin)/vspan)), x=padL+cw*ci, y=padT+ch*ri, cellCol=rampColor(t), w=Math.max(0.5,cw-2), hh=Math.max(0.5,ch-2);
            let cell;
            if(m3==='iso'){
              // extruded tile fully contained in the cw x ch slot (front face + right/bottom side
              // faces) so the depth never bleeds into neighbouring cells like the old offset bevel did
              const g2=2.5, dep=Math.max(2,Math.min(cw,ch)*0.12), fw=Math.max(0.5,cw-g2-dep), fh=Math.max(0.5,ch-g2-dep);
              svg.appendChild(E('path',{d:`M${(x+fw).toFixed(1)},${y.toFixed(1)} L${(x+fw+dep).toFixed(1)},${(y+dep).toFixed(1)} L${(x+fw+dep).toFixed(1)},${(y+fh+dep).toFixed(1)} L${(x+fw).toFixed(1)},${(y+fh).toFixed(1)} Z`,fill:shadeC(cellCol,-0.30)}));
              svg.appendChild(E('path',{d:`M${x.toFixed(1)},${(y+fh).toFixed(1)} L${(x+fw).toFixed(1)},${(y+fh).toFixed(1)} L${(x+fw+dep).toFixed(1)},${(y+fh+dep).toFixed(1)} L${(x+dep).toFixed(1)},${(y+fh+dep).toFixed(1)} Z`,fill:shadeC(cellCol,-0.18)}));
              cell=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:fw.toFixed(1),height:fh.toFixed(1),rx:1}); cell.style.fill=cellCol; svg.appendChild(cell);
            } else if(m3==='glass'){
              cell=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:w.toFixed(1),height:hh.toFixed(1),rx:3}); cell.style.fill=cellCol; cell.style.stroke='rgba(255,255,255,0.28)'; cell.style.strokeWidth='0.7'; svg.appendChild(cell);
              svg.appendChild(E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:w.toFixed(1),height:(hh*0.5).toFixed(1),rx:3,fill:`url(#${sheenGrad(svg,false)})`,'pointer-events':'none'}));
            } else {
              cell=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:w.toFixed(1),height:hh.toFixed(1),rx:2}); cell.style.fill=cellCol; svg.appendChild(cell);
            }
            setTip(cell,rl+' \u00b7 '+cl,[['Value',fmt(v)+(unit?' '+unit:'')]]); });
          const lt=svgText(E,padL-6,padT+ch*ri+ch/2+3,String(rl),'end'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt); });
        cols.forEach((cl,ci)=>{ const lt=svgText(E,padL+cw*ci+cw/2,padT+innerH+12,String(cl),'middle'); lt.setAttribute('font-size','8'); svg.appendChild(lt); });
        wrap.appendChild(svg);
      }
      /* ---- Funnel chart (data-stages='[["Stage",value],…]') data-unit. ---- */
      function funnel(wrap){
        let stages=[]; try{ stages=JSON.parse(wrap.dataset.stages||'[]'); }catch(e){ stages=[]; }
        if(!stages.length){ wrap.appendChild(E('svg',{})); return; }
        const vmax=Math.max(...stages.map(s=>s[1]))||1, unit=wrap.dataset.unit||'';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),150);
        const padL=10,padR=10,padT=8,padB=8, innerW=W-padL-padR, innerH=H-padT-padB;
        const cx=padL+innerW/2, n=stages.length, rh=innerH/n, wAt=v=>(v/vmax)*innerW;
        const pal=['--cstop-1a','--cstop-2a','--cstop-3a','--cstop-4a','--legend-2','--legend-1'];
        const m3=chartMode(wrap), pat=usePattern(wrap), svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        stages.forEach((s,i)=>{ const wTop=wAt(s[1]), wBot=wAt(i<n-1?stages[i+1][1]:s[1]*0.78), y=padT+rh*i, gap=Math.min(6,rh*0.16);
          const x0=cx-wTop/2,x1=cx+wTop/2,x2=cx+wBot/2,x3=cx-wBot/2, yT=y+gap/2, yB=y+rh-gap/2, cvar=pal[i%pal.length], col=cssVar(cvar,wrap);
          const dTrap=`M${x0.toFixed(1)},${yT.toFixed(1)} L${x1.toFixed(1)},${yT.toFixed(1)} L${x2.toFixed(1)},${yB.toFixed(1)} L${x3.toFixed(1)},${yB.toFixed(1)} Z`;
          if(m3==='iso'){
            // solid bottom "thickness" band sitting in the inter-slice gap (no offset duplicate, which
            // used to poke jagged ghosts above each slice) + a top-lit front face for the 3D ribbon look
            const dep=Math.min(5, gap*0.8);
            if(dep>0.5) svg.appendChild(E('path',{d:`M${x3.toFixed(1)},${yB.toFixed(1)} L${x2.toFixed(1)},${yB.toFixed(1)} L${x2.toFixed(1)},${(yB+dep).toFixed(1)} L${x3.toFixed(1)},${(yB+dep).toFixed(1)} Z`,fill:shadeC(col,-0.32)}));
            const gid='fn'+nextGid(), lg=E('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1}); lg.appendChild(E('stop',{offset:'0%','stop-color':shadeC(col,0.18)})); lg.appendChild(E('stop',{offset:'100%','stop-color':shadeC(col,-0.12)})); svgDefs(svg).appendChild(lg);
            svg.appendChild(E('path',{d:dTrap,fill:`url(#${gid})`}));
          } else if(m3==='glass'){
            const fp=E('path',{d:dTrap,fill:`url(#${glassTopGrad(svg,col)})`}); fp.style.fillOpacity='0.96'; fp.style.stroke=rgbaC(shadeC(col,0.45),0.5); fp.style.strokeWidth='1'; svg.appendChild(fp);
            svg.appendChild(E('path',{d:dTrap,fill:`url(#${glassSheenGrad(svg,0.5)})`,'pointer-events':'none'}));
          } else {
            const p=E('path',{d:dTrap}); p.style.fill='var('+cvar+')'; p.style.opacity='0.9'; svg.appendChild(p);
            if(pat) overlayPath(svg, dTrap, i, wrap);   // per-stage texture
          }
          const pct=(s[1]/stages[0][1]*100);
          const t1=svgText(E,cx,y+rh/2-2,String(s[0]),'middle'); t1.setAttribute('font-size','10'); t1.setAttribute('fill','rgba(255,255,255,0.96)'); t1.setAttribute('font-weight','600'); svg.appendChild(t1);
          const t2=svgText(E,cx,y+rh/2+12,fmt(s[1])+(unit?' '+unit:'')+'  ('+pct.toFixed(0)+'%)','middle'); t2.setAttribute('font-size','9'); t2.setAttribute('fill','rgba(255,255,255,0.82)'); svg.appendChild(t2);
          hitRect(svg,padL,y,innerW,rh,String(s[0]),[['Value',fmt(s[1])+(unit?' '+unit:'')],['Of top',pct.toFixed(1)+'%']]); });
        wrap.appendChild(svg);
      }
      /* ---- Bullet chart (data-value data-target data-max data-bands='[v1,v2]' data-label data-unit data-color). ---- */
      function bullet(wrap){
        const value=parseFloat(wrap.dataset.value)||0, target=parseFloat(wrap.dataset.target), max=parseFloat(wrap.dataset.max)||(Math.max(value,target||0)*1.1)||1;
        let bands=[]; try{ bands=JSON.parse(wrap.dataset.bands||'[]'); }catch(e){ bands=[]; }
        const label=wrap.dataset.label||'', unit=wrap.dataset.unit||'', cvar=wrap.dataset.color||'--cstop-1a';
        const W=Math.max(Math.round(wrap.clientWidth),200), H=Math.max(Math.round(wrap.clientHeight),54);
        const padL=8,padR=10,padT=label?18:8,padB=18, innerW=W-padL-padR, innerH=H-padT-padB;
        const sx=v=>padL+(Math.min(v,max)/max)*innerW;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        const m3=chartMode(wrap), col=cssVar(cvar, wrap);
        if(label){ const lt=svgText(E,padL,12,label,'start'); lt.setAttribute('font-size','10.5'); lt.setAttribute('fill','var(--text-dim)'); svg.appendChild(lt); }
        const edges=[0,...bands,max]; for(let i=0;i<edges.length-1;i++){ const x=sx(edges[i]), w=sx(edges[i+1])-sx(edges[i]), op=0.08+0.06*(edges.length-2-i); const r=E('rect',{x:x.toFixed(1),y:padT.toFixed(1),width:Math.max(0.5,w).toFixed(1),height:innerH.toFixed(1),rx:3}); r.style.fill='rgba(128,128,128,'+op.toFixed(2)+')'; svg.appendChild(r); }
        const bh=innerH*0.42, by=padT+(innerH-bh)/2, bwid=Math.max(1,sx(value)-padL);
        if(m3){ bar3dH(svg,padL,by,bwid,bh,col,m3); }   // measure bar extrudes (iso) / glosses (glass)
        else { const mb=E('rect',{x:padL.toFixed(1),y:by.toFixed(1),width:bwid.toFixed(1),height:bh.toFixed(1),rx:2}); mb.style.fill='var('+cvar+')'; svg.appendChild(mb);
          if(usePattern(wrap)) overlayRect(svg, padL, by, bwid, bh, 1, wrap, 2); }
        if(!isNaN(target)){ const tx=sx(target); svg.appendChild(E('line',{x1:tx.toFixed(1),x2:tx.toFixed(1),y1:padT.toFixed(1),y2:(padT+innerH).toFixed(1),stroke:'var(--text)','stroke-width':2.4})); }
        [0,0.5,1].forEach(f=>{ svg.appendChild(svgText(E,padL+innerW*f,padT+innerH+13,fmt(max*f),f===0?'start':(f===1?'end':'middle'))); });
        hitRect(svg,padL,padT,innerW,innerH,label||'Bullet',[['Value',fmt(value)+(unit?' '+unit:'')],['Target',isNaN(target)?'-':fmt(target)+(unit?' '+unit:'')]]);
        wrap.appendChild(svg);
      }
      let _rzt; window.addEventListener('resize',()=>{ clearTimeout(_rzt); _rzt=setTimeout(()=>renderChartsIn(document.querySelector('.view.active')),160); });
      function buildChart(w){ const t=w.dataset.chart; w.innerHTML='';
        if(t==='combo')combo(w); else if(t==='donut')donut(w); else if(t==='area')area(w); else if(t==='dots')dots(w);
        else if(t==='pbars')pbars(w); else if(t==='otd-class')otdClass(w); else if(t==='otd-hist')otdHist(w); else if(t==='otd-dev')otdDev(w);
        else if(t==='freqhist')freqhist(w); else if(t==='durline')durline(w); else if(t==='hbarcat')hbarcat(w);
        else if(t==='pie')pieGen(w); else if(t==='linechart')linechart(w);
        else if(t==='stackbars')stackbars(w); else if(t==='hstackbars')hstackbars(w);
        else if(t==='barcat')barcat(w); else if(t==='groupbars')groupbars(w); else if(t==='dotplot')dotplot(w);
        else if(t==='scatter')scatter(w); else if(t==='bubble')bubble(w); else if(t==='boxplot')boxplot(w);
        else if(t==='violin')violin(w); else if(t==='density')density(w); else if(t==='histogram')histogram(w);
        else if(t==='heatmap')heatmap(w); else if(t==='funnel')funnel(w); else if(t==='bullet')bullet(w); }
      function renderChartsIn(view){ if(!view)return; view.querySelectorAll('[data-chart]').forEach(buildChart); renderProcessGraphsIn(view); }
      // The Process Explorer graph (.pgraph) is not a data-chart wrap; it's an SVG/HTML
      // board. When Charts-look = WebGL it gets a cinematic 3D version (lazy-loaded,
      // SVG board kept as fallback). Activates whenever the look is 'webgl' (the 3D-scope
      // accent/full knob only gates real dashboard charts), unless the card opts out
      // with a per-card 'flat' override.
      function renderProcessGraphsIn(view){
        const graphs = view.querySelectorAll('.pgraph'); if(!graphs.length) return;
        graphs.forEach(pg=>{
          const card = pg.closest('.pgraph-card') || pg;
          const ov = card.getAttribute('data-chart-look');
          const look = ov || document.documentElement.getAttribute('data-charts3d');
          const want = look==='webgl' && ov!=='flat';
          if(want){
            if(!card.clientWidth || !card.offsetParent) return;   // subtab hidden: nothing to measure, re-renders on activation
            pg.__wantWebgl = true;
            import('./webgl-charts.js').then(m=>{
              if(!pg.__wantWebgl) return;                          // look flipped away before the module loaded
              let ok=false; try{ ok=m.mountWebGLProcessGraph(pg); }catch(e){ console.error('[webgl] process graph mount failed', e); }
              if(!ok && window.__disposeWebGLProcessGraph){ try{ window.__disposeWebGLProcessGraph(pg); }catch(e){} }
            }).catch(e=>{ console.error('[webgl] load failed', e); });
          } else {
            pg.__wantWebgl = false;
            if(window.__disposeWebGLProcessGraph){ try{ window.__disposeWebGLProcessGraph(pg); }catch(e){} }
          }
        });
      }

      /* ---- ID table ---- */
      const ids=[0,1,10,11,12,13,14,15,16,17,18,19,2,20,21,22];
      const tb=document.getElementById('id-tbody');
      ids.forEach(i=>{ const tr=document.createElement('tr'); const td=document.createElement('td'); td.textContent='Customer_SCSCCUT'+i; tr.appendChild(td); tb.appendChild(tr); });

      /* Process Explorer metrics table */
      const pm=[['DE01',48,5.9,'2140.8','103K','102M'],['ZA01',51,5.9,'1745','89K','96.9M'],['AE01',43,5.9,'2069.4','89K','72.9M'],['IE01',49,5.9,'1704.1','83.5K','75.2M'],['QA01',42,5.9,'1945.5','81.7K','60M'],['GB01',46,5.9,'1754.7','80.7K','99.9M'],['BE01',46,5.9,'1654','76.1K','80.2M'],['US01',44,6.1,'1120.3','49.3K','167M'],['US02',45,6,'1006.8','45.3K','146M'],['CA01',44,6,'928.8','40.9K','126M'],['NZ01',34,5.9,'831.6','28.3K','28.8M'],['IN01',36,5.8,'757','27.3K','23.5M'],['HK01',29,5.8,'709.2','20.6K','14.5M']];
      const pmb=document.getElementById('pmetrics-body');
      if(pmb) pm.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML='<td>SourCream '+r[0]+'</td><td class="num">'+r[1]+'</td><td class="num">'+r[2]+'</td><td class="num">'+r[3]+'</td><td class="num">'+r[4]+'</td><td class="num">'+r[5]+'</td>'; pmb.appendChild(tr); });

      /* OTD verify-cases table */
      const cases=[[4,'SCMAT010','2024-01-01','late','Late'],[5,'SCMAT330','2024-01-07','early','Early'],[6,'SCMAT324','2024-01-06','ontime','On Time'],[7,'SCMAT302','2023-12-29','late','Late'],[8,'SCMAT102','2024-01-05','ontime','On Time'],[9,'SCMAT201','2024-01-02','ontime','On Time'],[10,'SCMAT145','2024-01-09','late','Late'],[11,'SCMAT088','2024-01-03','early','Early']];
      const ocb=document.getElementById('otd-cases-body');
      if(ocb) cases.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML='<td>00-2be40edf7ad4</td><td>'+r[0]+'</td><td>'+r[1]+'</td><td>SCCUT24</td><td>'+r[2]+'</td><td>2024-01-01</td><td><span class="otd-pill '+r[3]+'">'+r[4]+'</span></td>'; ocb.appendChild(tr); });

      /* ---- view switching (top tabs synced) ---- */
      // Live editor-tab order, read from the real top tabs in DOM order. This is
      // what makes the Slide transition directional, and it stays correct as tabs
      // open/close/reorder (no stale cached array to refresh).
      function tabOrder(){ return [...document.querySelectorAll('.tabbar .tabs .ia-tab[data-view]')].map(t=>t.dataset.view); }
      let fxAnimating=false;
      let fxFinalize=null;          // teardown of the in-flight slide, callable to complete it early
      let fxTarget=null;            // data-view the in-flight slide is animating TO
      // keep the editor top tabs' active state in sync with the shown view
      function setNavTabActive(v){
        document.querySelectorAll('.tabbar .tabs .ia-tab[data-view]').forEach(t=>t.classList.toggle('active', t.dataset.view===v));
        const a=document.querySelector('.tabbar .tabs .ia-tab[data-view="'+v+'"]');
        if(a&&a.scrollIntoView) a.scrollIntoView({inline:'nearest',block:'nearest'});
      }
      // Strip any slide-transition residue from a view. The slide uses fill:'forwards'
      // Web Animations, which keep applying their final opacity/transform AFTER the inline
      // styles are cleared — so an un-cancelled one can leave a view active but invisible.
      // Cancelling the animations + clearing the inline + .fx-face state restores it fully.
      function clearFxState(view){
        if(!view) return;
        try{ view.getAnimations().forEach(a=>a.cancel()); }catch(e){}
        view.classList.remove('fx-face');
        view.style.left=''; view.style.top=''; view.style.width=''; view.style.height=''; view.style.transform=''; view.style.opacity='';
      }
      function selectView(v){
        const next=document.querySelector('.view[data-view="'+v+'"]');
        // Registered tabs fire selectView twice per click (their own listener + the delegated
        // strip handler). While a slide to v is already running, ignore the duplicate so it
        // plays out; only a switch to a DIFFERENT view completes the current slide early — that
        // keeps rapid switching responsive without piling up or snapping the same animation.
        if(fxAnimating){
          if(v===fxTarget) return;
          if(fxFinalize) fxFinalize();
        }
        const current=document.querySelector('.view.active');
        const slide=root.getAttribute('data-tabfx')==='slide';
        if(!next || next===current || !slide || !current){   // !current: reopening from the empty state has nothing to slide from
          clearFxState(next);        // never show a view that still carries a stale slide effect
          document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active', s.dataset.view===v));
          setNavTabActive(v);
          renderChartsIn(next); runCounters(next);
          return;
        }
        setNavTabActive(v);           // tab + sidebar update immediately
        slideTransition(current, next);
      }

      /* Slide + fade between two views, directional by tab order
         (new tab to the right of the old → content enters from the right, and vice-versa) */
      function slideTransition(oldView, newView){
        fxAnimating=true;
        fxTarget=newView.dataset.view;
        const content=document.getElementById('content');
        const canvas=content.closest('.ctx-canvas')||content;   // the real scroll viewport (#content no longer owns overflow)
        const cs=getComputedStyle(content);
        const padL=parseFloat(cs.paddingLeft)||0, padT=parseFloat(cs.paddingTop)||0,
              padR=parseFloat(cs.paddingRight)||0, padB=parseFloat(cs.paddingBottom)||0;
        // Size faces to the VISIBLE viewport, not #content's full scroll height. Once both views go
        // position:absolute, #content collapses to its padding, so a page-tall face would be clipped
        // to a sliver by .fx-scene's overflow:hidden — only part of the view would show mid-slide.
        const vh=canvas.clientHeight;
        const w=content.clientWidth-padL-padR, h=vh-padT-padB;
        const order=tabOrder(), oi=order.indexOf(oldView.dataset.view), ni=order.indexOf(newView.dataset.view);
        const dir=(oi<0||ni<0)?1:(ni>oi?1:-1);   // +1 = new tab is to the right → enters from the right; -1 = from the left
        const dist=Math.min(64, Math.round(w*0.07));

        canvas.scrollTop=0;                       // reset the real scroll viewport (default layout)
        canvas.classList.remove('is-scrolled');   // new view starts at top → drop the pinned-header shadow
        content.classList.add('fx-scene');
        content.style.height=vh+'px';             // pin the scene to the viewport so the absolute faces keep a full-height box
        [oldView,newView].forEach(f=>{ f.classList.add('fx-face'); f.style.left=padL+'px'; f.style.top=padT+'px'; f.style.width=w+'px'; f.style.height=h+'px'; f.style.transform=''; f.style.opacity=''; });
        newView.classList.add('active');
        renderChartsIn(newView); runCounters(newView);

        const dur=380, ease='cubic-bezier(.33,0,.2,1)';
        const exit=oldView.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-dir*dist}px)`,opacity:0}], {duration:dur, easing:ease, fill:'forwards'});
        const enter=newView.animate([{transform:`translateX(${dir*dist}px)`,opacity:0},{transform:'translateX(0)',opacity:1}], {duration:dur, easing:ease, fill:'forwards'});

        // Single idempotent teardown. CRUCIAL: cancel() both fill:'forwards' animations so they
        // stop applying opacity/transform once the inline styles are cleared — otherwise a view
        // can end up active-but-invisible. Runs on finish, on cancel, via the early-complete hook
        // (fxFinalize), and a safety timer so fxAnimating can never get stuck.
        let done=false, safety=0;
        const finalize=()=>{
          if(done) return; done=true;
          clearTimeout(safety);
          if(fxFinalize===finalize){ fxFinalize=null; fxTarget=null; }
          try{ exit.cancel(); }catch(e){}
          try{ enter.cancel(); }catch(e){}
          [oldView,newView].forEach(f=>{ f.classList.remove('fx-face'); f.style.left=''; f.style.top=''; f.style.width=''; f.style.height=''; f.style.transform=''; f.style.opacity=''; });
          oldView.classList.remove('active');
          newView.classList.add('active');
          content.classList.remove('fx-scene');
          content.style.height='';
          newView.scrollTop=0;                    // flowy: the card owns the scroll — start it at the top
          fxAnimating=false;
        };
        fxFinalize=finalize;
        enter.onfinish=finalize;
        enter.oncancel=finalize;
        safety=setTimeout(finalize, dur+150);     // guarantee teardown even if the WAAPI event never arrives
      }
      // Live editor-tab + L1-leaf view switching is owned by the source↔asset bridge
      // in shell.js (delegated on .tabbar .tabs / .l1-leaf). The legacy .nav-leaf/.tab
      // click handlers were removed as dead code — those elements don't exist in this shell.
      window.IA={selectView:selectView,renderChartsIn:renderChartsIn,runCounters:runCounters};

      /* ===== Data-driven view registry =====
         Single source of truth for the context-area views. Adding a view is additive:
         call registerView({...}) from src/scripts/views.js — no hand-editing of markup,
         selectView, or tab wiring required. */
      const VIEWS = [];
      (function indexExistingViews(){
        document.querySelectorAll('.view[data-view]').forEach(v=>{
          const id=v.dataset.view; if(!id || VIEWS.some(x=>x.id===id)) return;
          const tab=document.querySelector('.tabs .ia-tab[data-view="'+id+'"]');
          VIEWS.push({ id:id, label:tab?tab.textContent.trim():id, source:'markup', el:v });
        });
      })();
      function getViews(){ return VIEWS.slice(); }
      function registerView(def){
        if(!def || !def.id){ console.warn('[views] registerView needs an id'); return null; }
        const id=def.id;
        let viewEl=document.querySelector('.view[data-view="'+id+'"]');
        if(!viewEl){
          viewEl=document.createElement('section');
          viewEl.className='view'; viewEl.setAttribute('data-view',id);
          if(typeof def.html==='string') viewEl.innerHTML=def.html;
          const content=document.getElementById('content'); if(content) content.appendChild(viewEl);
          try{ viewEl.appendChild(buildEditPanel()); }catch(e){}
        }
        // Registered views are NOT opened as boot tabs — only the static tabs in
        // index.html open by default. A registered view is reached from its sidebar leaf
        // below (or any overview card); the click builds the tab on demand via makeTab()
        // in shell.js. The legacy per-tab click listener is unneeded: tab clicks are owned
        // by the delegated handler on .tabbar .tabs in shell.js.
        //
        // sidebar "Views" tree leaf — mirror the built-in .l1-leaf list so a registered
        // view is reachable from the left nav. Pass addLeaf:false for drawer-only views
        // (e.g. incident-details) that should not appear in the nav at all.
        if(def.addLeaf!==false){
          const anchorLeaf=document.querySelector('.l1-children .l1-leaf[data-view]');
          const list=anchorLeaf?anchorLeaf.parentElement:null;
          if(list && !list.querySelector('.l1-leaf[data-view="'+id+'"]')){
            const leaf=document.createElement('button');
            leaf.className='l1-leaf l1-leaf-ic'; leaf.setAttribute('data-view',id);
            leaf.innerHTML=(def.icon||'').trim()+(def.label||id);
            list.appendChild(leaf);
          }
        }
        // specular cursor on any new cards (mirrors the built-in card wiring)
        viewEl.querySelectorAll('[data-card]').forEach(card=>{
          card.addEventListener('mousemove',e=>{ const r=card.getBoundingClientRect(); card.style.setProperty('--mx',(e.clientX-r.left)+'px'); card.style.setProperty('--my',(e.clientY-r.top)+'px'); });
        });
        if(!VIEWS.some(x=>x.id===id)) VIEWS.push({ id:id, label:def.label||id, source:'registered', el:viewEl });
        if(typeof def.render==='function'){ try{ def.render(viewEl); }catch(e){ console.error('[views] render failed for '+id,e); } }
        return viewEl;
      }

      /* Edit mode + Components panel */
      const COMP={'KPIs':['KPI Card','KPI IList'],'Process Visualizations':['BPM Model','Business Rule','Case Explorer','Network Explorer','Process Explorer'],'Tables':['Table'],'Category Charts':['Bar Chart','Grouped Bar Chart','Bubble chart','Pie Chart','Columns & Line Ch…','Columns Chart','Grouped Columns…','Line Chart']};
      function buildEditPanel(){ const a=document.createElement('aside'); a.className='edit-panel';
        let h='<div class="ep-head"><div class="ep-tabs"><button class="ep-tab on">Components</button><button class="ep-tab">Settings</button></div><button class="ep-close" title="Close edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'+icons.close+'</svg></button></div>'+
          '<div class="ep-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icons.search+'</svg>Search components</div>';
        let idx=0; for(const sec in COMP){ h+='<div class="ep-sec">'+sec+'</div><div class="ep-grid">'; COMP[sec].forEach(n=>{ h+='<div class="ep-card" draggable="true" style="--i:'+(idx++)+'"><span class="ep-ic"></span>'+n+'</div>'; }); h+='</div>'; }
        a.innerHTML=h; return a; }
      document.querySelectorAll('.view').forEach(v=>v.appendChild(buildEditPanel()));
      // Edit button lives in the shared header component, so wire it by DELEGATION —
      // every view's edit button works, including views registered after boot. Re-query
      // on toggle so newly added headers reflect the pressed state too.
      function closeFbar(){ document.querySelectorAll('.ocpm2-body[data-fbar="open"]').forEach(b=>b.setAttribute('data-fbar','closed')); document.querySelectorAll('.fbar-btn.on').forEach(b=>b.classList.remove('on')); }
      function setEdit(on){ if(on){ root.setAttribute('data-edit','on'); closeFbar(); } else root.removeAttribute('data-edit'); document.querySelectorAll('.edit-btn').forEach(b=>b.classList.toggle('on',on)); renderChartsIn(document.querySelector('.view.active')); }
      // Filter drawer (.ocpm2-fbar) toggle — the shared header panel button (.fbar-btn) drives it
      // in any view that ships a drawer (.ocpm2-body); a no-op elsewhere. Mutually exclusive with
      // edit mode (both are right-side panels). Re-render so charts reflow to the new content width.
      function setFbar(open){ const v=document.querySelector('.view.active'); if(!v) return; const body=v.querySelector('.ocpm2-body'); if(!body) return; if(open) setEdit(false); body.setAttribute('data-fbar', open?'open':'closed'); v.querySelectorAll('.fbar-btn').forEach(b=>b.classList.toggle('on',open)); renderChartsIn(v); }
      document.addEventListener('click',e=>{
        if(e.target.closest('.edit-btn')){ setEdit(root.getAttribute('data-edit')!=='on'); return; }
        if(e.target.closest('.ep-close')){ setEdit(false); return; }
        if(e.target.closest('.fbar-btn')){ const v=document.querySelector('.view.active'); const body=v&&v.querySelector('.ocpm2-body'); setFbar(!(body&&body.getAttribute('data-fbar')==='open')); return; }
        if(e.target.closest('.ocpm2-fbar-head .x')){ setFbar(false); return; }
        const t=e.target.closest('.ep-tab'); if(t){ t.parentElement.querySelectorAll('.ep-tab').forEach(x=>x.classList.remove('on')); t.classList.add('on'); }
      });
      document.addEventListener('dragstart',e=>{ const c=e.target.closest('.ep-card'); if(c){ c.classList.add('dragging'); e.dataTransfer.setData('text/plain',c.textContent.trim()); } });
      document.addEventListener('dragend',e=>{ const c=e.target.closest('.ep-card'); if(c) c.classList.remove('dragging'); });

      /* L0 glassy flyout */
      function openL0(){}

      /* subtabs — route to the matching content (Operations / Process Explorer / On-Time Delivery / skeleton) */
      const subContents={ ops:document.querySelector('.ops-content'), process:document.querySelector('.process-content'), otd:document.querySelector('.otd-content'), skeleton:document.querySelector('.skel-content') };
      document.querySelectorAll('.subtab[data-sub]').forEach(s=>s.addEventListener('click',()=>{
        document.querySelectorAll('.subtab[data-sub]').forEach(x=>x.classList.remove('on')); s.classList.add('on');
        const sub=s.dataset.sub||'ops';
        for(const k in subContents){ if(subContents[k]) subContents[k].style.display = (k===sub)?'grid':'none'; }
        renderChartsIn(document.querySelector('.view.active'));
        if(subContents[sub]) runCounters(subContents[sub]);
      }));

      /* sticky asset header: flag the scroll container once content slides under the
         pinned header so it gains a separating shadow (CSS: .ctx-canvas.is-scrolled). */
      const ctxCanvasEl=document.querySelector('.ctx-canvas');
      if(ctxCanvasEl){
        /* Default layout scrolls .ctx-canvas; flowy scrolls the inner .view card. Capture phase
           catches both (scroll events don't bubble), so the pinned asset header gains its
           separating shadow regardless of which element actually owns the scroll. */
        ctxCanvasEl.addEventListener('scroll',e=>{ const t=e.target; if(t!==ctxCanvasEl && !(t.classList&&t.classList.contains('view'))) return; ctxCanvasEl.classList.toggle('is-scrolled', (t.scrollTop||0)>2); }, {passive:true, capture:true});
      }

      /* ---- prototype controls ---- */
      const proto=document.getElementById('proto');
      (document.getElementById('fab')||{}).onclick=()=>proto.classList.toggle('open');
      (document.getElementById('rail-settings')||{}).onclick=()=>proto.classList.toggle('open');
      const bDark=document.getElementById('mode-dark'),bLight=document.getElementById('mode-light');
      function setMode(m){ if(m==='light')root.setAttribute('data-mode','light');else root.removeAttribute('data-mode'); const l=m==='light'; bLight.classList.toggle('on',l); bDark.classList.toggle('on',!l); applyHue(); applyBrand(); }
      bDark.onclick=()=>setMode('dark'); bLight.onclick=()=>setMode('light');
      let customHue=null;
      const bColor=document.getElementById('theme-color'),bMono=document.getElementById('theme-mono'),bVivid=document.getElementById('theme-vivid');
      function setTheme(m){ if(m==='mono')root.removeAttribute('data-theme'); else root.setAttribute('data-theme',m);
        // The combo attribute only matters under Vivid — reflect the remembered selection there, clear it otherwise.
        if(m==='vivid') root.setAttribute('data-vivid-palette', vividCombo); else root.removeAttribute('data-vivid-palette');
        bMono.classList.toggle('on',m==='mono'); bColor.classList.toggle('on',m==='color'); bVivid.classList.toggle('on',m==='vivid');
        applyHue(); applyBrand(); }
      bColor.onclick=()=>setTheme('color'); bMono.onclick=()=>setTheme('mono'); bVivid.onclick=()=>setTheme('vivid');
      /* Vivid colour combo: remembered across Mono/Color switches, applied to <html> as
         data-vivid-palette while Vivid is active. Drives both the CSS legend/cstop tokens
         (tokens.css) and the per-chart vividTint() lookup. The swatch buttons are built
         from VIVID_COMBOS so adding a combo only needs data.js. */
      let vividCombo = DEFAULT_VIVID_COMBO;
      const vividComboRow = document.getElementById('vivid-combo-row');
      function comboGradient(cols){ const n=cols.length; return 'linear-gradient(135deg,'+cols.map((c,i)=>`${c} ${(i/n*100).toFixed(2)}%, ${c} ${((i+1)/n*100).toFixed(2)}%`).join(',')+')'; }
      function syncVividComboButtons(){ if(!vividComboRow) return; vividComboRow.querySelectorAll('[data-vivid-combo]').forEach(b=>b.classList.toggle('on', b.dataset.vividCombo===vividCombo)); }
      function setVividCombo(id){
        if(!VIVID_COMBO_MAP[id]) id=DEFAULT_VIVID_COMBO;
        vividCombo=id;
        if(root.getAttribute('data-theme')==='vivid') root.setAttribute('data-vivid-palette', id);
        syncVividComboButtons();
        renderChartsIn(document.querySelector('.view.active'));
      }
      if(vividComboRow){
        vividComboRow.innerHTML = VIVID_COMBOS.map(c=>
          `<button type="button" class="vc-swatch${c.id===DEFAULT_VIVID_COMBO?' on':''}" data-vivid-combo="${c.id}" title="${c.label}" aria-label="${c.label}"><span class="vc-chip" style="background:${comboGradient(c.swatch)}"></span><span class="vc-label">${c.label}</span></button>`
        ).join('');
        vividComboRow.querySelectorAll('[data-vivid-combo]').forEach(b=>b.addEventListener('click',()=>setVividCombo(b.dataset.vividCombo)));
      }
      const hueInput=document.getElementById('theme-hue-input'), hueReset=document.getElementById('theme-hue-reset');
      function rgbToHue(hex){ const n=parseInt(hex.slice(1),16); let r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let h=0; if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if(h<0)h+=360; } return h; }
      // Chart palette for a given surface mode — shared by the hue knob AND per-card Invert.
      function huePalette(h, light){
        const S=52, Ls= light?[20,34,44,56,64,74,82,89]:[98,84,76,60,52,40,30,20], hsl=l=>'hsl('+h+' '+S+'% '+l+'%)';
        return { '--cstop-1a':hsl(Ls[0]),'--cstop-1b':hsl(Ls[1]),'--cstop-2a':hsl(Ls[2]),'--cstop-3a':hsl(Ls[4]),'--cstop-4a':hsl(Ls[6]),
          '--area-top':'hsl('+h+' '+S+'% '+(light?46:62)+'% / '+(light?0.2:0.42)+')','--area-mid':'hsl('+h+' '+S+'% 50% / 0)','--line-2':hsl(light?42:70),
          '--legend-1':hsl(Ls[0]),'--legend-2':hsl(Ls[3]),'--legend-3':hsl(Ls[4]),'--legend-4':hsl(Ls[6]),'--success':hsl(light?42:64) }; }
      const INV_PROPS=['--cstop-1a','--cstop-1b','--cstop-2a','--cstop-3a','--cstop-4a','--area-top','--area-mid','--line-2','--legend-1','--legend-2','--legend-3','--legend-4','--success'];
      // Static Color theme palettes per surface (mirror tokens.css) — used when no custom hue is set.
      const COLOR_DARK={'--cstop-1a':'#a78bfa','--cstop-1b':'#7c3aed','--cstop-2a':'#6ee7b7','--cstop-3a':'#fde68a','--cstop-4a':'#f9a8d4','--area-top':'rgba(139,140,248,0.5)','--area-mid':'rgba(139,140,248,0)','--line-2':'#34d399','--legend-1':'#a78bfa','--legend-2':'#34d399','--legend-3':'#fbbf24','--legend-4':'#f472b6','--success':'#34d399'};
      const COLOR_LIGHT={'--cstop-1a':'#a78bfa','--cstop-1b':'#7c3aed','--cstop-2a':'#6ee7b7','--cstop-3a':'#fde68a','--cstop-4a':'#f9a8d4','--area-top':'rgba(124,58,237,0.42)','--area-mid':'rgba(124,58,237,0)','--line-2':'#7c3aed','--legend-1':'#7c3aed','--legend-2':'#10b981','--legend-3':'#f59e0b','--legend-4':'#ec4899','--success':'#10b981'};
      // The chart palette an INVERTED Color card should adopt: it flips to the opposite surface, so
      // it borrows the OPPOSITE mode's palette (recomputed on the opposite ramp for custom hue).
      // Mono/Vivid return null — their flip is handled in CSS, so there's nothing to set per-card.
      function colorInvPalette(){ if(root.getAttribute('data-theme')!=='color') return null; const light=root.getAttribute('data-mode')==='light';
        return customHue ? huePalette(Math.round(rgbToHue(customHue)), !light) : (light?COLOR_DARK:COLOR_LIGHT); }
      const INV_ACCENT=['--accent','--accent-text'];
      // The accent (primary-button) colour an INVERTED Color card should adopt: recomputed for the
      // OPPOSITE surface so .btn-validate & friends flip like they do in Mono/Vivid (those use CSS).
      // Honors a custom brand colour by re-running the brand legibility logic for the flipped surface.
      function colorInvAccent(){ if(root.getAttribute('data-theme')!=='color') return null;
        const targetLight = root.getAttribute('data-mode')!=='light';   // inverted card = the OPPOSITE of the app mode
        if(brandColor!=null){ const dark=!targetLight, c=(dark && brandLum(brandColor)<0.22)?shadeC(brandColor,0.82):brandColor;
          return { '--accent':c, '--accent-text': brandLum(c)>0.5?'#15161a':'#ffffff' }; }
        return { '--accent':'#8b8cf8', '--accent-text': targetLight?'#ffffff':'#15161a' }; }
      // Re-sync the inline accent on every inverted card (accent-only, no chart re-render) — used when
      // the brand colour changes via its picker, which doesn't go through applyHue.
      function refreshInvertedAccent(){ document.querySelectorAll('.card[data-inverted]').forEach(card=>{
        INV_ACCENT.forEach(p=>card.style.removeProperty(p)); const acc=colorInvAccent();
        if(acc){ for(const k in acc) card.style.setProperty(k,acc[k]); } }); }
      // Apply (on) or clear the inverted-card chart palette + accent as inline vars, then re-render charts.
      function applyCardInvert(card, on){ INV_PROPS.concat(INV_ACCENT).forEach(p=>card.style.removeProperty(p));
        if(on){ const map=colorInvPalette(); if(map){ for(const k in map) card.style.setProperty(k,map[k]); }
          const acc=colorInvAccent(); if(acc){ for(const k in acc) card.style.setProperty(k,acc[k]); } }
        card.querySelectorAll('[data-chart]').forEach(buildChart); }
      function applyHue(){
        const active = root.getAttribute('data-theme')==='color' && customHue;
        if(!active){ INV_PROPS.forEach(p=>root.style.removeProperty(p)); }
        else { const map=huePalette(Math.round(rgbToHue(customHue)), root.getAttribute('data-mode')==='light'); for(const k in map) root.style.setProperty(k,map[k]); }
        document.querySelectorAll('.card[data-inverted]').forEach(c=>applyCardInvert(c,true));   // keep inverted cards synced to the new palette / mode
        renderChartsIn(document.querySelector('.view.active'));
      }
      hueInput.addEventListener('input',()=>{ customHue=hueInput.value; applyHue(); });
      hueReset.addEventListener('click',()=>{ customHue=null; applyHue(); });
      /* brand / accent colour: overrides --accent. null = use the token default (black ink). */
      const brandInput=document.getElementById('brand-color-input'), brandReset=document.getElementById('brand-color-reset');
      let brandColor=null;
      function brandLum(hex){ const {r,g,b}=toRGB(hex); const f=c=>{c/=255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); }
      function applyBrand(){
        // Mono is monochrome — the accent auto-resolves to ink, so a custom brand never applies (its knob is hidden too).
        if(brandColor==null || !root.getAttribute('data-theme')){ root.style.removeProperty('--accent'); root.style.removeProperty('--accent-text'); refreshInvertedAccent(); return; }
        const dark = root.getAttribute('data-mode')!=='light';
        // a near-black brand would disappear on the dark shell — lighten it toward white for legibility.
        const c = (dark && brandLum(brandColor) < 0.22) ? shadeC(brandColor, 0.82) : brandColor;
        root.style.setProperty('--accent', c);
        // legible label colour on accent-filled buttons (white on dark accents, ink on light ones)
        root.style.setProperty('--accent-text', brandLum(c) > 0.5 ? '#15161a' : '#ffffff');
        refreshInvertedAccent();   // inverted Color cards recompute their accent for the flipped surface
      }
      if(brandInput) brandInput.addEventListener('input',()=>{ brandColor=brandInput.value; applyBrand(); });
      if(brandReset) brandReset.addEventListener('click',()=>{ brandColor=null; if(brandInput) brandInput.value='#000000'; applyBrand(); });
      const bSp=document.getElementById('density-spacious'),bCo=document.getElementById('density-compact'),bDn=document.getElementById('density-dense');
      function setDensity(m){ root.setAttribute('data-density',m); const c=CONFIG[m];
        root.style.setProperty('--gap',c.gap+'px'); root.style.setProperty('--pad',c.pad+'px');
        root.style.setProperty('--row-metric',c.rowMetric+'px');
        bSp.classList.toggle('on',m==='spacious'); bCo.classList.toggle('on',m==='compact'); bDn.classList.toggle('on',m==='dense');
        renderChartsIn(document.querySelector('.view.active'));
      }
      var _ap=document.querySelector('.app')||document.getElementById('app'); if(_ap)_ap.style.borderRadius=CONFIG.appRadius+'px';
      bSp.onclick=()=>setDensity('spacious'); bCo.onclick=()=>setDensity('compact'); bDn.onclick=()=>setDensity('dense'); setDensity('spacious');

      const bLayDef=document.getElementById('layout-default'), bLayFlow=document.getElementById('layout-flowy'), bLayFlap=document.getElementById('layout-flap');
      // Flap inherits Flowy's surface treatment + a fused active-tab "flap" — both are "layered" modes.
      function setLayout(m){ if(m==='flowy')root.setAttribute('data-layout','flowy'); else if(m==='flap')root.setAttribute('data-layout','flap'); else root.removeAttribute('data-layout');
        bLayDef.classList.toggle('on',m!=='flowy'&&m!=='flap'); bLayFlow.classList.toggle('on',m==='flowy'); if(bLayFlap) bLayFlap.classList.toggle('on',m==='flap');
        // Flowy/Flap are complete surface treatments — Shell separation conflicts with them, so hide it and reset to tinted
        const layered=(m==='flowy'||m==='flap');
        const sg=document.getElementById('shell-sep-grp');
        if(layered){
          root.removeAttribute('data-shell');
          ['shell-seamless','shell-contrast'].forEach(id=>document.getElementById(id)&&document.getElementById(id).classList.remove('on'));
          const st=document.getElementById('shell-tinted'); if(st) st.classList.add('on');
          if(sg) sg.style.display='none';
        } else if(sg){ sg.style.display=''; }
        renderChartsIn(document.querySelector('.view.active')); }
      bLayDef.onclick=()=>setLayout('default'); bLayFlow.onclick=()=>setLayout('flowy'); if(bLayFlap) bLayFlap.onclick=()=>setLayout('flap');
      const layoutAdv=document.getElementById('layout-adv'), layoutAdvGrp=document.getElementById('layout-adv-grp');
      function setLayoutAdvanced(adv){ adv=!!adv; if(layoutAdvGrp) layoutAdvGrp.hidden=!adv; if(layoutAdv){ layoutAdv.setAttribute('aria-pressed',adv?'true':'false'); layoutAdv.textContent=adv?'Less':'Advanced'; } }
      if(layoutAdv) layoutAdv.addEventListener('click',()=>setLayoutAdvanced(layoutAdv.getAttribute('aria-pressed')!=='true'));

      /* tab transition: default vs slide-fade */
      const bFxFlat=document.getElementById('tabfx-flat'), bFxSlide=document.getElementById('tabfx-slide');
      function setTabFx(m){ if(m==='slide')root.setAttribute('data-tabfx','slide'); else root.removeAttribute('data-tabfx');
        bFxFlat.classList.toggle('on',m!=='slide'); bFxSlide.classList.toggle('on',m==='slide'); }
      bFxFlat.onclick=()=>setTabFx('flat'); bFxSlide.onclick=()=>setTabFx('slide');

      /* charts look: default vs isometric vs glass vs webgl (real three.js 3D) */
      const bC3dDef=document.getElementById('c3d-default'), bC3dIso=document.getElementById('c3d-iso'), bC3dGlass=document.getElementById('c3d-glass'), bC3dWebgl=document.getElementById('c3d-webgl');
      function setCharts3d(m){
        const is3d = m==='iso'||m==='glass'||m==='webgl';
        if(is3d) root.setAttribute('data-charts3d', m);
        else root.removeAttribute('data-charts3d');
        bC3dDef.classList.toggle('on',!is3d);
        bC3dIso.classList.toggle('on',m==='iso'); bC3dGlass.classList.toggle('on',m==='glass');
        if(bC3dWebgl) bC3dWebgl.classList.toggle('on',m==='webgl');
        const ext=document.getElementById('d3-extent-grp'); if(ext) ext.classList.toggle('is-disabled', !is3d);  // extent only relevant when a 3D style is on
        const cf=document.getElementById('chartfill-grp'); if(cf) cf.hidden = is3d;  // Fill style (Classic / Patterns) is a flat-only sub-variant
        renderChartsIn(document.querySelector('.view.active'));
      }
      bC3dDef.onclick=()=>setCharts3d('default'); bC3dIso.onclick=()=>setCharts3d('iso'); bC3dGlass.onclick=()=>setCharts3d('glass');
      if(bC3dWebgl) bC3dWebgl.onclick=()=>setCharts3d('webgl');

      /* ===== Direction knobs (A–G) ===== */
      // mark one focal "hero" chart card per view (used by 3D-scope=Accent and Composition=Hero)
      document.querySelectorAll('.view').forEach(v=>{ const w=v.querySelector('[data-chart]'); const card=w&&w.closest('.card'); if(card) card.setAttribute('data-hero',''); });
      // generic knob wiring: buttons set/remove a root attribute; null = default (no attribute)
      const KNOB_GROUPS = [];
      function wireKnob(attr, buttons, rerender){
        buttons.forEach(b=>{ b.el=document.getElementById(b.id); });
        // declarative, idempotent setter: apply the value directly + sync .on,
        // rather than depending on the side effects of a click toggle.
        function set(val){
          if(val===null||val===undefined) root.removeAttribute(attr); else root.setAttribute(attr,val);
          buttons.forEach(x=>{ if(x.el) x.el.classList.toggle('on', x.val===val); });
          if(rerender) renderChartsIn(document.querySelector('.view.active'));
        }
        buttons.forEach(b=>{ if(!b.el) return; b.el.addEventListener('click',()=>set(b.val)); });
        KNOB_GROUPS.push({ attr:attr, buttons:buttons, set:set });
        return set;
      }
      wireKnob('data-coloruse',   [{id:'color-calm',val:'calm'},{id:'color-strategic',val:'strategic'},{id:'color-expressive',val:'expressive'}], false);
      wireKnob('data-shell',      [{id:'shell-seamless',val:'seamless'},{id:'shell-tinted',val:null},{id:'shell-contrast',val:'contrast'}], false);
      wireKnob('data-pkgpos',     [{id:'pkg-l1',val:null},{id:'pkg-status',val:'status'}], false);
      wireKnob('data-l0reveal',   [{id:'l0-hover',val:null},{id:'l0-click',val:'click'}], false);
      wireKnob('data-3dscope',    [{id:'d3-accent',val:'accent'},{id:'d3-full',val:'full'}], true);
      wireKnob('data-composition',[{id:'comp-uniform',val:'uniform'},{id:'comp-bento',val:null},{id:'comp-hero',val:'hero'}], true);
      /* KPI numerals: weight slider + font-family toggle */
      const kpiW=document.getElementById('kpi-weight'), kwVal=document.getElementById('kw-val');
      if(kpiW) kpiW.addEventListener('input',()=>{ root.style.setProperty('--kpi-weight',kpiW.value); kwVal.textContent=kpiW.value; });
      const KF={ sans:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", mono:"ui-monospace,'SF Mono',Menlo,Consolas,monospace", serif:"'Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif" };
      function setKpiFont(f){ root.style.setProperty('--kpi-font',KF[f]); ['sans','mono','serif'].forEach(x=>{ const b=document.getElementById('kf-'+x); if(b) b.classList.toggle('on',x===f); });
        // Inter OpenType features only render on the Sans (Inter) numerals — disable + explain otherwise.
        const tg=document.getElementById('typo-adv-grp'); if(tg) tg.classList.toggle('feats-na', f!=='sans'); }
      ['sans','mono','serif'].forEach(f=>{ const b=document.getElementById('kf-'+f); if(b) b.onclick=()=>setKpiFont(f); });
      /* Inter OpenType feature toggles (Typography → Advanced). Scoped to the KPI numerals via
         --inter-feats (knobs.css). State is held as an explicit numFeats list in captureState/
         applyState/sig — NOT as .on buttons — so the pills live outside .proto .toggle and are
         never auto-captured or double-applied (mirrors the glass-advanced fields). */
      const INTER_FEATS=['zero','ss01','ss02'];
      const numFeats=new Set();
      function applyNumFeats(list){
        numFeats.clear();
        (Array.isArray(list)?list:[]).forEach(f=>{ if(INTER_FEATS.includes(f)) numFeats.add(f); });
        const css=INTER_FEATS.filter(f=>numFeats.has(f)).map(f=>`"${f}" 1`).join(', ');
        if(css) root.style.setProperty('--inter-feats',css); else root.style.removeProperty('--inter-feats');
        INTER_FEATS.forEach(f=>{ const b=document.getElementById('num-'+f); if(b) b.setAttribute('aria-pressed', numFeats.has(f)?'true':'false'); });
      }
      INTER_FEATS.forEach(f=>{ const b=document.getElementById('num-'+f); if(b) b.addEventListener('click',()=>{ if(numFeats.has(f)) numFeats.delete(f); else numFeats.add(f); applyNumFeats([...numFeats]); }); });
      /* Typography "Advanced" reveal — mirrors gg-adv; the button is NOT inside .proto .toggle,
         so revealing advanced controls is never recorded as theme state. */
      const typoAdv=document.getElementById('typo-adv'), typoAdvGrp=document.getElementById('typo-adv-grp');
      function setTypoAdvanced(adv){ adv=!!adv; if(typoAdvGrp) typoAdvGrp.hidden=!adv; if(typoAdv){ typoAdv.setAttribute('aria-pressed',adv?'true':'false'); typoAdv.textContent=adv?'Less':'Advanced'; } }
      if(typoAdv) typoAdv.addEventListener('click',()=>setTypoAdvanced(typoAdv.getAttribute('aria-pressed')!=='true'));
      wireKnob('data-tabmodel',   [{id:'tabm-default',val:null},{id:'tabm-seg',val:'seg'}], false);
      wireKnob('data-tables',     [{id:'tbl-comfortable',val:null},{id:'tbl-lined',val:'lined'}], false);
      wireKnob('data-surfacefx',  [{id:'surf-flat',val:null},{id:'surf-frost',val:'frost'}], false);
      // Flat sub-variant: Classic (colour only) vs Patterns (colour + monochrome textures / markers / dashes).
      // re-render so the active view's charts pick up / drop the texture overlays.
      wireKnob('data-chartfill',  [{id:'cfill-classic',val:null},{id:'cfill-pattern',val:'pattern'}], true);
      root.setAttribute('data-3dscope','accent');   // default: reserve 3D for the hero card
      root.setAttribute('data-coloruse','strategic'); // default intensity: balanced in-between

      /* tab style: underline vs filled */
      const bTabU=document.getElementById('tabs-underline'), bTabF=document.getElementById('tabs-filled'), bTabC=document.getElementById('tabs-color');
      // Underline now owns the colour picker (the old "Underline color" is merged in):
      // in this mode every interactive tab paints its active indicator with --tab-color.
      function setTabStyle(m){ root.setAttribute('data-tabs',m);
        bTabU.classList.toggle('on',m==='underline'); bTabF.classList.toggle('on',m==='filled'); bTabC.classList.toggle('on',m==='color'); }
      bTabU.onclick=()=>setTabStyle('underline'); bTabF.onclick=()=>setTabStyle('filled'); bTabC.onclick=()=>setTabStyle('color');
      const tabColorInput=document.getElementById('tab-color-input');
      function tabLum(hex){ const n=parseInt(hex.slice(1),16), f=c=>{c/=255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}; return 0.2126*f(n>>16&255)+0.7152*f(n>>8&255)+0.0722*f(n&255); }
      function applyTabColor(){ const c=tabColorInput.value; root.style.setProperty('--tab-color',c); root.style.setProperty('--tab-text', tabLum(c)>0.5?'#15161a':'#ffffff'); }
      tabColorInput.addEventListener('input',applyTabColor); applyTabColor();

      /* ---- declarative knob registry: button id -> idempotent setter (used by presets + dev audit) ---- */
      const BTN_ACTIONS = {
        'mode-light':()=>setMode('light'), 'mode-dark':()=>setMode('dark'),
        'theme-mono':()=>setTheme('mono'), 'theme-color':()=>setTheme('color'), 'theme-vivid':()=>setTheme('vivid'),
        'density-spacious':()=>setDensity('spacious'), 'density-compact':()=>setDensity('compact'), 'density-dense':()=>setDensity('dense'),
        'layout-default':()=>setLayout('default'), 'layout-flowy':()=>setLayout('flowy'), 'layout-flap':()=>setLayout('flap'),
        'tabfx-flat':()=>setTabFx('flat'), 'tabfx-slide':()=>setTabFx('slide'),
        'c3d-default':()=>setCharts3d('default'), 'c3d-iso':()=>setCharts3d('iso'), 'c3d-glass':()=>setCharts3d('glass'), 'c3d-webgl':()=>setCharts3d('webgl'),
        'kf-sans':()=>setKpiFont('sans'), 'kf-mono':()=>setKpiFont('mono'), 'kf-serif':()=>setKpiFont('serif'),
        'tabs-underline':()=>setTabStyle('underline'), 'tabs-filled':()=>setTabStyle('filled'), 'tabs-color':()=>setTabStyle('color')
      };
      KNOB_GROUPS.forEach(g=>g.buttons.forEach(b=>{ BTN_ACTIONS[b.id]=()=>g.set(b.val); }));

      /* ---- dev-only self-check: flag orphan controls (no action) or knob attributes nothing consumes ---- */
      if (import.meta.env.DEV) {
        const runAudit = () => {
          const toggles = Array.from(document.querySelectorAll('.proto .toggle button[id]'));
          const orphanControls = toggles.filter(b => !BTN_ACTIONS[b.id]).map(b => b.id);
          const cssAttrs = ['data-mode','data-theme','data-density','data-layout','data-charts3d','data-coloruse',
            'data-shell','data-pkgpos','data-composition','data-tabmodel','data-tables','data-tabs','data-surfacefx'];
          const jsAttrs = ['data-3dscope','data-tabfx','data-l0reveal','data-chartfill']; // consumed in chartMode() / chart builders / view-switch / shell, not CSS
          let cssText = '';
          for (const s of Array.from(document.styleSheets)) {
            try { for (const r of Array.from(s.cssRules)) cssText += r.cssText; } catch (e) { /* cross-origin sheet */ }
          }
          const orphanAttrs = cssAttrs.filter(a => !cssText.includes('[' + a));
          if (orphanControls.length) console.warn('[knob-audit] controls with no wired action:', orphanControls);
          if (orphanAttrs.length) console.warn('[knob-audit] knob attributes with no consumer:', orphanAttrs);
          if (!orphanControls.length && !orphanAttrs.length)
            console.info('[knob-audit] OK \u2014 ' + toggles.length + ' toggle controls wired; ' +
              cssAttrs.length + ' attrs consumed by CSS, ' + jsAttrs.length + ' by JS.');

          /* ---- glass audit (cleaning loop): every backdrop-filter must flow from the global --glass token,
             so new surfaces can't silently bypass the slider. backdrop-filter:none = reduced-transparency neutralizer. */
          const stray = [];
          let glassSel = '';   // accumulated selectorText of every rule whose blur flows from --glass-blur
          const walk = rules => { for (const r of rules) {
            if (r.style && r.style.backdropFilter) {
              const bf = r.style.backdropFilter;
              if (bf !== 'none' && bf.indexOf('--glass-blur') === -1) stray.push(r.selectorText || '(anonymous rule)');
              else if (bf.indexOf('--glass-blur') !== -1) glassSel += (r.selectorText || '') + ' , ';
            }
            if (r.cssRules) walk(Array.from(r.cssRules));   // recurse into @media / @supports
          } };
          for (const s of Array.from(document.styleSheets)) {
            try { walk(Array.from(s.cssRules)); } catch (e) { /* cross-origin sheet */ }
          }
          const glassTok = getComputedStyle(document.documentElement).getPropertyValue('--glass').trim();
          const hasSlider = !!document.getElementById('r-glass');
          const cap = window.__captureState;
          const capturesGlass = (typeof cap === 'function') && ('r-glass' in ((cap().sliders) || {}));
          if (stray.length) console.warn('[glass-audit] backdrop-filter not driven by var(--glass-blur):', stray);
          if (!hasSlider) console.warn('[glass-audit] #r-glass slider control is missing.');
          if (glassTok === '') console.warn('[glass-audit] --glass token missing from :root.');
          if (!capturesGlass) console.warn('[glass-audit] r-glass is not wired into captureState().sliders (presets will not persist it).');

          /* positive sweep: every surface in the glass manifest must be covered by a
             --glass-driven rule, so none silently ships opaque ("is X glass?" guarantee). */
          const MANIFEST = ['.glass','.gsearch','.modal-card','.sb-pop','.wb-menu','.vh-menu','.ctxmenu','.glass-chrome'];
          const uncovered = MANIFEST.filter(sel => glassSel.indexOf(sel) === -1);
          if (uncovered.length) console.warn('[glass-audit] manifest surfaces with no --glass-driven rule:', uncovered);

          if (!stray.length && hasSlider && glassTok !== '' && capturesGlass && !uncovered.length)
            console.info('[glass-audit] OK \u2014 ' + MANIFEST.length + ' glass-manifest surfaces flow from var(--glass-blur); popovers/menus/modals/search all glassy.');
        };
        if (document.readyState === 'complete') setTimeout(runAudit, 0);
        else window.addEventListener('load', runAudit);
      }

      /* ---- a11y: expose toggle state to assistive tech ----
         Each knob button flips an .on class; mirror that into aria-pressed and
         keep it in sync with one observer instead of touching every setter. */
      (function(){
        const toggleBtns = Array.from(document.querySelectorAll('.proto .toggle button[id]'));
        if(!toggleBtns.length) return;
        const sync = b => b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
        toggleBtns.forEach(sync);
        const mo = new MutationObserver(muts => {
          for(const m of muts){ if(m.attributeName==='class' && m.target.matches('.proto .toggle button[id]')) sync(m.target); }
        });
        toggleBtns.forEach(b => mo.observe(b, { attributes:true, attributeFilter:['class'] }));
      })();

      /* corner-radius sliders */
      const rS=document.getElementById('r-surface'), rI=document.getElementById('r-interactive'),
            rsv=document.getElementById('rs-val'), riv=document.getElementById('ri-val');
      rS.addEventListener('input',()=>{ root.style.setProperty('--r-surface',rS.value+'px'); rsv.textContent=rS.value+'px'; });
      rI.addEventListener('input',()=>{ root.style.setProperty('--r-interactive',rI.value+'px'); riv.textContent=rI.value+'px'; });

      /* global glass: the single slider drives the --glass token family consumed by every overlay
         (.glass) + the shell chrome tier (.glass-chrome). "Advanced" splits it into two axis sliders:
         translucency (--glass-op → fill/opacity) and glassiness (--glass-bl → blur/saturate/diffraction).
         Both axes default to var(--glass) in CSS, so the single slider behaves exactly as before. */
      const gG=document.getElementById('r-glass'), ggv=document.getElementById('gg-val');
      const gOp=document.getElementById('r-glass-op'), gBl=document.getElementById('r-glass-bl');
      const gOpV=document.getElementById('gg-op-val'), gBlV=document.getElementById('gg-bl-val');
      const ggAdv=document.getElementById('gg-adv'), ggGrp=document.getElementById('gg-grp');
      const ggSimple=document.getElementById('gg-simple'), ggSplit=document.getElementById('gg-split');
      const setGlass=v=>{ root.style.setProperty('--glass',(v/100).toFixed(3)); if(ggv) ggv.textContent=Math.round(v)+'%'; };
      const setGlassOp=v=>{ root.style.setProperty('--glass-op',(v/100).toFixed(3)); if(gOpV) gOpV.textContent=Math.round(v)+'%'; };
      const setGlassBl=v=>{ root.style.setProperty('--glass-bl',(v/100).toFixed(3)); if(gBlV) gBlV.textContent=Math.round(v)+'%'; };
      if(gG) gG.addEventListener('input',()=>setGlass(gG.value));
      if(gOp) gOp.addEventListener('input',()=>setGlassOp(gOp.value));
      if(gBl) gBl.addEventListener('input',()=>setGlassBl(gBl.value));
      function setGlassMode(adv){
        if(!ggGrp) return;
        adv=!!adv;
        ggGrp.classList.toggle('gg-advanced',adv);
        if(ggSimple) ggSimple.hidden=adv;
        if(ggSplit) ggSplit.hidden=!adv;
        if(ggAdv){ ggAdv.setAttribute('aria-pressed',adv?'true':'false'); ggAdv.textContent=adv?'Single':'Advanced'; }
        if(adv){
          const base=gG?+gG.value:0;                  // seed both axes from the current single value, then diverge
          if(gOp){ gOp.value=base; setGlassOp(base); }
          if(gBl){ gBl.value=base; setGlassBl(base); }
        } else {
          root.style.removeProperty('--glass-op');     // drop overrides so everything follows --glass again
          root.style.removeProperty('--glass-bl');
        }
      }
      if(ggAdv) ggAdv.addEventListener('click',()=>setGlassMode(ggAdv.getAttribute('aria-pressed')!=='true'));

      /* ---- specular cursor light (no tilt) ---- */
      const cards=Array.from(document.querySelectorAll('[data-card]'));
      cards.forEach(card=>{
        card.addEventListener('mousemove',e=>{ const r=card.getBoundingClientRect(); card.style.setProperty('--mx',(e.clientX-r.left)+'px'); card.style.setProperty('--my',(e.clientY-r.top)+'px'); });
      });
      /* click radiate */
      function dist(a,b){const dx=a.cx-b.cx,dy=a.cy-b.cy;return Math.sqrt(dx*dx+dy*dy);}
      cards.forEach(card=>card.addEventListener('click',ev=>{ if(ev.target.closest('[data-card-ignore]'))return;
        const sr=card.getBoundingClientRect(),src={cx:sr.left+sr.width/2,cy:sr.top+sr.height/2};
        const vis=cards.filter(c=>c.offsetParent!==null);
        const ds=vis.map(c=>{const r=c.getBoundingClientRect();return{el:c,d:dist(src,{cx:r.left+r.width/2,cy:r.top+r.height/2})};});
        const max=Math.max(...ds.map(o=>o.d))||1; vis.forEach(c=>c.classList.remove('is-active')); card.classList.add('is-active');
        ds.forEach(({el,d})=>{ const delay=(d/max)*340,inten=1-(d/max); setTimeout(()=>{ el.style.setProperty('--card-glow',(inten*0.9).toFixed(2)); setTimeout(()=>el.style.setProperty('--card-glow','0'),520); },delay); });
        setTimeout(()=>card.classList.remove('is-active'),1200);
      }));

      /* counters */
      const _reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function fmtCount(el,v){ const dec=parseInt(el.dataset.decimals||'0',10),pre=el.dataset.prefix||'',suf=el.dataset.suffix||'';
        return pre+(dec>0?v.toFixed(dec):Math.round(v).toLocaleString('en-US'))+suf; }
      function anim(el){ const to=parseFloat(el.dataset.to);
        if(_reduceMotion){ el.textContent=fmtCount(el,to); return; }  // honor reduced-motion: show final value, no count-up
        const dur=1100+Math.random()*400,start=performance.now();
        function tick(now){ const t=Math.min(1,(now-start)/dur),e=1-Math.pow(1-t,4),v=to*e; el.textContent=fmtCount(el,v); if(t<1)requestAnimationFrame(tick);} requestAnimationFrame(tick);}
      function runCounters(scope){ scope.querySelectorAll('[data-counter]').forEach((el,i)=>setTimeout(()=>anim(el),_reduceMotion?0:60+i*55)); }
      runCounters(document.querySelector('.view.active'));

      /* ===== REWORK & QUALITY — Charts ===== */
      /* ---- Countries and suppliers: horizontal bars (size-aware) ---- */
      function hbars(wrap){
        const labelW=158, padR=34, padT=4, padB=22, rowH=20;
        const W=Math.max(Math.round(wrap.clientWidth),300), H=RQ_BARS.length*rowH+padT+padB;
        const innerW=W-labelW-padR; const mx=50; const fill='var(--cstop-1a)';
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,width:W,height:H});
        // override global .chart-wrap svg{height:100%} so bars keep natural height and top-align
        svg.style.height=H+'px'; svg.style.width='100%';
        // x gridlines + ticks at 0,20,40
        [0,20,40].forEach(g=>{ const x=labelW+(g/mx)*innerW; svg.appendChild(E('line',{x1:x,x2:x,y1:padT,y2:padT+RQ_BARS.length*rowH,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'}));
          const t=svgText(E,x,H-7,String(g),'middle'); t.setAttribute('class','rq-axis'); svg.appendChild(t); });
        const m3=chartMode(wrap), pat=usePattern(wrap), barCol=cssVar('--cstop-1a', wrap);
        RQ_BARS.forEach((row,i)=>{ const cy=padT+rowH*i+rowH/2, by=cy-rowH*0.62/2;
          const lt=svgText(E,labelW-8,cy+4,row[0],'end'); lt.setAttribute('class','rq-bar-label'); svg.appendChild(lt);
          const bw=Math.max(2,(row[1]/mx)*innerW); const bh=rowH*0.62;
          if(m3){ bar3dH(svg,labelW,by,bw,bh,barCol,m3); }
          else { const r=E('rect',{x:labelW,y:by.toFixed(1),width:bw.toFixed(1),height:bh.toFixed(1),rx:2}); r.style.fill=fill; svg.appendChild(r);
            if(pat) overlayRect(svg, labelW, by, bw, bh, 1, wrap, 2); }
          const vt=svgText(E,labelW+bw+(m3==='iso'?12:5),cy+4,String(row[1]),'start'); vt.setAttribute('class','rq-bar-val'); vt.style.fill=barCol; svg.appendChild(vt);
        });
        RQ_BARS.forEach((row,i)=>{ hitRect(svg,0,padT+rowH*i,W,rowH,row[0],[['Count',String(row[1])]]); });
        wrap.appendChild(svg);
      }

      /* ---- Chart components: pie. With a sibling .donut-legend (the "Chart
         components" card) it renders a side legend like the donut charts; without
         one it falls back to in-SVG leader-line labels. ---- */
      function pie(wrap){
        // fixed viewBox — never read clientHeight (avoids measure→write→measure growth loop)
        const W=440, H=460, cx=W/2, cy=H*0.5;
        const row=wrap.closest && wrap.closest('.donut-row');
        const legendEl=row?row.querySelector('.donut-legend'):null;
        // a side legend frees the full square for the disc; leader-line mode keeps the slimmer disc + room for labels
        const r=Math.min(W,H)*(legendEl?0.42:0.30);
        // distinct categorical colours per slice from the theme chart ramp (differs across Mono/Color/Vivid + hue)
        const sliceColors=['var(--cstop-1a)','var(--cstop-2a)','var(--cstop-3a)','var(--cstop-4a)'];
        const m3=chartMode(wrap);
        const yS = m3==='iso'?0.62 : m3==='glass'?0.92 : 1;    // vertical squash for the tilt
        const depth = m3==='iso'?22 : m3==='glass'?8 : 0;       // extrusion thickness
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'xMidYMid meet'});
        svg.style.width='100%'; svg.style.height='100%';
        const colOf=(s,i)=> s.other ? 'rgba(140,142,150,0.85)' : resolveColor(sliceColors[i]||'var(--cstop-1a)', wrap);
        function slicePath(a0,a1,yy){ const large=(a1-a0)>Math.PI?1:0;
          const x0=cx+r*Math.cos(a0), y0=yy+r*Math.sin(a0)*yS, x1=cx+r*Math.cos(a1), y1=yy+r*Math.sin(a1)*yS;
          return `M${cx},${yy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${(r*yS).toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`; }
        const arcs=[]; let ang=-Math.PI/2; RQ_PIE.forEach(s=>{ const a0=ang,a1=ang+(s.p/100)*Math.PI*2; ang=a1; arcs.push([a0,a1]); });
        const body = m3 ? E('g',{filter:`url(#${ensureSoftShadow(svg, m3==='iso'?8:4, m3==='iso'?7:5, 0.32)})`}) : svg;
        // 1) extruded side wall (darker copies stacked behind the top face)
        if(m3){ for(let k=depth;k>=1;k--){ RQ_PIE.forEach((s,i)=>{ const p=E('path',{d:slicePath(arcs[i][0],arcs[i][1],cy+k)}); p.style.fill=shadeC(colOf(s,i),m3==='glass'?(-0.22-(k/depth)*0.20):-0.34); if(m3==='glass')p.style.opacity='0.94'; body.appendChild(p); }); } }
        // 2) top faces
        RQ_PIE.forEach((s,i)=>{ const p=E('path',{d:slicePath(arcs[i][0],arcs[i][1],cy)}), col=colOf(s,i);
          if(m3==='glass'){ p.style.fill=`url(#${glassTopGrad(svg,col)})`; p.style.fillOpacity='0.98'; p.style.stroke=rgbaC(shadeC(col,0.48),0.55); p.style.strokeWidth='1.4'; }
          else { p.style.fill=col; p.style.stroke='var(--bg-1)'; p.style.strokeWidth='1.2'; }
          body.appendChild(p); });
        // Pattern sub-variant: texture each slice over its colour (flat only).
        if(usePattern(wrap)){ RQ_PIE.forEach((s,i)=>overlayPath(svg, slicePath(arcs[i][0],arcs[i][1],cy), i, wrap)); }
        // glassy sheen across the top face — soft radial gloss (top-lit), fades to transparent
        if(m3){
          let pdefs=svgDefs(svg), glass=m3==='glass';
          const sid='pieSheen'+(nextGid()); const rg=E('radialGradient',{id:sid,cx:glass?'46%':'50%',cy:glass?'24%':'30%',r:glass?'74%':'68%'});
          rg.appendChild(E('stop',{offset:'0%','stop-color':glass?'rgba(255,255,255,0.50)':'rgba(255,255,255,0.30)'}));
          rg.appendChild(E('stop',{offset:'55%','stop-color':glass?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.07)'}));
          rg.appendChild(E('stop',{offset:'100%','stop-color':'rgba(255,255,255,0)'}));
          pdefs.appendChild(rg);
          const sg=E('ellipse',{cx:cx,cy:cy,rx:r*0.99,ry:r*yS*0.99,fill:`url(#${sid})`,'pointer-events':'none'}); body.appendChild(sg);
        }
        if(m3) svg.appendChild(body);
        // 3) labels — a side legend (donut style) when the card provides one, else in-SVG leader lines
        if(legendEl){
          const pat=usePattern(wrap);
          legendEl.innerHTML = RQ_PIE.map((s,i)=>{
            const c = s.other ? 'rgba(140,142,150,0.85)' : (sliceColors[i]||'var(--cstop-1a)'), pc=pat?patternSwatchClass(i):'';
            return '<div class="li"><span class="sw'+pc+'" style="background-color:'+c+'"></span>'+s.p.toFixed(2)+'% '+s.l+'</div>';
          }).join('');
        } else {
          // leader lines + labels — small slices fan out on the right so they never overlap
          const smallN=RQ_PIE.filter(s=>!s.other).length; let si=0;
          RQ_PIE.forEach((s,i)=>{ const mid=(arcs[i][0]+arcs[i][1])/2;
            const lx=cx+r*Math.cos(mid), ly=cy+r*Math.sin(mid)*yS;
            let ox,oy,right;
            if(!s.other){ right=true; ox=cx+r+30; oy=cy - (smallN-1)*9 + si*18; si++; }
            else { ox=cx+(r+16)*Math.cos(mid); oy=cy+(r+16)*Math.sin(mid)*yS + (m3?depth:0); right=ox>=cx; }
            const ex=right?ox+8:ox-8;
            const lead=E('polyline',{points:`${lx.toFixed(1)},${ly.toFixed(1)} ${ox.toFixed(1)},${oy.toFixed(1)} ${ex.toFixed(1)},${oy.toFixed(1)}`}); lead.setAttribute('class','rq-pie-lead'); svg.appendChild(lead);
            const lab=svgText(E,right?ex+3:ex-3,oy+3,(s.p.toFixed(2))+'% '+s.l,right?'start':'end'); lab.setAttribute('class','rq-pie-label'); svg.appendChild(lab);
          });
        }
        RQ_PIE.forEach((s,i)=>{ hitPath(svg,slicePath(arcs[i][0],arcs[i][1],cy),s.l,[['Share',s.p.toFixed(2)+'%']]); });
        wrap.appendChild(svg);
      }

      /* register the new chart types into the dispatcher (world map is static inline SVG) */
      const _buildChart = buildChart;
      // The 2D/SVG render path (flat / iso / glass) — shared by the normal route AND
      // by the WebGL fallback when a type isn't supported or a 3D build fails.
      function renderSVGChart(w){
        const t=w.dataset.chart;
        if(t==='hbars'){ w.innerHTML=''; hbars(w); return; }
        // self-describing pies (data-segs) use the generic data-driven renderer;
        // the leader-line "Chart components" pie (no segs) uses pie().
        if(t==='pie'){ w.innerHTML=''; (w.dataset.segs ? pieGen : pie)(w); return; }
        _buildChart(w);
      }
      // Chart types the WebGL renderer can draw in real 3D. (Routing is decided
      // synchronously here; the three.js engine itself is lazy-imported on first use.)
      const WEBGL_TYPES = new Set(['combo','donut','pie','area','dots','pbars','otd-class','otd-hist','otd-dev',
        'freqhist','durline','hbarcat','linechart','stackbars','hstackbars','barcat','groupbars','dotplot',
        'scatter','bubble','boxplot','violin','density','histogram','heatmap','funnel','bullet','hbars']);
      buildChart = function(w){
        try {
          // WebGL look: hand the wrap to the three.js renderer (lazy-loaded). It owns
          // the wrap's content (a <canvas>); on unsupported type / build failure we fall
          // back to the SVG path so a chart is always shown.
          if(chartMode(w)==='webgl' && WEBGL_TYPES.has(w.dataset.chart)){
            w.__wantWebgl = true;
            import('./webgl-charts.js').then(m=>{
              if(!w.__wantWebgl) return;                 // mode flipped away before the module loaded
              let ok=false; try{ ok=m.mountWebGLChart(w); }catch(e){ console.error('[webgl] mount failed', e); }
              if(!ok) renderSVGChart(w);
            }).catch(e=>{ console.error('[webgl] load failed', e); renderSVGChart(w); });
            return;
          }
          // Non-WebGL look: tear down any live 3D instance + its canvas, then render SVG.
          w.__wantWebgl = false;
          if(window.__disposeWebGLChart){ try{ window.__disposeWebGLChart(w); }catch(e){} }
          renderSVGChart(w);
        } catch(err){
          // Isolate failures: one broken chart must never abort a whole view render.
          console.error('[chart] failed to render "'+(w&&w.dataset?w.dataset.chart:'?')+'"', err);
          try { w.innerHTML='<div class="chart-error" role="img" aria-label="Chart failed to render">chart unavailable</div>'; } catch(_e){}
        }
      };

      /* ---- Case table + case details ---- */
      const rqBody=document.getElementById('rq-cases-body');
      function renderActivities(caseId){
        const list=document.getElementById('rq-act-list'); if(!list)return;
        const acts=RQ_ACTIVITIES[caseId]||RQ_ACTIVITIES['999999'];
        document.getElementById('rq-detail-title').textContent='Case details: '+caseId;
        document.getElementById('rq-act-count').textContent=acts.length;
        list.innerHTML='';
        acts.forEach(a=>{ const row=document.createElement('div'); row.className='rq-act';
          row.innerHTML='<span class="dot"></span><div class="body"><div class="name">'+a[0]+'</div><div class="ts">'+a[1]+'</div></div><span class="badge">'+a[2]+'</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
          list.appendChild(row); });
      }
      if(rqBody){
        RQ_CASES.forEach((c,i)=>{ const tr=document.createElement('tr'); if(i===0)tr.classList.add('sel'); tr.dataset.case=c[0];
          tr.innerHTML='<td><span class="rq-caseid">'+c[0]+'</span></td><td class="num">'+c[1]+'</td><td class="num">'+c[2]+'</td><td>'+c[3]+'</td>';
          tr.addEventListener('click',()=>{ rqBody.querySelectorAll('tr').forEach(x=>x.classList.remove('sel')); tr.classList.add('sel'); renderActivities(c[0]); });
          rqBody.appendChild(tr); });
        renderActivities('999999');
      }

      /* ---- Rework sub-tab switching (scoped to this view) ---- */
      document.querySelectorAll('.subtab[data-rqsub]').forEach(s=>s.addEventListener('click',()=>{
        const view=s.closest('.view'); if(!view)return;
        view.querySelectorAll('.subtab[data-rqsub]').forEach(x=>x.classList.remove('on')); s.classList.add('on');
        const sub=s.dataset.rqsub;   // each sub-tab maps to its own .rq-content panel
        view.querySelectorAll('.rq-content').forEach(c=>{ c.style.display = (c.dataset.rqcontent===sub)?'grid':'none'; });
        renderChartsIn(view);        // the now-visible panel has real size, so charts measure correctly
      }));

      /* ---- World map zoom (+/−), centred on the highlighted Atlantic region ---- */
      (function(){
        const svg=document.getElementById('rq-worldmap'); if(!svg) return;
        const base={w:2754,h:1398}; const focus={x:1300,y:560}; // Europe/Atlantic cluster
        let scale=1; const MIN=1, MAX=8;
        function apply(){
          const w=base.w/scale, h=base.h/scale;
          let x=focus.x-w/2, y=focus.y-h/2;
          x=Math.max(0,Math.min(base.w-w,x)); y=Math.max(0,Math.min(base.h-h,y));
          svg.setAttribute('viewBox', x.toFixed(1)+' '+y.toFixed(1)+' '+w.toFixed(1)+' '+h.toFixed(1));
        }
        const btns=document.querySelectorAll('.rq-mapwrap .rq-map-zoom button');
        if(btns[0]) btns[0].addEventListener('click',()=>{ scale=Math.min(MAX, +(scale*1.4).toFixed(3)); apply(); });
        if(btns[1]) btns[1].addEventListener('click',()=>{ scale=Math.max(MIN, +(scale/1.4).toFixed(3)); apply(); });
      })();

      // Render charts if Rework and Quality is the active view on load
      if (document.querySelector('.view[data-view="rework-quality"].active')) {
        renderChartsIn(document.querySelector('.view[data-view="rework-quality"]'));
      }

      /* ===== Right-click context menu: per-chart 3D style + per-card invert ===== */
      (function(){
        const menu=document.createElement('div'); menu.className='ctxmenu glass'; document.body.appendChild(menu);
        const CK='<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">'+icons.check+'</svg>';
        function hide(){ menu.classList.remove('open'); }
        function header(t){ const h=document.createElement('div'); h.className='ctx-h'; h.textContent=t; return h; }
        function sep(){ const s=document.createElement('div'); s.className='ctx-sep'; return s; }
        function item(label, on, onClick, icon){ const d=document.createElement('div'); d.className='ctx-i'+(on?' on':'');
          d.innerHTML=(icon||'')+'<span>'+label+'</span>'+CK; d.addEventListener('click',()=>{ onClick(); hide(); }); return d; }

        document.addEventListener('contextmenu', e=>{
          if(!e.target.closest('#content')) return;            // only inside the working view
          const wrap=e.target.closest('[data-chart]');
          const card=e.target.closest('.card');
          if(!wrap && !card) return;
          e.preventDefault();
          menu.innerHTML='';
          if(wrap){
            menu.appendChild(header('Chart style'));
            const cur=wrap.getAttribute('data-chart-look')||'global';
            [['global','Follow global'],['flat','Flat (2D)'],['iso','Isometric'],['glass','Glass'],['webgl','WebGL 3D']].forEach(([val,lab])=>{
              menu.appendChild(item(lab, cur===val, ()=>{
                if(val==='global') wrap.removeAttribute('data-chart-look'); else wrap.setAttribute('data-chart-look',val);
                buildChart(wrap);
              }));
            });
          }
          if(card){
            if(wrap) menu.appendChild(sep());
            const inv=card.hasAttribute('data-inverted');
            menu.appendChild(item(inv?'Reset surface':'Invert surface', inv, ()=>{
              if(inv) card.removeAttribute('data-inverted'); else card.setAttribute('data-inverted','');
              // flip the card's chart palette to the opposite surface (Color / custom hue) + re-render so
              // flat AND baked colours (3D bars, pie slices, donut, value labels) follow the flipped surface
              applyCardInvert(card, !inv);
            }));
          }
          menu.classList.add('open');
          const mw=menu.offsetWidth, mh=menu.offsetHeight;
          let x=e.clientX, y=e.clientY;
          if(x+mw>window.innerWidth-8) x=window.innerWidth-mw-8;
          if(y+mh>window.innerHeight-8) y=window.innerHeight-mh-8;
          menu.style.left=Math.max(8,x)+'px'; menu.style.top=Math.max(8,y)+'px';
        });
        document.addEventListener('click', e=>{ if(!e.target.closest('.ctxmenu')) hide(); });
        document.addEventListener('keydown', e=>{ if(e.key==='Escape') hide(); });
        document.addEventListener('scroll', hide, true);
      })();

      /* ===== Presets (saved locally) =====
         Solid CRUD without window.prompt/confirm (those silently fail in sandboxed
         frames — that was the "can't rename" bug). Naming/deletion happen through
         inline rows inside the panel; a snapshot-based "Modified" flag tells you
         when live settings have drifted from the applied preset. */
      (function(){
        const LS='sb-presets-v1';
        const sel=document.getElementById('preset-select'); if(!sel) return;
        const $=id=>document.getElementById(id);
        const proto=document.getElementById('proto');
        const track=$('preset-track'), dots=$('preset-dots');
        const prevBtn=$('preset-prev'), nextBtn=$('preset-next');
        let customCard=null;
        const editRow=$('preset-edit'), nameInp=$('preset-name');
        const confirmRow=$('preset-confirm'), confirmText=$('preset-confirm-text');
        const DEFAULTS=[
          { id:'preset-enterprise-calm', name:'Enterprise Calm',
            state:{ buttons:['mode-light','theme-mono','color-calm','shell-contrast','layout-default','pkg-l1','l0-hover','tabm-seg','tabs-filled','tabfx-flat','comp-bento','density-spacious','kf-sans','c3d-default','d3-accent'],
              sliders:{'r-surface':'10','r-interactive':'8','kpi-weight':'300','r-glass':'0'}, hue:'#6366f1', hueActive:false, tab:'#6366f1' } },
          { id:'preset-bento-bold', name:'Bento Bold',
            state:{ buttons:['mode-light','theme-mono','color-strategic','shell-tinted','layout-default','pkg-l1','l0-hover','tabm-seg','tabs-filled','tabfx-flat','comp-hero','density-spacious','kf-sans','c3d-iso','d3-accent'],
              sliders:{'r-surface':'14','r-interactive':'9','kpi-weight':'200','r-glass':'0'}, hue:'#6366f1', hueActive:false, tab:'#6366f1' } },
          { id:'preset-exec-dark', name:'Executive Dark',
            state:{ buttons:['mode-dark','theme-color','color-strategic','shell-contrast','layout-default','pkg-l1','l0-hover','tabm-seg','tabs-filled','tabfx-slide','comp-bento','density-compact','kf-sans','c3d-glass','d3-accent'],
              sliders:{'r-surface':'12','r-interactive':'9','kpi-weight':'300','r-glass':'0'}, hue:'#6366f1', hueActive:false, tab:'#6366f1' } }
        ];
        function load(){ try{ const r=JSON.parse(localStorage.getItem(LS)); if(r&&Array.isArray(r.presets)) return r; }catch(e){} return { presets: JSON.parse(JSON.stringify(DEFAULTS)), selected:'' }; }
        function persist(){ try{ localStorage.setItem(LS, JSON.stringify(store)); }catch(e){} }
        function uid(){ return 'p'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6).toString(36); }
        let store=load(), lastSnap='', editMode=null;   // editMode: 'new' | 'rename' | null

        function captureState(){
          return {
            buttons:[...document.querySelectorAll('.proto .toggle button.on')].map(b=>b.id).filter(Boolean),
            sliders:{ 'r-surface':$('r-surface').value, 'r-interactive':$('r-interactive').value, 'kpi-weight':$('kpi-weight').value, 'r-glass':($('r-glass')||{}).value },
            hue: hueInput.value, hueActive: customHue!=null, tab: tabColorInput.value,
            brand: brandInput? brandInput.value : '#000000', brandActive: brandColor!=null,
            vividPalette: vividCombo,
            glassAdv: ggAdv ? ggAdv.getAttribute('aria-pressed')==='true' : false,
            glassOp: gOp ? gOp.value : null, glassBl: gBl ? gBl.value : null,
            numFeats: [...numFeats]
          };
        }
        if (import.meta.env.DEV) window.__captureState = captureState;   // dev-only hook for the glass self-check
        // Declarative + idempotent: apply the stored state directly (root attributes / CSS vars
        // + .on sync) through the knob registry, instead of replaying .click() in array order.
        function applyState(st){
          if(!st) return;
          const btns=st.buttons||[];
          // Restore the remembered Vivid combo before the buttons run, so setTheme('vivid')
          // reflects the right palette. Older presets without the field fall back to the default.
          vividCombo = (st.vividPalette && VIVID_COMBO_MAP[st.vividPalette]) ? st.vividPalette : DEFAULT_VIVID_COMBO;
          syncVividComboButtons();
          if(!btns.some(id=>id==='pkg-l1'||id==='pkg-status')) BTN_ACTIONS['pkg-l1']();
          if(!btns.some(id=>id==='l0-hover'||id==='l0-click')) BTN_ACTIONS['l0-hover']();
          btns.forEach(id=>{ const fn=BTN_ACTIONS[id]; if(fn) fn(); });
          if(st.sliders) for(const id in st.sliders){ const el=$(id); if(el){ el.value=st.sliders[id]; el.dispatchEvent(new Event('input')); } }
          // glass split: honor the stored advanced state (else force simple so any live axis overrides clear)
          if(typeof setGlassMode==='function'){
            setGlassMode(!!st.glassAdv);
            if(st.glassAdv){ if(gOp&&st.glassOp!=null){ gOp.value=st.glassOp; setGlassOp(+st.glassOp); } if(gBl&&st.glassBl!=null){ gBl.value=st.glassBl; setGlassBl(+st.glassBl); } }
          }
          // Explicit set (clears features absent from the preset, so switching presets never leaves stale ones on).
          applyNumFeats(st.numFeats||[]);
          if(tabColorInput && st.tab){ tabColorInput.value=st.tab; applyTabColor(); }
          if(hueInput){
            if(st.hue) hueInput.value=st.hue;
            customHue = st.hueActive ? hueInput.value : null;
            applyHue();
          }
          if(brandInput){
            if(st.brand) brandInput.value=st.brand;
            brandColor = st.brandActive ? brandInput.value : null;
            applyBrand();
          }
        }
        // canonical signature for drift detection (order-independent; fixed slider key set)
        function sig(st){ st=st||{}; const sl=st.sliders||{}; const keys=['r-surface','r-interactive','kpi-weight','r-glass'];
          // Vivid combo only affects rendering under Vivid; collapse the default so older
          // presets (no vividPalette) don't read as "Modified" once the live state defaults to it.
          const isVivid=(st.buttons||[]).includes('theme-vivid');
          const vivid = isVivid ? ((st.vividPalette && st.vividPalette!==DEFAULT_VIVID_COMBO) ? st.vividPalette : null) : null;
          return JSON.stringify({ b:[...(st.buttons||[])].sort(), s:keys.map(k=>String(sl[k]==null?'':sl[k])),
            hue:st.hueActive?st.hue:null, tab:st.tab||null, brand:st.brandActive?st.brand:null, vivid,
            ga:!!st.glassAdv, go:st.glassAdv?String(st.glassOp):null, gb:st.glassAdv?String(st.glassBl):null,
            nf:[...(st.numFeats||[])].sort() }); }
        function snap(){ lastSnap=sig(captureState()); }   // record the baseline right after apply/save

        /* ---- shared theme library (auto-sync to the cloud themes bin) ----
           Built-in DEFAULTS stay local; user-made presets sync, tagged by owner.
           Reading other people's presets needs no name; pushing mine prompts once. */
        const DEFAULT_IDS = new Set(DEFAULTS.map(d=>d.id));
        const isMine = (p, me)=> me ? p.owner===me : (!DEFAULT_IDS.has(p.id) && !p.owner);
        const myPresets = (me)=> store.presets.filter(p=>!DEFAULT_IDS.has(p.id) && isMine(p,me));
        /* Explicit-deletion tombstones: ids the user deleted on this device. The cloud sync
           is now an upsert-by-id (never drops on absence), so a preset is only removed from
           the shared bin when its id is sent here. Persisted so a failed/offline push retries. */
        const DELETED_KEY='sb-presets-deleted-v1';
        const deleted = new Set((()=>{ try{ const r=JSON.parse(localStorage.getItem(DELETED_KEY)); return Array.isArray(r)?r:[]; }catch(e){ return []; } })());
        function persistDeleted(){ try{ localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted])); }catch(e){} }
        let pushT;
        function pushMine(){
          clearTimeout(pushT);
          pushT=setTimeout(async ()=>{
            try{
              const me = await ensureAuthor();
              if(!me) return;
              let changed=false;
              store.presets.forEach(p=>{ if(!DEFAULT_IDS.has(p.id) && !p.owner){ p.owner=me; changed=true; } });
              if(changed) persist();
              const tombstones=[...deleted];
              const ok = await syncThemes(me, myPresets(me), tombstones);
              if(ok && tombstones.length){ tombstones.forEach(id=>deleted.delete(id)); persistDeleted(); }   // applied on the server — stop tracking
            }catch(e){ console.error('[themes] sync failed', e); }
          }, 250);
        }
        function mergeShared(shared){
          const arr = Array.isArray(shared)?shared:[];
          if(!arr.length) return;
          const me = getAuthor();
          // Union by id: keep my local defaults + my own presets (local edits win for mine),
          // then pull in EVERY shared preset by id I haven't already kept or explicitly deleted.
          // This retrieves both other people's themes AND my own themes created on another
          // device/browser (same name) — the latter were dropped by the old owner-exclusion
          // filter, which is why new themes were invisible outside a fresh (incognito) profile.
          const byId = new Map();
          store.presets.forEach(p => { if(p && p.id && (DEFAULT_IDS.has(p.id) || isMine(p, me))) byId.set(p.id, p); });
          arr.forEach(p => { if(p && p.id && !DEFAULT_IDS.has(p.id) && !deleted.has(p.id) && !byId.has(p.id)) byId.set(p.id, p); });
          store.presets = [...byId.values()];
          persist(); render(); refresh();
        }

        /* Manual "Sync" button: push my presets (only when I'm already named, so a read-only
           refresh never forces a name prompt) and pull the shared library now, with button
           feedback. The boot pull + auto pushMine still run; this is the on-demand path. */
        let syncing=false;
        async function syncNow(){
          if(syncing) return;
          const btn=$('preset-sync');
          syncing=true;
          if(btn){ btn.disabled=true; btn.classList.add('is-syncing'); btn.textContent='Syncing\u2026'; }
          let ok=true;
          try{
            const me = getAuthor();
            if(me){
              let changed=false;
              store.presets.forEach(p=>{ if(!DEFAULT_IDS.has(p.id) && !p.owner){ p.owner=me; changed=true; } });
              if(changed) persist();
              const tombstones=[...deleted];
              const pushed = await syncThemes(me, myPresets(me), tombstones);
              if(pushed && tombstones.length){ tombstones.forEach(id=>deleted.delete(id)); persistDeleted(); }
              ok = ok && pushed;
            }
            mergeShared(await getThemes());   // pull + re-render
          }catch(e){ console.error('[themes] manual sync failed', e); ok=false; }
          finally{
            syncing=false;
            if(btn){
              btn.disabled=false; btn.classList.remove('is-syncing');
              btn.textContent = ok ? 'Synced' : 'Retry sync';
              setTimeout(()=>{ const b=$('preset-sync'); if(b && !syncing) b.textContent='Sync'; }, 1500);
            }
          }
        }

        // ---- Export dropdown (Figma package · screenshots), sharing one busy state ----
        let exporting=false;
        function exportPreset(){
          const p=current();
          return {
            id: p ? p.id : 'custom',
            name: p ? p.name : 'Custom',
            // Export what is currently visible. If the selected preset is modified,
            // the package should match the live screen, not the stale saved copy.
            state: captureState()
          };
        }
        function setExportLabel(txt){ const t=$('preset-export-btn'); const l=t && t.querySelector('.pe-label'); if(l) l.textContent=txt; }
        function setExportBusy(on){
          const t=$('preset-export-btn');
          if(!t) return;
          t.disabled=on; t.classList.toggle('is-exporting', on);
          if(on) t.setAttribute('aria-expanded','false');
        }
        function closeExportMenu(){
          const m=$('preset-export-menu'); if(m) m.hidden=true;
          const t=$('preset-export-btn'); if(t) t.setAttribute('aria-expanded','false');
        }
        function toggleExportMenu(){
          const m=$('preset-export-menu'), t=$('preset-export-btn');
          if(!m||!t) return;
          if(m.hidden){ m.hidden=false; t.setAttribute('aria-expanded','true'); }
          else closeExportMenu();
        }
        async function runExport(invoke){
          if(exporting) return;
          closeExportMenu();
          exporting=true;
          setExportBusy(true);
          setExportLabel('Preparing...');
          try{
            const mod=await import('./figma-export.js');
            await invoke(mod, (e)=>{
              if(!e) return;
              if(e.type==='screen-captured') setExportLabel('Exporting '+e.index+'/'+e.total);
              else if(e.type==='packaged') setExportLabel('Downloaded');
              else if(e.type==='failed') setExportLabel('Export failed');
            });
            setExportLabel('Downloaded');
          }catch(e){
            console.error('[export] failed', e);
            setExportLabel('Export failed');
          }finally{
            exporting=false;
            setTimeout(()=>{ if(!exporting){ setExportBusy(false); setExportLabel('Export'); } }, 1600);
          }
        }
        function exportFigmaNow(){ return runExport((mod,onProgress)=> mod.exportPresetToFigma(exportPreset(), { includeSubtabs:true, onProgress })); }
        function exportScreenshotsNow(){ return runExport((mod,onProgress)=> mod.exportAllScreenshots(exportPreset(), { scale:1, onProgress })); }

        /* One-time upload of presets that were created before cloud sync existed.
           Runs after the shared pull so we never clobber the server. */
        const MIGRATED_KEY='sb-presets-synced-v1';
        async function migrateOnce(){
          try{
            if(!isCloudEnabled()) return;                 // nothing to push to; retry once configured
            if(localStorage.getItem(MIGRATED_KEY)) return;
            const localUser = store.presets.filter(p=>!DEFAULT_IDS.has(p.id));
            if(!localUser.length){ localStorage.setItem(MIGRATED_KEY,'1'); return; } // nothing to migrate
            const me = await ensureAuthor();              // prompt once for a name (skipped if already set)
            if(!me) return;                               // dismissed — try again next boot
            let changed=false;
            store.presets.forEach(p=>{ if(!DEFAULT_IDS.has(p.id) && !p.owner){ p.owner=me; changed=true; } });
            if(changed) persist();
            const ok = await syncThemes(me, myPresets(me));
            if(ok){ localStorage.setItem(MIGRATED_KEY,'1'); render();
              console.info('[themes] uploaded', myPresets(me).length, 'preset(s) to the shared library'); }
          }catch(e){ console.error('[themes] migration failed', e); }
        }

        /* ---- carousel: tiny DOM builder + an abstract mini-mock "preview" generated
           straight from a preset's saved knobs (mode, palette, corners, composition,
           density, glass) so each card visualises what the theme actually does. ---- */
        const elc=(tag,cls,style)=>{ const n=document.createElement(tag); if(cls) n.className=cls; if(style) n.setAttribute('style',style); return n; };
        const hasBtn=(st,id)=>!!(st&&st.buttons&&st.buttons.includes(id));
        const pickBtn=(st,ids,fb)=>{ for(const id of ids) if(hasBtn(st,id)) return id; return fb; };
        const clampn=(v,a,b)=>Math.max(a,Math.min(b,v));

        function previewSpec(st){
          st=st||{};
          const dark=hasBtn(st,'mode-dark');
          const palette=pickBtn(st,['theme-vivid','theme-color','theme-mono'],'theme-mono');
          const comp=pickBtn(st,['comp-hero','comp-uniform','comp-bento'],'comp-bento');
          const density=pickBtn(st,['density-dense','density-compact','density-spacious'],'density-spacious');
          const intensity=pickBtn(st,['color-expressive','color-calm','color-strategic'],'color-strategic');
          const tabs=pickBtn(st,['tabs-color','tabs-underline','tabs-filled'],'tabs-filled');
          const sl=st.sliders||{};
          const rSurf=clampn(+sl['r-surface']||0,0,28), rInt=clampn(+sl['r-interactive']||0,0,20);
          const glass=clampn(+sl['r-glass']||0,0,100);
          // resolve the saved Vivid combo (default = Prism) for both the swatch colours and the meta label
          const vividId=(st.vividPalette && VIVID_COMBO_MAP[st.vividPalette]) ? st.vividPalette : DEFAULT_VIVID_COMBO;
          const vividSwatch=VIVID_COMBO_MAP[vividId].swatch;
          let accent;
          if(palette==='theme-mono') accent=dark?'#cbd0d9':'#3b3e45';
          else if(palette==='theme-color') accent=(st.brandActive&&st.brand)?st.brand:((st.hueActive&&st.hue)?st.hue:'#6366f1');
          else accent=vividSwatch[0];
          return { dark, palette, comp, density, tabs, accent, vividId, vividSwatch,
            tileR:Math.round(rSurf*0.32), tabR:Math.round(rInt*0.35), glass,
            gap: density==='density-dense'?2:density==='density-compact'?3:5,
            pad: density==='density-dense'?5:density==='density-compact'?7:9,
            shadow: intensity==='color-expressive'?0.5:intensity==='color-calm'?0.12:0.28 };
        }
        function themePreview(st){
          const s=previewSpec(st);
          const bg=s.dark?'#0e0f13':'#eef0f4', tile=s.dark?'#1b1e25':'#ffffff';
          const line=s.dark?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.08)', faint=s.dark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.13)';
          const wrap=elc('div','tp-preview',`background:${bg};border-radius:${s.tileR+3}px;padding:${s.pad}px;gap:${s.gap}px`);
          // mini tab row — active tab carries the picked tab style (filled · underline · color)
          const bar=elc('div','tp-pv-bar',`gap:${s.gap}px`);
          for(let i=0;i<3;i++){ const on=i===0; let cs=`border-radius:${s.tabR}px`;
            if(on){ if(s.tabs==='tabs-color') cs+=`;background:${s.accent}`;
              else if(s.tabs==='tabs-underline') cs+=`;background:transparent;box-shadow:inset 0 -2px 0 ${s.accent}`;
              else cs+=`;background:${faint}`; }
            else cs+=`;background:${line}`;
            bar.appendChild(elc('span','tp-pv-tab'+(on?' on':''),cs)); }
          wrap.appendChild(bar);
          // mini card grid — arrangement = composition, gap = density, corners = surface radius
          const grid=elc('div','tp-pv-grid tp-'+s.comp,`gap:${s.gap}px`);
          const tShadow=`box-shadow:0 ${1+Math.round(s.shadow*4)}px ${2+Math.round(s.shadow*8)}px -2px rgba(0,0,0,${((s.dark?0.5:0.18)+s.shadow*0.2).toFixed(2)})`;
          const mkTile=(extra,accentFill,ci)=>{
            const fill=accentFill?(s.palette==='theme-vivid'?s.vividSwatch[ci%s.vividSwatch.length]:s.accent):tile;
            const t=elc('span','tp-pv-tile'+(extra?' '+extra:''),`background:${fill};border-radius:${s.tileR}px;${tShadow}`);
            if(!accentFill){ const dc=s.palette==='theme-vivid'?s.vividSwatch[(ci+1)%s.vividSwatch.length]:s.accent; t.appendChild(elc('i','tp-pv-dot',`background:${dc}`)); }
            return t;
          };
          if(s.comp==='comp-hero'){ grid.appendChild(mkTile('big',true,0)); grid.appendChild(mkTile('',false,1)); grid.appendChild(mkTile('',false,2)); }
          else if(s.comp==='comp-uniform'){ grid.appendChild(mkTile('',true,0)); grid.appendChild(mkTile('',false,1)); grid.appendChild(mkTile('',false,2)); grid.appendChild(mkTile('',false,3)); }
          else { grid.appendChild(mkTile('wide',true,0)); grid.appendChild(mkTile('',false,1)); grid.appendChild(mkTile('',false,2)); }
          wrap.appendChild(grid);
          if(s.glass>0) wrap.appendChild(elc('div','tp-pv-frost',`opacity:${(0.10+s.glass/100*0.45).toFixed(2)}`));
          return wrap;
        }
        function metaLine(st){
          const s=previewSpec(st);
          let pal={'theme-mono':'Mono','theme-color':'Color','theme-vivid':'Vivid'}[s.palette];
          // surface the chosen Vivid combo (skip the default so existing presets read unchanged)
          if(s.palette==='theme-vivid' && s.vividId!==DEFAULT_VIVID_COMBO) pal+=' '+VIVID_COMBO_MAP[s.vividId].label;
          const comp={'comp-bento':'Bento','comp-uniform':'Uniform','comp-hero':'Hero'}[s.comp];
          const dens={'density-spacious':'Spacious','density-compact':'Compact','density-dense':'Dense'}[s.density];
          return [s.dark?'Dark':'Light',pal,comp,dens].join(' \u00B7 ');
        }
        function buildCard(id,name,state,owner,me){
          const card=elc('button','tp-card'); card.type='button'; card.dataset.id=id||''; card.setAttribute('role','tab');
          const head=elc('div','tp-card-head');
          const nm=elc('span','tp-name'); nm.textContent=name; head.appendChild(nm);
          const badge=elc('span','tp-badge'); badge.textContent='Modified'; badge.hidden=true; badge.title='Current settings differ from this preset'; head.appendChild(badge);
          card.appendChild(head); card.appendChild(themePreview(state));
          const meta=elc('div','tp-meta'); meta.textContent=metaLine(state); card.appendChild(meta);
          if(owner&&owner!==me){ const ow=elc('div','tp-owner'); ow.textContent='by '+owner; card.appendChild(ow); }
          return card;
        }
        const cardEls=()=> track?[...track.children]:[];
        function centerCard(card,smooth){ if(!track||!card) return; const left=card.offsetLeft-(track.clientWidth-card.clientWidth)/2; track.scrollTo({left:Math.max(0,left),behavior:smooth?'smooth':'auto'}); }
        function markActive(){ const cur=store.selected||''; let act=null;
          cardEls().forEach(c=>{ const on=(c.dataset.id||'')===cur; c.classList.toggle('is-active',on); c.setAttribute('aria-selected',on?'true':'false'); if(on) act=c; });
          if(dots){ const idx=cardEls().indexOf(act); [...dots.children].forEach((d,i)=>d.classList.toggle('on',i===idx)); }
          return act; }
        function orderIds(){ return ['',...store.presets.map(p=>p.id)]; }
        // every nav action also selects → applies, matching "switch between themes"
        function selectId(id,smooth){ sel.value=id||''; sel.dispatchEvent(new Event('change')); const act=markActive(); if(act) centerCard(act,smooth!==false); }
        function step(dir){ const ids=orderIds(); let i=ids.indexOf(store.selected||''); i=clampn(i+dir,0,ids.length-1); selectId(ids[i],true); }

        function render(){
          // hidden <select> stays the selection source of truth (unchanged data path)
          sel.innerHTML='';
          const me=getAuthor();
          const ph=document.createElement('option'); ph.value=''; ph.textContent='\u2014 Custom \u2014'; sel.appendChild(ph);
          store.presets.forEach(p=>{ const o=document.createElement('option'); o.value=p.id;
            o.textContent = (p.owner && p.owner!==me) ? (p.name+' \u00B7 '+p.owner) : p.name; sel.appendChild(o); });
          sel.value=store.selected||'';
          // visible carousel: a leading live "Custom" card, then one card per preset
          if(track){
            track.innerHTML='';
            customCard=buildCard('','Custom',captureState(),null,me); customCard.classList.add('tp-custom');
            track.appendChild(customCard);
            store.presets.forEach(p=> track.appendChild(buildCard(p.id,p.name,p.state,p.owner,me)) );
            if(dots){ dots.innerHTML=''; const n=track.children.length;
              for(let i=0;i<n;i++){ const d=elc('button','tp-dot'); d.type='button'; d.dataset.idx=i; d.setAttribute('aria-label','Theme '+(i+1)); dots.appendChild(d); } }
            const act=markActive(); if(act) centerCard(act,false);
          }
        }
        function current(){ return store.presets.find(p=>p.id===sel.value); }

        function refresh(){
          const p=current();
          const dirty = !!p && sig(captureState())!==lastSnap;
          // keep the live "Custom" card mirroring the current (unsaved) settings
          if(customCard){ const cs=captureState(); const old=customCard.querySelector('.tp-preview'); if(old) old.replaceWith(themePreview(cs));
            const m=customCard.querySelector('.tp-meta'); if(m) m.textContent=metaLine(cs); }
          // "Modified" badge now lives inside the active preset card
          cardEls().forEach(c=>{ const b=c.querySelector('.tp-badge'); if(b) b.hidden = !((c.dataset.id||'')===(store.selected||'') && dirty); });
          const mine = !!p && isMine(p, getAuthor());           // only your own (or unowned-local) presets are editable
          $('preset-save').disabled   = p ? !dirty : false;   // Custom → enabled (acts as "New"); preset → only when drifted
          $('preset-rename').disabled = !mine;                 // nothing to rename on "— Custom —" or another user's theme
          $('preset-del').disabled    = !mine;                 // only your own themes can be deleted from the shared library
          markActive();
        }

        // ---- carousel navigation (click card · chevrons · dots) ----
        if(track) track.addEventListener('click', e=>{ const c=e.target.closest('.tp-card'); if(!c) return; selectId(c.dataset.id,true); });
        if(dots) dots.addEventListener('click', e=>{ const d=e.target.closest('.tp-dot'); if(!d) return; const ids=orderIds(); selectId(ids[clampn(+d.dataset.idx,0,ids.length-1)],true); });
        if(prevBtn) prevBtn.onclick=()=>step(-1);
        if(nextBtn) nextBtn.onclick=()=>step(1);
        // center the active card the first time the panel opens (its width is 0 while hidden)
        if(proto){ const mo=new MutationObserver(()=>{ if(proto.classList.contains('open')){ const act=markActive(); if(act) centerCard(act,false); } });
          mo.observe(proto,{attributes:true,attributeFilter:['class']}); }

        function closeRows(){ editMode=null; if(editRow) editRow.hidden=true; if(confirmRow) confirmRow.hidden=true; }
        function openEdit(mode, value){
          if(confirmRow) confirmRow.hidden=true;
          editMode=mode; nameInp.value=value||''; editRow.hidden=false;
          nameInp.focus(); nameInp.select();
        }
        function commitEdit(){
          const name=(nameInp.value||'').trim(); if(!name){ nameInp.focus(); return; }
          if(editMode==='new'){ const p={id:uid(),name,state:captureState()}; store.presets.push(p); store.selected=p.id; persist(); render(); snap(); pushMine(); }
          else if(editMode==='rename'){ const p=current(); if(p){ p.name=name; persist(); render(); pushMine(); } }
          closeRows(); refresh();
        }
        function openConfirm(text){ if(editRow) editRow.hidden=true; confirmText.textContent=text; confirmRow.hidden=false; }

        // ---- consume: applying a preset is the primary "use" path ----
        sel.addEventListener('change', ()=>{ store.selected=sel.value; persist(); closeRows(); const p=current(); if(p) applyState(p.state); snap(); refresh(); });
        // ---- create / update ----
        $('preset-save').onclick=()=>{ const p=current(); if(p){ p.state=captureState(); persist(); snap(); refresh(); pushMine(); } else { openEdit('new','My preset'); } };
        $('preset-new').onclick=()=>{ openEdit('new','My preset'); };
        $('preset-dup').onclick=()=>{ const p=current(); if(!p){ openEdit('new','My preset'); return; } const c={id:uid(),name:p.name+' copy',state:JSON.parse(JSON.stringify(p.state))}; delete c.owner; store.presets.push(c); store.selected=c.id; persist(); render(); snap(); refresh(); pushMine(); };
        $('preset-rename').onclick=()=>{ const p=current(); if(!p) return; openEdit('rename',p.name); };
        { const exBtn=$('preset-export-btn'); if(exBtn) exBtn.onclick=(e)=>{ e.stopPropagation(); if(exporting) return; toggleExportMenu(); }; }
        { const exMenu=$('preset-export-menu'); if(exMenu) exMenu.addEventListener('click', e=>e.stopPropagation()); }
        { const figmaBtn=$('preset-export-figma'); if(figmaBtn) figmaBtn.onclick=(e)=>{ e.stopPropagation(); closeExportMenu(); exportFigmaNow(); }; }
        { const shotsBtn=$('preset-export-shots'); if(shotsBtn) shotsBtn.onclick=(e)=>{ e.stopPropagation(); closeExportMenu(); exportScreenshotsNow(); }; }
        document.addEventListener('click', closeExportMenu);
        document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeExportMenu(); });
        $('preset-del').onclick=()=>{ const p=current(); if(!p) return; openConfirm('Delete \u201C'+p.name+'\u201D?'); };
        { const syncBtn=$('preset-sync'); if(syncBtn) syncBtn.onclick=syncNow; }
        // ---- inline editor / confirm wiring ----
        $('preset-ok').onclick=commitEdit;
        $('preset-cancel').onclick=closeRows;
        nameInp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); commitEdit(); } else if(e.key==='Escape'){ e.preventDefault(); closeRows(); } });
        $('preset-confirm-ok').onclick=()=>{ const p=current(); if(p){ if(isMine(p, getAuthor())){ deleted.add(p.id); persistDeleted(); } store.presets=store.presets.filter(x=>x.id!==p.id); store.selected=''; persist(); render(); pushMine(); } closeRows(); snap(); refresh(); };
        $('preset-confirm-cancel').onclick=closeRows;

        // ---- live drift tracking: any knob change re-evaluates the Modified flag ----
        if(proto){ let t; const ping=()=>{ clearTimeout(t); t=setTimeout(refresh,0); };
          proto.addEventListener('input', e=>{ if(!e.target.closest('.preset-grp')) ping(); });
          proto.addEventListener('click', e=>{ if(!e.target.closest('.preset-grp')) ping(); }); }
        window.addEventListener('ia:theme-presets-changed', e=>{
          const d=e.detail||{};
          if(d.preset&&d.preset.id){
            const ix=store.presets.findIndex(p=>p.id===d.preset.id);
            if(ix>=0) store.presets[ix]=d.preset; else store.presets.push(d.preset);
            store.selected=d.selected||d.preset.id;
          } else {
            store=load();
            if(d.selected) store.selected=d.selected;
          }
          persist(); render();
          const p=current(); if(p) applyState(p.state);
          snap(); refresh(); pushMine();
        });

        render();
        if(store.selected){ const p=current(); if(p) applyState(p.state); }   // restore last-applied preset
        snap(); refresh();

        // Snapshot bridge for the feedback feature (built on top, never touches the proto).
        window.IA = window.IA || {};
        window.IA.captureState = captureState;
        window.IA.applyState = applyState;
        /* Per-card "Invert surface" state (right-click → Invert). Indexed by .card position
           within each view so capture and replay stay self-consistent and split-view safe. */
        window.IA.captureInverted = function(){
          const out=[];
          document.querySelectorAll('.view[data-view]').forEach(view=>{
            const id=view.getAttribute('data-view');
            [...view.querySelectorAll('.card')].forEach((c,i)=>{ if(c.hasAttribute('data-inverted')) out.push({ view:id, idx:i }); });
          });
          return out;
        };
        window.IA.applyInverted = function(list){
          document.querySelectorAll('.card[data-inverted]').forEach(c=>{ c.removeAttribute('data-inverted'); applyCardInvert(c,false); });
          (list||[]).forEach(item=>{
            if(!item || !item.view) return;
            const esc=(window.CSS && CSS.escape) ? CSS.escape(item.view) : item.view;
            const v=document.querySelector('.view[data-view="'+esc+'"]'); if(!v) return;
            const card=v.querySelectorAll('.card')[item.idx];
            if(card){ card.setAttribute('data-inverted',''); applyCardInvert(card,true); }
          });
        };
        // Pull the shared theme library in (read-only path — no name prompt on boot),
        // then upload any locally-made presets that predate cloud sync (one-time).
        getThemes().then(mergeShared).catch(()=>{}).finally(migrateOnce);
      })();

export { selectView, renderChartsIn, runCounters, registerView, getViews };

