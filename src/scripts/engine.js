import { PALETTE, rng, series, N, RQ_BARS, RQ_PIE, RQ_CASES, RQ_ACTIVITIES } from '../data/data.js';
import { E, svgText, chartMode, cssVar, toRGB, shadeC, rgbaC, resolveColor, ensureSoftShadow, sheenGrad, sphere, bar3dV, bar3dH, nextGid } from './effects.js';
import { icons, hydrateIcons } from './icons.js';
import { buildAssetHeader } from './components/asset-header.js';
import { getThemes, syncOwnerThemes, getAuthor, ensureAuthor } from './cloud-store.js';

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

      function vividTint(key){ return document.documentElement.getAttribute('data-theme')==='vivid' ? (PALETTE[key]||'#6366f1') : null; }
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

      /* ---- COMBO chart (bars + line, dual axis) — size-aware ---- */
      function combo(wrap){
        const key = wrap.dataset.key, rightMax = parseFloat(wrap.dataset.rightmax)||40, leftLabel = wrap.dataset.leftlabel||'';
        const W=Math.max(Math.round(wrap.clientWidth),220), H=Math.max(Math.round(wrap.clientHeight),110);
        const padL=30, padR=34, padT=8, padB=18, innerW=W-padL-padR, innerH=H-padT-padB;
        let bars, line;
        if(key==='otd'){ bars=series(11,N,18,26,0.4); line=series(21,N,30,8,0.1); }
        else if(key==='touch'){ bars=series(31,N,30,24,0.6); line=series(41,N,2.6,1.2,0.04); }
        else if(key==='blocks'){ bars=series(51,N,28,22,0.5); line=series(61,N,10,3,0.05); }
        else { bars=series(71,N,50,30,0.5); line=series(81,N,60,18,0.4); }
        const barMax=Math.max(...bars)*1.15, lineMax=rightMax;
        const tint=vividTint(key);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        const defs=E('defs',{}); const g=E('linearGradient',{id:'cb_'+key,x1:0,x2:0,y1:0,y2:1});
        if(tint){ g.appendChild(E('stop',{offset:'0%','stop-color':shade(tint,0.22)})); g.appendChild(E('stop',{offset:'100%','stop-color':shade(tint,-0.12)})); }
        else { g.appendChild(E('stop',{offset:'0%','class':'stop-1a'})); g.appendChild(E('stop',{offset:'100%','class':'stop-1b'})); }
        defs.appendChild(g); svg.appendChild(defs);
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*f; svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.18)','stroke-dasharray':'2 4'})); });
        const step=innerW/N, bw=step*0.6;
        const m3=chartMode(wrap), barCol = tint || cssVar('--cstop-1a', wrap);
        bars.forEach((v,i)=>{ const h=Math.max(2,(v/barMax)*innerH); const x=padL+step*i+(step-bw)/2; const y=padT+innerH-h;
          if(m3){ bar3dV(svg,x,y,bw,h,barCol,m3); }
          else svg.appendChild(E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1.5,fill:`url(#cb_${key})`})); });
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

      /* ---- DONUT (flat / iso-tilted cylinder / glass) ---- */
      function donut(wrap){
        const segs=[{p:48.39,c:'var(--legend-4)',l:'UK test'},{p:41.94,c:'var(--legend-3)',l:'Others (13)'},{p:3.23,c:'var(--legend-2)',l:'BE test'},{p:3.23,c:'var(--legend-2)',l:'AU test'},{p:3.23,c:'var(--legend-1)',l:'AE test'}];
        const W=120,H=120,r=42,cx=60,cy=60,sw=22, C=2*Math.PI*r;
        const m3=chartMode(wrap);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`});
        function ring(target, cyy, shadeAmt, op){ let off=0; segs.forEach(s=>{ const len=C*s.p/100;
          const cir=E('circle',{cx:cx,cy:cyy,r:r,fill:'none','stroke-width':sw,'stroke-dasharray':`${len.toFixed(2)} ${(C-len).toFixed(2)}`,'stroke-dashoffset':(-off).toFixed(2),transform:`rotate(-90 ${cx} ${cyy})`});
          cir.style.stroke = shadeAmt!=null ? shadeC(resolveColor(s.c, wrap),shadeAmt) : s.c; if(op!=null) cir.style.strokeOpacity=op; target.appendChild(cir); off+=len; }); }
        if(m3){
          const tilt = m3==='iso'?0.58:0.86, depth = m3==='iso'?9:3;
          const fid=ensureSoftShadow(svg, m3==='iso'?5:3, m3==='iso'?5:4, 0.30);
          const g=E('g',{transform:`translate(${cx} ${cy}) scale(1 ${tilt}) translate(${-cx} ${-cy})`,filter:`url(#${fid})`});
          for(let k=depth;k>=1;k--) ring(g, cy+k, -0.30);     // extruded side wall (darker, behind)
          ring(g, cy, m3==='glass'?-0.02:0.04, m3==='glass'?0.9:1);  // top face
          // glassy top sheen
          const sheen=E('circle',{cx:cx,cy:cy,r:r,fill:'none','stroke-width':sw*0.46,'stroke-dasharray':`${(C*0.5).toFixed(1)} ${C}`,transform:`rotate(-150 ${cx} ${cy})`,stroke:'rgba(255,255,255,0.22)'}); g.appendChild(sheen);
          svg.appendChild(g);
        } else {
          ring(svg, cy, null);
        }
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
        const defs=E('defs',{}); const g=E('linearGradient',{id:'ar_'+key,x1:0,x2:0,y1:0,y2:1});
        if(tint){ g.appendChild(E('stop',{offset:'0%','stop-color':tint,'stop-opacity':'0.5'})); g.appendChild(E('stop',{offset:'100%','stop-color':tint,'stop-opacity':'0'})); }
        else { g.appendChild(E('stop',{offset:'0%','class':'stop-area-top'})); g.appendChild(E('stop',{offset:'100%','class':'stop-area-mid'})); }
        defs.appendChild(g); svg.appendChild(defs);
        [0,0.5,1].forEach(f=>{ const y=padT+innerH*f; svg.appendChild(E('line',{x1:padL,x2:padL+innerW,y1:y,y2:y,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); });
        const step=innerW/(pts.length-1); let d='';
        pts.forEach((v,i)=>{ const x=padL+step*i, y=padT+innerH-(v/mx)*innerH; d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); });
        const m3=chartMode(wrap), glassCol = tint || cssVar('--cstop-1a', wrap);
        if(m3){
          // frosted fill in the chart primary colour
          const fg=svg.querySelector('#ar_'+key); if(fg){ fg.innerHTML=''; fg.appendChild(E('stop',{offset:'0%','stop-color':rgbaC(glassCol,0.55)})); fg.appendChild(E('stop',{offset:'100%','stop-color':rgbaC(glassCol,0.05)})); }
          svg.appendChild(E('path',{d:d+`L${padL+innerW},${padT+innerH}L${padL},${padT+innerH}Z`,fill:`url(#ar_${key})`}));
          if(m3==='iso'){ // depth lip under the line
            const lip=E('path',{d:d,fill:'none','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 4)'}); lip.style.stroke=shadeC(glassCol,-0.3); lip.style.opacity='0.85'; svg.appendChild(lip);
          }
          const lp=E('path',{d:d,fill:'none','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'}); lp.style.stroke=glassCol; svg.appendChild(lp);
          const gloss=E('path',{d:d,fill:'none','stroke-width':1,'stroke-linecap':'round','transform':'translate(0 -1.4)'}); gloss.style.stroke='rgba(255,255,255,0.55)'; svg.appendChild(gloss);
          pts.forEach((v,i)=>{ if(i%3)return; const x=padL+step*i,y=padT+innerH-(v/mx)*innerH; sphere(svg,+x.toFixed(1),+y.toFixed(1),3,glassCol); });
        } else {
          svg.appendChild(E('path',{d:d+`L${padL+innerW},${padT+innerH}L${padL},${padT+innerH}Z`,fill:`url(#ar_${key})`}));
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
        const m3p=chartMode(wrap), colp=cssVar('--cstop-1a', wrap);
        vals.forEach((v,i)=>{ const h=(v/mx)*innerH, x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          if(m3p){ bar3dV(svg,x,y,bw,Math.max(1,h),colp,m3p); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:Math.max(1,h).toFixed(1),rx:1.5}); r.style.fill='var(--cstop-1a)'; svg.appendChild(r); } });
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
        const m3c=chartMode(wrap);
        rows.forEach((r,i)=>{ const cy=padT+rh*i+rh/2, bw=(r.v/mx)*innerW, bh=Math.min(40,rh*0.5);
          if(m3c){ bar3dH(svg,padL,(cy-bh/2),Math.max(2,bw),bh,resolveColor(r.c, wrap),m3c); }
          else { const rect=E('rect',{x:padL,y:(cy-bh/2).toFixed(1),width:Math.max(2,bw).toFixed(1),height:bh.toFixed(1),rx:3}); rect.style.fill=r.c; svg.appendChild(rect); }
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
        const m3h=chartMode(wrap);
        bars.forEach((b,i)=>{ const h=(b[1]/mx)*innerH, x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          const cvar = b[2]==='l'?'--cstop-1a':b[2]==='d'?'--cstop-1b':'--cstop-3a';
          if(m3h){ bar3dV(svg,x,y,bw,Math.max(1,h),cssVar(cvar, wrap),m3h); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:Math.max(1,h).toFixed(1),rx:1}); r.style.fill='var('+cvar+')'; svg.appendChild(r); }
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
        const m3d=chartMode(wrap);
        if(m3d){ bar3dV(svg,bx,by,bw,bh,cssVar('--cstop-1a', wrap),m3d); }
        else { const rect=E('rect',{x:bx.toFixed(1),y:by.toFixed(1),width:bw.toFixed(1),height:bh.toFixed(1),rx:3}); rect.style.fill='var(--cstop-1a)'; rect.style.opacity='0.9'; svg.appendChild(rect); }
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
        const m3=chartMode(wrap), col=cssVar('--cstop-1a', wrap);
        vals.forEach((v,i)=>{ const last=i===count-1, h=Math.max(1,(v/mx)*innerH), x=padL+step*i+(step-bw)/2, y=padT+innerH-h;
          if(m3 && !last){ bar3dV(svg,x,y,bw,h,col,m3); }
          else { const r=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:h.toFixed(1),rx:1.5}); r.style.fill = last?'rgba(140,142,150,0.6)':'var(--cstop-1a)'; svg.appendChild(r); } });
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
        const col=cssVar('--cstop-1a', wrap);
        const lp=E('path',{d:d,fill:'none','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}); lp.style.stroke=col; svg.appendChild(lp);
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
        const W=Math.max(Math.round(wrap.clientWidth),180), H=Math.max(Math.round(wrap.clientHeight),80);
        const padL=labelW, padR=10, padT=4, padB=15, innerW=W-padL-padR, innerH=H-padT-padB;
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none'});
        (ticks.length?ticks:[0,xmax]).forEach(t=>{ const x=padL+(t/xmax)*innerW; svg.appendChild(E('line',{x1:x.toFixed(1),x2:x.toFixed(1),y1:padT,y2:padT+innerH,stroke:'rgba(128,128,128,0.16)','stroke-dasharray':'2 4'})); svg.appendChild(svgText(E,x,padT+innerH+11,fmt(t),'middle')); });
        const n=Math.max(1,bars.length), rh=innerH/n, bh=Math.min(13,rh*0.6);
        const m3=chartMode(wrap), col=cssVar('--cstop-1a', wrap);
        const cap=Math.max(4,Math.floor(labelW/5.2));
        bars.forEach((b,i)=>{ const cy=padT+rh*i+rh/2, w=Math.max(1,(Math.min(b[1],xmax)/xmax)*innerW), y=cy-bh/2;
          const shown=(String(b[0]).length>cap)?String(b[0]).slice(0,cap-1)+'\u2026':String(b[0]);
          const lt=svgText(E,padL-6,cy+3,shown,'end'); lt.setAttribute('font-size','9'); svg.appendChild(lt);
          const cvar=b[2]||'--cstop-1a';            // optional per-bar colour (a CSS var name)
          if(m3){ bar3dH(svg,padL,y,w,bh,cssVar(cvar, wrap),m3); }
          else { const r=E('rect',{x:padL.toFixed(1),y:y.toFixed(1),width:w.toFixed(1),height:bh.toFixed(1),rx:1.5}); r.style.fill='var('+cvar+')'; svg.appendChild(r); }
          hitRect(svg,padL,padT+rh*i,innerW,rh,String(b[0]),[['Value',fmt(b[1])+(unit?' '+unit:'')]]); });
        wrap.appendChild(svg);
      }
      /* ---- Generic pie (self-describing via data-segs='[["Label",pct,"--colorVar"],…]') ---- */
      function pieGen(wrap){
        let segs=[]; try{ segs=JSON.parse(wrap.dataset.segs||'[]'); }catch(e){ segs=[]; }
        const W=Math.max(Math.round(wrap.clientWidth),140), H=Math.max(Math.round(wrap.clientHeight),120);
        const cx=W*0.40, cy=H/2, r=Math.min(W*0.34,H*0.42);
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`});
        const pal=['--cstop-1b','--legend-3','--cstop-1a','--legend-2','--legend-1','--cstop-3a'];
        let a0=-Math.PI/2;
        segs.forEach((sg,i)=>{ const frac=Math.max(0,sg[1])/100, a1=a0+frac*2*Math.PI;
          const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0), x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1), large=frac>0.5?1:0;
          const cvar=sg[2]||pal[i%pal.length];
          const p=E('path',{d:`M${cx.toFixed(1)},${cy.toFixed(1)} L${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`}); p.style.fill='var('+cvar+')'; svg.appendChild(p);
          const am=(a0+a1)/2, lx=cx+(r+10)*Math.cos(am), ly=cy+(r+10)*Math.sin(am);
          const nm=String(sg[0]); const lab=sg[1].toFixed(2)+'% '+(nm.length>9?nm.slice(0,8)+'\u2026':nm);
          const t=svgText(E,lx,ly+3,lab,Math.cos(am)<0?'end':'start'); t.setAttribute('font-size','8'); svg.appendChild(t);
          setTip(p,nm,[['Share',sg[1].toFixed(2)+'%']]); a0=a1; });
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
        const r=rng(seed), step=innerW/n, bw=step*0.74, last=series.length-1, tops=[];
        for(let i=0;i<n;i++){ const t=n>1?i/(n-1):0;
          const profile=shape==='grow'?(0.12+0.85*t)*(0.85+r()*0.2):shape==='rand'?(0.2+r()*0.78):Math.pow(Math.sin(Math.min(1,t*1.12)*Math.PI),0.7);
          const total=full?ymax*(0.9+r()*0.08):ymax*(0.30+0.62*profile)*(0.82+r()*0.3);
          const finalAllLast=bias&&i===n-1;
          const shares=series.map((s,si)=>{ if(finalAllLast) return si===last?1:0.0001; let base=(s.w||1)*(0.55+0.9*r()); if(bias&&si===last) base*=(0.1+t*t*4); return base; });
          const sum=shares.reduce((a,b)=>a+b,0);
          let yb=padT+innerH; const x=padL+step*i+(step-bw)/2;
          series.forEach((s,si)=>{ const h=(shares[si]/sum)*(Math.min(total,ymax)/ymax)*innerH, y=yb-h;
            const rect=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:bw.toFixed(1),height:Math.max(0.4,h).toFixed(1)}); rect.style.fill='var('+(s.c||'--cstop-1a')+')'; svg.appendChild(rect); yb=y; });
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
        const m=Math.max(1,cats.length), rh=innerH/m, bh=Math.min(13,rh*0.7), r=rng(seed), cap=Math.max(4,Math.floor(labelW/5));
        cats.forEach((cat,i)=>{ const cy=padT+rh*i+rh/2, y=cy-bh/2; const t=m>1?i/(m-1):0;
          const shown=(String(cat).length>cap)?String(cat).slice(0,cap-1)+'\u2026':String(cat);
          const lt=svgText(E,padL-5,cy+3,shown,'end'); lt.setAttribute('font-size','8.5'); svg.appendChild(lt);
          const total=(0.34+0.62*t)*(0.9+r()*0.2)*100;
          const shares=series.map(s=>(s.w||1)*(0.45+0.95*r())), sum=shares.reduce((a,b)=>a+b,0);
          let x=padL;
          series.forEach((s,si)=>{ const w=(shares[si]/sum)*(Math.min(total,xmax)/xmax)*innerW; if(w<=0)return; const rect=E('rect',{x:x.toFixed(1),y:y.toFixed(1),width:Math.max(0.4,w).toFixed(1),height:bh.toFixed(1)}); rect.style.fill='var('+(s.c||'--cstop-1a')+')'; svg.appendChild(rect); x+=w; });
          hitRect(svg,padL,padT+rh*i,innerW,rh,String(cat),[['Total',Math.round(total)+'%']]); });
        wrap.appendChild(svg);
      }
      let _rzt; window.addEventListener('resize',()=>{ clearTimeout(_rzt); _rzt=setTimeout(()=>renderChartsIn(document.querySelector('.view.active')),160); });
      function buildChart(w){ const t=w.dataset.chart; w.innerHTML='';
        if(t==='combo')combo(w); else if(t==='donut')donut(w); else if(t==='area')area(w); else if(t==='dots')dots(w);
        else if(t==='pbars')pbars(w); else if(t==='otd-class')otdClass(w); else if(t==='otd-hist')otdHist(w); else if(t==='otd-dev')otdDev(w);
        else if(t==='freqhist')freqhist(w); else if(t==='durline')durline(w); else if(t==='hbarcat')hbarcat(w);
        else if(t==='pie')pieGen(w); else if(t==='stackbars')stackbars(w); else if(t==='hstackbars')hstackbars(w); }
      function renderChartsIn(view){ if(!view)return; view.querySelectorAll('[data-chart]').forEach(buildChart); }

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
      // keep the editor top tabs' active state in sync with the shown view
      function setNavTabActive(v){
        document.querySelectorAll('.tabbar .tabs .ia-tab[data-view]').forEach(t=>t.classList.toggle('active', t.dataset.view===v));
        const a=document.querySelector('.tabbar .tabs .ia-tab[data-view="'+v+'"]');
        if(a&&a.scrollIntoView) a.scrollIntoView({inline:'nearest',block:'nearest'});
      }
      function selectView(v){
        if(fxAnimating) return;
        const current=document.querySelector('.view.active');
        const next=document.querySelector('.view[data-view="'+v+'"]');
        const slide=root.getAttribute('data-tabfx')==='slide';
        if(!next || next===current || !slide || !current){   // !current: reopening from the empty state has nothing to slide from
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
        [oldView,newView].forEach(f=>{ f.classList.add('fx-face'); f.style.left=padL+'px'; f.style.top=padT+'px'; f.style.width=w+'px'; f.style.height=h+'px'; });
        newView.classList.add('active');
        renderChartsIn(newView); runCounters(newView);

        const dur=380, ease='cubic-bezier(.33,0,.2,1)';
        oldView.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-dir*dist}px)`,opacity:0}], {duration:dur, easing:ease, fill:'forwards'});
        const enter=newView.animate([{transform:`translateX(${dir*dist}px)`,opacity:0},{transform:'translateX(0)',opacity:1}], {duration:dur, easing:ease, fill:'forwards'});

        enter.onfinish=()=>{
          [oldView,newView].forEach(f=>{ f.classList.remove('fx-face'); f.style.left=''; f.style.top=''; f.style.width=''; f.style.height=''; f.style.transform=''; f.style.opacity=''; });
          oldView.classList.remove('active');
          newView.classList.add('active');
          content.classList.remove('fx-scene');
          content.style.height='';
          newView.scrollTop=0;                    // flowy: the card owns the scroll — start it at the top
          fxAnimating=false;
        };
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
        // top tab in the context route (.tabs > .ia-tab), inserted before the "+" add button
        const tabs=document.querySelector('.tabbar .tabs');
        if(def.addTab!==false && tabs && !tabs.querySelector('.ia-tab[data-view="'+id+'"]')){
          const tab=document.createElement('div');
          tab.className='ia-tab'; tab.setAttribute('data-view',id);
          tab.innerHTML=(def.icon||'')+'<span class="ia-tab-lbl">'+(def.label||id)+'</span>'+'<span class="ia-x" title="Close" aria-label="Close tab"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">'+icons.close+'</svg></span>';
          const addBtn=tabs.querySelector('.ia-tab-add');
          tabs.insertBefore(tab, addBtn||null);
          tab.addEventListener('click',(e)=>{
            if(e.target.closest('.ia-x')) return;   // close is handled by the delegated handler in shell.js
            selectView(id);
            tabs.querySelectorAll('.ia-tab[data-view]').forEach(x=>x.classList.toggle('active', x===tab));
          });
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
        bMono.classList.toggle('on',m==='mono'); bColor.classList.toggle('on',m==='color'); bVivid.classList.toggle('on',m==='vivid');
        applyHue(); applyBrand(); }
      bColor.onclick=()=>setTheme('color'); bMono.onclick=()=>setTheme('mono'); bVivid.onclick=()=>setTheme('vivid');
      const hueInput=document.getElementById('theme-hue-input'), hueReset=document.getElementById('theme-hue-reset');
      function rgbToHue(hex){ const n=parseInt(hex.slice(1),16); let r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let h=0; if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if(h<0)h+=360; } return h; }
      function applyHue(){
        const props=['--cstop-1a','--cstop-1b','--cstop-2a','--cstop-3a','--cstop-4a','--area-top','--area-mid','--line-2','--legend-1','--legend-2','--legend-3','--legend-4','--success'];
        if(!(root.getAttribute('data-theme')==='color' && customHue)){ props.forEach(p=>root.style.removeProperty(p)); renderChartsIn(document.querySelector('.view.active')); return; }
        const h=Math.round(rgbToHue(customHue)), light=root.getAttribute('data-mode')==='light', S=52;
        const Ls= light?[20,34,44,56,64,74,82,89]:[98,84,76,60,52,40,30,20];
        const hsl=l=>'hsl('+h+' '+S+'% '+l+'%)', set=(k,v)=>root.style.setProperty(k,v);
        set('--cstop-1a',hsl(Ls[0]));set('--cstop-1b',hsl(Ls[1]));set('--cstop-2a',hsl(Ls[2]));set('--cstop-3a',hsl(Ls[4]));set('--cstop-4a',hsl(Ls[6]));
        set('--area-top','hsl('+h+' '+S+'% '+(light?46:62)+'% / '+(light?0.2:0.42)+')'); set('--area-mid','hsl('+h+' '+S+'% 50% / 0)');
        set('--line-2',hsl(light?42:70));
        set('--legend-1',hsl(Ls[0]));set('--legend-2',hsl(Ls[3]));set('--legend-3',hsl(Ls[4]));set('--legend-4',hsl(Ls[6]));
        set('--success',hsl(light?42:64));
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
        if(brandColor==null || !root.getAttribute('data-theme')){ root.style.removeProperty('--accent'); root.style.removeProperty('--accent-text'); return; }
        const dark = root.getAttribute('data-mode')!=='light';
        // a near-black brand would disappear on the dark shell — lighten it toward white for legibility.
        const c = (dark && brandLum(brandColor) < 0.22) ? shadeC(brandColor, 0.82) : brandColor;
        root.style.setProperty('--accent', c);
        // legible label colour on accent-filled buttons (white on dark accents, ink on light ones)
        root.style.setProperty('--accent-text', brandLum(c) > 0.5 ? '#15161a' : '#ffffff');
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

      const bLayDef=document.getElementById('layout-default'), bLayFlow=document.getElementById('layout-flowy');
      function setLayout(m){ if(m==='flowy')root.setAttribute('data-layout','flowy'); else root.removeAttribute('data-layout');
        bLayDef.classList.toggle('on',m!=='flowy'); bLayFlow.classList.toggle('on',m==='flowy');
        // Flowy is its own complete surface treatment — Shell separation conflicts with it, so hide it and reset to default
        const sg=document.getElementById('shell-sep-grp');
        if(m==='flowy'){
          root.removeAttribute('data-shell');
          ['shell-seamless','shell-contrast'].forEach(id=>document.getElementById(id)&&document.getElementById(id).classList.remove('on'));
          const st=document.getElementById('shell-tinted'); if(st) st.classList.add('on');
          if(sg) sg.style.display='none';
        } else if(sg){ sg.style.display=''; }
        renderChartsIn(document.querySelector('.view.active')); }
      bLayDef.onclick=()=>setLayout('default'); bLayFlow.onclick=()=>setLayout('flowy');

      /* tab transition: default vs slide-fade */
      const bFxFlat=document.getElementById('tabfx-flat'), bFxSlide=document.getElementById('tabfx-slide');
      function setTabFx(m){ if(m==='slide')root.setAttribute('data-tabfx','slide'); else root.removeAttribute('data-tabfx');
        bFxFlat.classList.toggle('on',m!=='slide'); bFxSlide.classList.toggle('on',m==='slide'); }
      bFxFlat.onclick=()=>setTabFx('flat'); bFxSlide.onclick=()=>setTabFx('slide');

      /* charts look: default vs isometric vs glass */
      const bC3dDef=document.getElementById('c3d-default'), bC3dIso=document.getElementById('c3d-iso'), bC3dGlass=document.getElementById('c3d-glass');
      function setCharts3d(m){
        if(m==='iso')root.setAttribute('data-charts3d','iso');
        else if(m==='glass')root.setAttribute('data-charts3d','glass');
        else root.removeAttribute('data-charts3d');
        bC3dDef.classList.toggle('on',m!=='iso'&&m!=='glass');
        bC3dIso.classList.toggle('on',m==='iso'); bC3dGlass.classList.toggle('on',m==='glass');
        const ext=document.getElementById('d3-extent-grp'); if(ext) ext.classList.toggle('is-disabled', m!=='iso'&&m!=='glass');  // extent only relevant when a 3D style is on
        renderChartsIn(document.querySelector('.view.active'));
      }
      bC3dDef.onclick=()=>setCharts3d('default'); bC3dIso.onclick=()=>setCharts3d('iso'); bC3dGlass.onclick=()=>setCharts3d('glass');

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
      wireKnob('data-3dscope',    [{id:'d3-accent',val:'accent'},{id:'d3-full',val:'full'}], true);
      wireKnob('data-composition',[{id:'comp-uniform',val:'uniform'},{id:'comp-bento',val:null},{id:'comp-hero',val:'hero'}], true);
      /* KPI numerals: weight slider + font-family toggle */
      const kpiW=document.getElementById('kpi-weight'), kwVal=document.getElementById('kw-val');
      if(kpiW) kpiW.addEventListener('input',()=>{ root.style.setProperty('--kpi-weight',kpiW.value); kwVal.textContent=kpiW.value; });
      const KF={ sans:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", mono:"ui-monospace,'SF Mono',Menlo,Consolas,monospace", serif:"'Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif" };
      function setKpiFont(f){ root.style.setProperty('--kpi-font',KF[f]); ['sans','mono','serif'].forEach(x=>{ const b=document.getElementById('kf-'+x); if(b) b.classList.toggle('on',x===f); }); }
      ['sans','mono','serif'].forEach(f=>{ const b=document.getElementById('kf-'+f); if(b) b.onclick=()=>setKpiFont(f); });
      wireKnob('data-tabmodel',   [{id:'tabm-default',val:null},{id:'tabm-seg',val:'seg'}], false);
      wireKnob('data-tables',     [{id:'tbl-comfortable',val:null},{id:'tbl-lined',val:'lined'}], false);
      wireKnob('data-surfacefx',  [{id:'surf-flat',val:null},{id:'surf-frost',val:'frost'}], false);
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
        'layout-default':()=>setLayout('default'), 'layout-flowy':()=>setLayout('flowy'),
        'tabfx-flat':()=>setTabFx('flat'), 'tabfx-slide':()=>setTabFx('slide'),
        'c3d-default':()=>setCharts3d('default'), 'c3d-iso':()=>setCharts3d('iso'), 'c3d-glass':()=>setCharts3d('glass'),
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
            'data-shell','data-composition','data-tabmodel','data-tables','data-tabs','data-surfacefx'];
          const jsAttrs = ['data-3dscope','data-tabfx']; // consumed in chartMode() / view-switch, not CSS
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
        const m3=chartMode(wrap), barCol=cssVar('--cstop-1a', wrap);
        RQ_BARS.forEach((row,i)=>{ const cy=padT+rowH*i+rowH/2;
          const lt=svgText(E,labelW-8,cy+4,row[0],'end'); lt.setAttribute('class','rq-bar-label'); svg.appendChild(lt);
          const bw=Math.max(2,(row[1]/mx)*innerW); const bh=rowH*0.62;
          if(m3){ bar3dH(svg,labelW,(cy-bh/2),bw,bh,barCol,m3); }
          else { const r=E('rect',{x:labelW,y:(cy-bh/2).toFixed(1),width:bw.toFixed(1),height:bh.toFixed(1),rx:2}); r.style.fill=fill; svg.appendChild(r); }
          const vt=svgText(E,labelW+bw+(m3==='iso'?12:5),cy+4,String(row[1]),'start'); vt.setAttribute('class','rq-bar-val'); vt.style.fill=barCol; svg.appendChild(vt);
        });
        RQ_BARS.forEach((row,i)=>{ hitRect(svg,0,padT+rowH*i,W,rowH,row[0],[['Count',String(row[1])]]); });
        wrap.appendChild(svg);
      }

      /* ---- Chart components: pie with leader-line labels ---- */
      function pie(wrap){
        // fixed viewBox — never read clientHeight (avoids measure→write→measure growth loop)
        const W=440, H=460, cx=W/2, cy=H*0.5, r=Math.min(W,H)*0.30;
        // distinct categorical colours per slice from the theme chart ramp (differs across Mono/Color/Vivid + hue)
        const sliceColors=['var(--cstop-1a)','var(--cstop-2a)','var(--cstop-3a)','var(--cstop-4a)'];
        const m3=chartMode(wrap);
        const yS = m3==='iso'?0.62 : m3==='glass'?0.92 : 1;    // vertical squash for the tilt
        const depth = m3==='iso'?22 : m3==='glass'?5 : 0;       // extrusion thickness
        const svg=E('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'xMidYMid meet'});
        svg.style.width='100%'; svg.style.height='100%';
        const colOf=(s,i)=> s.other ? 'rgba(140,142,150,0.85)' : resolveColor(sliceColors[i]||'var(--cstop-1a)', wrap);
        function slicePath(a0,a1,yy){ const large=(a1-a0)>Math.PI?1:0;
          const x0=cx+r*Math.cos(a0), y0=yy+r*Math.sin(a0)*yS, x1=cx+r*Math.cos(a1), y1=yy+r*Math.sin(a1)*yS;
          return `M${cx},${yy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${(r*yS).toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`; }
        const arcs=[]; let ang=-Math.PI/2; RQ_PIE.forEach(s=>{ const a0=ang,a1=ang+(s.p/100)*Math.PI*2; ang=a1; arcs.push([a0,a1]); });
        const body = m3 ? E('g',{filter:`url(#${ensureSoftShadow(svg, m3==='iso'?8:4, m3==='iso'?7:5, 0.32)})`}) : svg;
        // 1) extruded side wall (darker copies stacked behind the top face)
        if(m3){ for(let k=depth;k>=1;k--){ RQ_PIE.forEach((s,i)=>{ const p=E('path',{d:slicePath(arcs[i][0],arcs[i][1],cy+k)}); p.style.fill=shadeC(colOf(s,i),-0.34); body.appendChild(p); }); } }
        // 2) top faces
        RQ_PIE.forEach((s,i)=>{ const p=E('path',{d:slicePath(arcs[i][0],arcs[i][1],cy)});
          p.style.fill=colOf(s,i); if(m3==='glass') p.style.fillOpacity='0.94';
          p.style.stroke='var(--bg-1)'; p.style.strokeWidth='1.2'; body.appendChild(p); });
        // glassy sheen across the top face — soft radial gloss (top-lit), fades to transparent
        if(m3){
          let pdefs=svg.querySelector('defs'); if(!pdefs){ pdefs=E('defs',{}); svg.insertBefore(pdefs,svg.firstChild);}
          const sid='pieSheen'+(nextGid()); const rg=E('radialGradient',{id:sid,cx:'50%',cy:'30%',r:'68%'});
          rg.appendChild(E('stop',{offset:'0%','stop-color':'rgba(255,255,255,0.30)'}));
          rg.appendChild(E('stop',{offset:'55%','stop-color':'rgba(255,255,255,0.07)'}));
          rg.appendChild(E('stop',{offset:'100%','stop-color':'rgba(255,255,255,0)'}));
          pdefs.appendChild(rg);
          const sg=E('ellipse',{cx:cx,cy:cy,rx:r*0.99,ry:r*yS*0.99,fill:`url(#${sid})`,'pointer-events':'none'}); body.appendChild(sg);
        }
        if(m3) svg.appendChild(body);
        // 3) leader lines + labels — small slices fan out on the right so they never overlap
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
        RQ_PIE.forEach((s,i)=>{ hitPath(svg,slicePath(arcs[i][0],arcs[i][1],cy),s.l,[['Share',s.p.toFixed(2)+'%']]); });
        wrap.appendChild(svg);
      }

      /* register the new chart types into the dispatcher (world map is static inline SVG) */
      const _buildChart = buildChart;
      buildChart = function(w){
        try {
          const t=w.dataset.chart;
          if(t==='hbars'){ w.innerHTML=''; hbars(w); return; }
          if(t==='pie'){ w.innerHTML=''; pie(w); return; }
          _buildChart(w);
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
        const sub=s.dataset.rqsub==='charts'?'charts':'more';
        view.querySelectorAll('.rq-content').forEach(c=>{ c.style.display = (c.dataset.rqcontent===sub)?(sub==='charts'?'grid':'block'):'none'; });
        if(sub==='charts') renderChartsIn(view);
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
            [['global','Follow global'],['flat','Flat (2D)'],['iso','Isometric'],['glass','Glass']].forEach(([val,lab])=>{
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
              // re-render so baked colours (3D bars, pie slices, value labels) pick up the card's flipped tokens
              card.querySelectorAll('[data-chart]').forEach(buildChart);
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
        const flag=$('preset-flag');
        const editRow=$('preset-edit'), nameInp=$('preset-name');
        const confirmRow=$('preset-confirm'), confirmText=$('preset-confirm-text');
        const DEFAULTS=[
          { id:'preset-enterprise-calm', name:'Enterprise Calm',
            state:{ buttons:['mode-light','theme-mono','color-calm','shell-contrast','layout-default','tabm-seg','tabs-filled','tabfx-flat','comp-bento','density-spacious','kf-sans','c3d-default','d3-accent'],
              sliders:{'r-surface':'10','r-interactive':'8','kpi-weight':'300','r-glass':'0'}, hue:'#6366f1', hueActive:false, tab:'#6366f1' } },
          { id:'preset-bento-bold', name:'Bento Bold',
            state:{ buttons:['mode-light','theme-mono','color-strategic','shell-tinted','layout-default','tabm-seg','tabs-filled','tabfx-flat','comp-hero','density-spacious','kf-sans','c3d-iso','d3-accent'],
              sliders:{'r-surface':'14','r-interactive':'9','kpi-weight':'200','r-glass':'0'}, hue:'#6366f1', hueActive:false, tab:'#6366f1' } },
          { id:'preset-exec-dark', name:'Executive Dark',
            state:{ buttons:['mode-dark','theme-color','color-strategic','shell-contrast','layout-default','tabm-seg','tabs-filled','tabfx-slide','comp-bento','density-compact','kf-sans','c3d-glass','d3-accent'],
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
            glassAdv: ggAdv ? ggAdv.getAttribute('aria-pressed')==='true' : false,
            glassOp: gOp ? gOp.value : null, glassBl: gBl ? gBl.value : null
          };
        }
        if (import.meta.env.DEV) window.__captureState = captureState;   // dev-only hook for the glass self-check
        // Declarative + idempotent: apply the stored state directly (root attributes / CSS vars
        // + .on sync) through the knob registry, instead of replaying .click() in array order.
        function applyState(st){
          if(!st) return;
          (st.buttons||[]).forEach(id=>{ const fn=BTN_ACTIONS[id]; if(fn) fn(); });
          if(st.sliders) for(const id in st.sliders){ const el=$(id); if(el){ el.value=st.sliders[id]; el.dispatchEvent(new Event('input')); } }
          // glass split: honor the stored advanced state (else force simple so any live axis overrides clear)
          if(typeof setGlassMode==='function'){
            setGlassMode(!!st.glassAdv);
            if(st.glassAdv){ if(gOp&&st.glassOp!=null){ gOp.value=st.glassOp; setGlassOp(+st.glassOp); } if(gBl&&st.glassBl!=null){ gBl.value=st.glassBl; setGlassBl(+st.glassBl); } }
          }
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
          return JSON.stringify({ b:[...(st.buttons||[])].sort(), s:keys.map(k=>String(sl[k]==null?'':sl[k])),
            hue:st.hueActive?st.hue:null, tab:st.tab||null, brand:st.brandActive?st.brand:null,
            ga:!!st.glassAdv, go:st.glassAdv?String(st.glassOp):null, gb:st.glassAdv?String(st.glassBl):null }); }
        function snap(){ lastSnap=sig(captureState()); }   // record the baseline right after apply/save

        /* ---- shared theme library (auto-sync to the cloud themes bin) ----
           Built-in DEFAULTS stay local; user-made presets sync, tagged by owner.
           Reading other people's presets needs no name; pushing mine prompts once. */
        const DEFAULT_IDS = new Set(DEFAULTS.map(d=>d.id));
        const isMine = (p, me)=> me ? p.owner===me : (!DEFAULT_IDS.has(p.id) && !p.owner);
        const myPresets = (me)=> store.presets.filter(p=>!DEFAULT_IDS.has(p.id) && isMine(p,me));
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
              await syncOwnerThemes(me, myPresets(me));
            }catch(e){ console.error('[themes] sync failed', e); }
          }, 250);
        }
        function mergeShared(shared){
          const arr = Array.isArray(shared)?shared:[];
          if(!arr.length) return;
          const me = getAuthor();
          const keep = store.presets.filter(p => DEFAULT_IDS.has(p.id) || isMine(p, me));
          const keepIds = new Set(keep.map(p=>p.id));
          const others = arr.filter(p => p && p.id && !DEFAULT_IDS.has(p.id) && !(me && p.owner===me) && !keepIds.has(p.id));
          store.presets = [...keep, ...others];
          persist(); render(); refresh();
        }

        function render(){
          sel.innerHTML='';
          const me=getAuthor();
          const ph=document.createElement('option'); ph.value=''; ph.textContent='— Custom —'; sel.appendChild(ph);
          store.presets.forEach(p=>{ const o=document.createElement('option'); o.value=p.id;
            o.textContent = (p.owner && p.owner!==me) ? (p.name+' · '+p.owner) : p.name; sel.appendChild(o); });
          sel.value=store.selected||'';
        }
        function current(){ return store.presets.find(p=>p.id===sel.value); }

        function refresh(){
          const p=current();
          const dirty = !!p && sig(captureState())!==lastSnap;
          if(flag) flag.hidden=!dirty;
          $('preset-save').disabled   = p ? !dirty : false;   // Custom → enabled (acts as "New"); preset → only when drifted
          $('preset-rename').disabled = !p;                    // nothing to rename on "— Custom —"
          $('preset-del').disabled    = !p;
        }

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
        $('preset-del').onclick=()=>{ const p=current(); if(!p) return; openConfirm('Delete \u201C'+p.name+'\u201D?'); };
        // ---- inline editor / confirm wiring ----
        $('preset-ok').onclick=commitEdit;
        $('preset-cancel').onclick=closeRows;
        nameInp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); commitEdit(); } else if(e.key==='Escape'){ e.preventDefault(); closeRows(); } });
        $('preset-confirm-ok').onclick=()=>{ const p=current(); if(p){ store.presets=store.presets.filter(x=>x.id!==p.id); store.selected=''; persist(); render(); pushMine(); } closeRows(); snap(); refresh(); };
        $('preset-confirm-cancel').onclick=closeRows;

        // ---- live drift tracking: any knob change re-evaluates the Modified flag ----
        if(proto){ let t; const ping=()=>{ clearTimeout(t); t=setTimeout(refresh,0); };
          proto.addEventListener('input', e=>{ if(!e.target.closest('.preset-grp')) ping(); });
          proto.addEventListener('click', e=>{ if(!e.target.closest('.preset-grp')) ping(); }); }

        render();
        if(store.selected){ const p=current(); if(p) applyState(p.state); }   // restore last-applied preset
        snap(); refresh();

        // Snapshot bridge for the feedback feature (built on top, never touches the proto).
        window.IA = window.IA || {};
        window.IA.captureState = captureState;
        window.IA.applyState = applyState;
        // Pull the shared theme library in (read-only path — no name prompt on boot).
        getThemes().then(mergeShared).catch(()=>{});
      })();

export { selectView, renderChartsIn, runCounters, registerView, getViews };

