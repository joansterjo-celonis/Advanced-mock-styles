import { selectView, renderChartsIn, runCounters } from './engine.js';

(function(){
  const app = document.getElementById('app');
  const l0 = document.getElementById('l0');
  let hoverTimer = null;
  function openHover(){ if(!app.classList.contains('pinned')) app.classList.add('l0-open'); }
  function closeHover(){ app.classList.remove('l0-open'); }
  document.querySelectorAll('[data-revealer]').forEach(function(el){
    el.addEventListener('mouseenter', openHover);
    el.addEventListener('click', function(e){ e.stopPropagation(); openHover(); });
  });
  l0.addEventListener('mouseenter', function(){ clearTimeout(hoverTimer); });
  l0.addEventListener('mouseleave', function(){
    if(app.classList.contains('pinned')) return;
    hoverTimer = setTimeout(closeHover, 160);
  });
  document.querySelectorAll('[data-pin]').forEach(function(btn){
    btn.addEventListener('click', function(e){ e.stopPropagation(); app.classList.add('pinned'); app.classList.remove('l0-open'); });
  });
  document.getElementById('unpinBtn').addEventListener('click', function(e){
    e.stopPropagation();
    if(app.classList.contains('pinned')){ app.classList.remove('pinned'); closeHover(); }
    else { app.classList.add('pinned'); app.classList.remove('l0-open'); }
  });
  const routes = { home:'route-home', studio:'route-studio', context:'route-context', datalake:'route-datalake', space:'route-space' };
  function go(route){
    Object.keys(routes).forEach(function(k){ document.getElementById(routes[k]).classList.remove('active'); });
    document.getElementById(routes[route]).classList.add('active');
    app.dataset.route = route;
    document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.toggle('active', n.dataset.nav===route); });
    if(route==='context'){ var rc=document.getElementById('route-context'); rc.classList.add('mode-overview'); rc.classList.remove('mode-editor'); }
    if(!app.classList.contains('pinned')) closeHover();
  }
  document.querySelectorAll('.nav-item').forEach(function(n){ n.addEventListener('click', function(){ go(n.dataset.nav); }); });
  go('context');
  document.querySelectorAll('[data-grouptoggle]').forEach(function(h){
    h.addEventListener('click', function(){ h.closest('[data-group]').classList.toggle('collapsed'); });
  });
  document.querySelectorAll('.l1-leaf').forEach(function(leaf){
    leaf.addEventListener('click', function(){
      document.querySelectorAll('.l1-leaf').forEach(function(l){ l.classList.remove('active'); });
      leaf.classList.add('active');
    });
  });
  document.querySelectorAll('.pills .pill').forEach(function(p){
    p.addEventListener('click', function(){
      if(p.querySelector('.ia-chev')) return;
      document.querySelectorAll('.pills .pill').forEach(function(x){ if(!x.querySelector('.ia-chev')) x.classList.remove('active'); });
      p.classList.add('active');
    });
  });
  document.querySelectorAll('.ia-tab .ia-x').forEach(function(x){
    x.addEventListener('click', function(e){
      e.stopPropagation();
      var t=x.closest('.ia-tab'); var wasActive=t.classList.contains('active'); t.remove();
      if(wasActive){ var first=document.querySelector('#route-context .ia-tab'); if(first) first.classList.add('active'); }
    });
  });
  document.querySelectorAll('#route-context .ia-tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('#route-context .ia-tab').forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
    });
  });
  function closeAllPops(){
    document.querySelectorAll('.sb-pop').forEach(function(p){p.classList.remove('open');});
    document.querySelectorAll('.sb-item[data-pop]').forEach(function(b){b.classList.remove('active-pop');});
  }
  document.querySelectorAll('.sb-item[data-pop]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var pop = btn.parentNode.querySelector('.sb-pop');
      var isOpen = pop.classList.contains('open');
      closeAllPops();
      if(!isOpen){ pop.classList.add('open'); btn.classList.add('active-pop'); }
    });
  });
  document.querySelectorAll('.sb-pop').forEach(function(p){ p.addEventListener('click', function(e){ e.stopPropagation(); }); });
  document.addEventListener('click', closeAllPops);
  document.querySelectorAll('.pkg-row').forEach(function(r){
    r.addEventListener('click', function(){
      document.querySelectorAll('.pkg-row').forEach(function(x){ x.classList.remove('active'); });
      r.classList.add('active');
    });
  });
  var matrix = document.getElementById('matrix');
  var cols=11, rows=5;
  for(var i=0;i<cols*rows;i++){ var d=document.createElement('i'); if((i%cols)>=9) d.classList.add('r'); matrix.appendChild(d); }
  var scatter=document.getElementById('scatter');
  [[88,8],[12,42],[28,43],[44,42],[60,42],[8,64],[24,64],[40,64],[56,64],[16,84],[5,98]].forEach(function(p){
    var s=document.createElement('span');
    s.style.cssText='position:absolute;width:7px;height:7px;border-radius:50%;background:var(--ia-navy);left:'+p[0]+'%;top:'+p[1]+'%;';
    scatter.appendChild(s);
  });
  // ===== Global search modal =====
  var gOverlay=document.getElementById('gsearch-overlay');
  var gInput=document.getElementById('gsearch-input');
  function openSearch(){ gOverlay.classList.add('open'); setTimeout(function(){ if(gInput){gInput.focus(); gInput.select();} },40); }
  function closeSearch(){ gOverlay.classList.remove('open'); }
  document.querySelectorAll('.search-box').forEach(function(b){ b.style.cursor='pointer'; b.addEventListener('click', function(e){ e.stopPropagation(); openSearch(); }); });
  document.addEventListener('keydown', function(e){
    if((e.metaKey||e.ctrlKey) && (e.key==='k'||e.key==='K')){ e.preventDefault(); openSearch(); }
    if(e.key==='Escape'){ closeSearch(); }
  });
  gOverlay.addEventListener('click', function(e){ if(e.target===gOverlay) closeSearch(); });
  function gsRefresh(){
    var q=(gInput.value||'').trim().toLowerCase();
    var f=document.querySelector('.gs-chip.active').dataset.filter;
    document.querySelectorAll('#gsearch-results .gs-row').forEach(function(r){
      var okCat=(f==='all')||(r.dataset.cat===f);
      var okTxt=(r.dataset.name||'').indexOf(q)>=0;
      r.style.display=(okCat&&okTxt)?'':'none';
    });
    var anyVisible=false;
    document.querySelectorAll('#gsearch-results .gs-group').forEach(function(g){
      var rows=g.querySelectorAll('.gs-row');
      var visible=Array.prototype.filter.call(rows,function(r){return r.style.display!=='none';});
      if(visible.length){
        var head=g.querySelector('.gs-space');
        if(head && head.style.display==='none'){ head.style.display=''; }
        g.style.display=''; anyVisible=true;
      } else { g.style.display='none'; }
    });
    document.getElementById('gs-empty').style.display=anyVisible?'none':'block';
  }
  document.querySelectorAll('.gs-chip').forEach(function(ch){
    ch.addEventListener('click', function(){
      document.querySelectorAll('.gs-chip').forEach(function(x){x.classList.remove('active');});
      ch.classList.add('active'); gsRefresh();
    });
  });
  gInput.addEventListener('input', gsRefresh);
  document.querySelectorAll('#gsearch-results .gs-row').forEach(function(r){
    r.addEventListener('click', function(){
      document.querySelectorAll('#gsearch-results .gs-row').forEach(function(x){x.classList.remove('sel');});
      r.classList.add('sel');
    });
  });

  // ===== Workbench / Launchpad switcher =====
  var wbBtn=document.getElementById('wbSwitch');
  var wbMenu=document.getElementById('wb-menu');
  if(wbBtn){
    wbBtn.addEventListener('click', function(e){ e.stopPropagation(); wbMenu.classList.toggle('open'); });
    wbMenu.addEventListener('click', function(e){ e.stopPropagation(); });
    document.addEventListener('click', function(){ wbMenu.classList.remove('open'); });
    document.querySelectorAll('.wb-item').forEach(function(it){
      it.addEventListener('click', function(){
        document.querySelectorAll('.wb-item').forEach(function(x){ x.classList.remove('active'); });
        it.classList.add('active');
        document.getElementById('wb-label').textContent=it.dataset.wb;
        wbMenu.classList.remove('open');
      });
    });
  }

  // ===== Version history open + row menus =====
  var histBtn=document.getElementById('ver-history');
  if(histBtn) histBtn.addEventListener('click', function(e){ e.stopPropagation(); openModal('hist-overlay'); });
  document.querySelectorAll('.vh-kebab').forEach(function(k){
    k.addEventListener('click', function(e){ e.stopPropagation();
      var m=k.closest('.vh-item').querySelector('.vh-menu');
      var open=m.classList.contains('open');
      document.querySelectorAll('.vh-menu').forEach(function(x){x.classList.remove('open');});
      if(!open) m.classList.add('open');
    });
  });
  document.addEventListener('click', function(){ document.querySelectorAll('.vh-menu').forEach(function(x){x.classList.remove('open');}); });
  document.querySelectorAll('.vh-tab,.dep-tab').forEach(function(t){
    t.addEventListener('click', function(){ var sib=t.parentNode.children; for(var i=0;i<sib.length;i++) sib[i].classList.remove('active'); t.classList.add('active'); });
  });

  function openModal(id){ closeAllPops(); var m=document.getElementById(id); if(m) m.classList.add('open'); }
  var ovBtn=document.getElementById('pkg-overview');
  if(ovBtn) ovBtn.addEventListener('click', function(e){ e.stopPropagation();
    closeAllPops();
    document.querySelectorAll('.modal-overlay.open').forEach(function(o){o.classList.remove('open');});
    go('context'); /* lands on Context Models overview (package list) */
  });
  var depBtn=document.getElementById('sb-deploy-btn');
  if(depBtn) depBtn.addEventListener('click', function(e){ e.stopPropagation(); openModal('deploy-overlay'); });
  document.querySelectorAll('.modal-overlay').forEach(function(ov){
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.classList.remove('open'); });
  });
  document.querySelectorAll('[data-close]').forEach(function(b){
    b.addEventListener('click', function(){ var ov=b.closest('.modal-overlay'); if(ov) ov.classList.remove('open'); });
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ document.querySelectorAll('.modal-overlay.open').forEach(function(o){o.classList.remove('open');}); } });

  // ===== Go to space -> Space page =====
  function titleCase(str){ return str.replace(/\b\w/g, function(c){return c.toUpperCase();}); }
  function openSpace(name){
    document.querySelectorAll('.modal-overlay.open').forEach(function(o){o.classList.remove('open');});
    closeAllPops();
    document.getElementById('sp-name-title').textContent=name;
    document.getElementById('sp-brand-label').textContent=name;
    go('space');
  }
  document.querySelectorAll('.pkg-space .goto').forEach(function(a){
    a.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault();
      var nmEl=a.closest('.pkg-space').querySelector('.nm');
      var nm=nmEl?nmEl.textContent.split('(')[0].trim():'Space'; openSpace(nm); });
  });
  document.querySelectorAll('.gs-space .goto').forEach(function(a){
    a.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault();
      var row=a.closest('.gs-space'); openSpace(titleCase(row.dataset.name||'Space')); });
  });
  document.querySelectorAll('.space-card').forEach(function(c){
    c.addEventListener('click', function(){ var n=c.querySelector('.space-nm'); openSpace(n?n.textContent.trim():'Space'); });
  });
  document.querySelectorAll('.sp-tab').forEach(function(t){
    t.addEventListener('click', function(){ t.parentNode.querySelectorAll('.sp-tab').forEach(function(x){x.classList.remove('active');}); t.classList.add('active'); });
  });

  // ===== Context Models: overview -> editor on package pick =====
  document.querySelectorAll('#route-context .ctx-overview .ovrow, #route-context .ctx-overview .sp-card').forEach(function(el){
    el.style.cursor='pointer';
    el.addEventListener('click', function(){
      var rc=document.getElementById('route-context');
      rc.classList.remove('mode-overview'); rc.classList.add('mode-editor');
    });
  });

  // ===== Package 3-dot context menu =====
  var pkgCtx=document.getElementById('pkg-ctxmenu');
  document.querySelectorAll('.pkg-row .more').forEach(function(k){
    k.addEventListener('click', function(e){
      e.stopPropagation();
      var r=k.getBoundingClientRect();
      pkgCtx.classList.add('open');
      var w=pkgCtx.offsetWidth, h=pkgCtx.offsetHeight;
      var left=Math.min(r.right-4, window.innerWidth-w-8);
      var top=r.bottom+6;
      if(top+h>window.innerHeight-8) top=r.top-h-6;
      pkgCtx.style.left=Math.max(8,left)+'px';
      pkgCtx.style.top=Math.max(8,top)+'px';
    });
  });
  pkgCtx.addEventListener('click', function(e){ e.stopPropagation(); pkgCtx.classList.remove('open'); });
  document.addEventListener('click', function(){ pkgCtx.classList.remove('open'); });

})();

  /* ===== bridge: source shell ↔ asset ===== */
  (function(){
    function sv(v){ selectView(v); }
    // editor tabs drive the mounted dashboard
    document.querySelectorAll('#route-context .tabs .ia-tab[data-view]').forEach(function(t){
      t.addEventListener('click',function(){ document.querySelectorAll('#route-context .tabs .ia-tab').forEach(function(x){x.classList.remove('active');}); t.classList.add('active'); sv(t.dataset.view); });
    });
    // L1 leaves + overview rows open the editor on the right dashboard
    var map={'operations view':'order-management','order management':'order-management','purchase order':'purchase-order','rework and quality':'rework-quality'};
    document.querySelectorAll('.l1-leaf, .ctx-overview .ovrow, .ctx-overview .sp-card, #route-context .ia-ov-card').forEach(function(el){
      el.addEventListener('click',function(){ var t=(el.textContent||'').trim().toLowerCase(); var v=el.dataset.view||map[t];
        var rc=document.getElementById('route-context'); rc.classList.remove('mode-overview'); rc.classList.add('mode-editor');
        if(v){ sv(v); document.querySelectorAll('#route-context .tabs .ia-tab[data-view]').forEach(function(x){x.classList.toggle('active',x.dataset.view===v);}); }
        else { var av=document.querySelector('#content .view.active'); if(av){ renderChartsIn(av); runCounters(av); } } });
    });
    // gear / settings opens the prototype controls
    var proto=document.getElementById('proto');
    document.querySelectorAll('.gear,[data-pin]~* ,#rail-settings').forEach(function(){});
    var g=document.querySelector('#l0 .gear'); if(g&&proto) g.addEventListener('click',function(e){e.stopPropagation(); proto.classList.toggle('open');});
    // #fab is wired in engine.js; binding it here too would double-toggle and never open the panel.
  })();
