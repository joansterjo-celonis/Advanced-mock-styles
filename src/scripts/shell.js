import { selectView, renderChartsIn, runCounters } from './engine.js';
import { icons } from './icons.js';

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
  /* editor tab activation + closing is centralized in the source<->asset bridge below
     (delegated on .tabbar .tabs so it also covers registered + reopened tabs). */
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
    var CLOSE_SVG='<span class="ia-x" title="Close" aria-label="Close tab"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">'+icons.close+'</svg></span>';
    var content=document.getElementById('content');
    function tabsEl(){ return document.querySelector('.tabbar .tabs'); }
    function tabFor(v){ return document.querySelector('.tabbar .tabs .ia-tab[data-view="'+v+'"]'); }
    function scrollTabIntoView(v){ var t=tabFor(v); if(t&&t.scrollIntoView) t.scrollIntoView({inline:'nearest',block:'nearest'}); }
    function activateTab(v){ document.querySelectorAll('.tabbar .tabs .ia-tab[data-view]').forEach(function(x){ x.classList.toggle('active', x.dataset.view===v); }); scrollTabIntoView(v); }
    function showEmpty(){ document.querySelectorAll('#content .view').forEach(function(v){ v.classList.remove('active'); }); if(content) content.classList.add('is-empty'); }
    function hideEmpty(){ if(content) content.classList.remove('is-empty'); }
    // (re)create a tab chip for a view, reusing the matching L1 leaf's icon + label
    function makeTab(v){
      var tabs=tabsEl(); if(!tabs) return null;
      var existing=tabFor(v); if(existing) return existing;
      var leaf=document.querySelector('.l1-leaf[data-view="'+v+'"]');
      var ic=(leaf && leaf.querySelector('.icon')) ? leaf.querySelector('.icon').outerHTML : '';
      var label=((leaf?leaf.textContent:'')||v||'').trim()||v;
      var tab=document.createElement('div');
      tab.className='ia-tab'; tab.setAttribute('data-view',v);
      // label MUST live in .ia-tab-lbl so it truncates with an ellipsis (a bare text node wraps).
      tab.innerHTML=ic+'<span class="ia-tab-lbl">'+label+'</span>'+CLOSE_SVG;
      tabs.insertBefore(tab, tabs.querySelector('.ia-tab-add')||null);
      return tab;
    }
    function openTab(v){
      if(!v) return;
      var rc=document.getElementById('route-context'); rc.classList.remove('mode-overview'); rc.classList.add('mode-editor');
      makeTab(v); hideEmpty(); activateTab(v); selectView(v);
    }
    function escAttr(v){ return String(v||'').replace(/["\\]/g,'\\$&'); }
    function activateLeaf(v){
      document.querySelectorAll('.l1-leaf[data-view]').forEach(function(l){ l.classList.toggle('active', l.dataset.view===v); });
    }
    function ensureContextEditor(){
      var app=document.getElementById('app');
      var routeIds={ home:'route-home', studio:'route-studio', context:'route-context', datalake:'route-datalake', space:'route-space' };
      Object.keys(routeIds).forEach(function(k){
        var el=document.getElementById(routeIds[k]);
        if(el) el.classList.toggle('active', k==='context');
      });
      if(app) app.dataset.route='context';
      document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.toggle('active', n.dataset.nav==='context'); });
      var rc=document.getElementById('route-context');
      if(rc){ rc.classList.remove('mode-overview'); rc.classList.add('mode-editor'); }
    }
    function forceView(v){
      var target=document.querySelector('.view[data-view="'+escAttr(v)+'"]');
      if(!target) return false;
      if(content){
        content.classList.remove('is-empty','fx-scene');
        content.style.height='';
      }
      document.querySelectorAll('.view.fx-face').forEach(function(face){
        face.classList.remove('fx-face');
        face.style.left=''; face.style.top=''; face.style.width=''; face.style.height='';
        face.style.transform=''; face.style.opacity='';
      });
      document.querySelectorAll('.view').forEach(function(s){ s.classList.toggle('active', s===target); });
      activateTab(v); activateLeaf(v);
      renderChartsIn(target); runCounters(target);
      return true;
    }
    function restoreScreen(screen){
      var s=screen||{};
      var v=s.viewId || s.id || s.tabViewId || (s.view && s.view.id);
      if(window.IA && typeof window.IA.exitSplitView==='function') window.IA.exitSplitView();
      ensureContextEditor();
      if(!v) return false;
      openTab(v);
      activateLeaf(v);
      if(!document.querySelector('.view[data-view="'+escAttr(v)+'"].active')) forceView(v);
      return true;
    }
    window.IA = window.IA || {};
    window.IA.restoreScreen = restoreScreen;
    function closeTab(tab){
      if(!tab) return;
      var wasActive=tab.classList.contains('active');
      var next=tab.nextElementSibling, prev=tab.previousElementSibling;
      tab.remove();
      if(wasActive){
        var pick=(next && next.matches('.ia-tab[data-view]')) ? next
               : ((prev && prev.matches('.ia-tab[data-view]')) ? prev
               : document.querySelector('.tabbar .tabs .ia-tab[data-view]'));
        if(pick){ activateTab(pick.dataset.view); selectView(pick.dataset.view); }
        else { showEmpty(); }
      } else if(!document.querySelector('.tabbar .tabs .ia-tab[data-view]')){ showEmpty(); }
    }

    // delegated editor-tab clicks: close via the x, otherwise activate (covers static, registered + reopened tabs)
    var tabs=tabsEl();
    if(tabs){
      tabs.addEventListener('click',function(e){
        var x=e.target.closest('.ia-x');
        if(x){ e.stopPropagation(); closeTab(x.closest('.ia-tab')); return; }
        var t=e.target.closest('.ia-tab[data-view]');
        if(t){ hideEmpty(); activateTab(t.dataset.view); selectView(t.dataset.view); }
      });
      // let a vertical mouse wheel scroll the tab strip horizontally (trackpads already do this)
      tabs.addEventListener('wheel',function(e){
        if(e.deltaY===0 || tabs.scrollWidth<=tabs.clientWidth) return;
        tabs.scrollLeft+=e.deltaY; e.preventDefault();
      },{passive:false});
    }

    // L1 leaves + overview rows open (and reopen) the editor on the right dashboard
    var map={'operations view':'order-management','order management':'order-management','purchase order':'purchase-order','rework and quality':'rework-quality','insights':'insights'};
    document.querySelectorAll('.l1-leaf, .ctx-overview .ovrow, .ctx-overview .sp-card, #route-context .ia-ov-card').forEach(function(el){
      el.addEventListener('click',function(){
        var t=(el.textContent||'').trim().toLowerCase(); var v=el.dataset.view||map[t];
        if(v){ openTab(v); }
        else {
          var rc=document.getElementById('route-context'); rc.classList.remove('mode-overview'); rc.classList.add('mode-editor');
          var av=document.querySelector('#content .view.active'); if(av){ renderChartsIn(av); runCounters(av); }
        }
      });
    });
    // gear / settings opens the prototype controls
    var proto=document.getElementById('proto');
    var g=document.querySelector('#l0 .gear'); if(g&&proto) g.addEventListener('click',function(e){e.stopPropagation(); proto.classList.toggle('open');});
    // #fab is wired in engine.js; binding it here too would double-toggle and never open the panel.
  })();
