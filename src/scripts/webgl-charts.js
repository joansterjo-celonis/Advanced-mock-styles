// ============================================================
//  WebGL 3D chart renderer  (Charts-look = "webgl").
//
//  A fully self-contained, three.js-based renderer that draws the
//  prototype's charts as real, interactive 3D scenes (perspective
//  camera, PBR materials, soft shadows, entrance animation, idle
//  auto-rotate, drag-to-orbit, raycast hover tooltips).
//
//  This is a SEPARATE renderer: the existing flat / iso / glass SVG
//  path in engine.js is never touched. engine.js only routes a chart
//  here when chartMode(wrap)==='webgl' (a new global / per-chart /
//  Theme-Creator option), and falls back to SVG if mount returns false.
//
//  Architecture — one shared GPU context:
//    The browser caps live WebGL contexts (~16), and the gallery views
//    render many charts at once. So we keep ONE THREE.WebGLRenderer and
//    blit each chart's render into its own 2D <canvas.webgl-chart>. A
//    single shared rAF loop renders only on-screen charts and disposes
//    instances whose wrap left the DOM.
// ============================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { series, rng, N, RQ_BARS, RQ_PIE, VIVID_COMBO_MAP, DEFAULT_VIVID_COMBO } from '../data/data.js';
import { cssVar, toRGB } from './effects.js';

/* ============================================================
   Small helpers (replicated from engine.js so we mirror the exact
   data each SVG chart draws — without importing/altering engine.js).
   ============================================================ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack  = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function fmt(n){ const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 2).replace(/\.?0+$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 2).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.?0+$/, '') + 'K';
  return String(Math.round(n)); }
function monthLabel(i){ const d = new Date(2022, i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

function activeVividChart(){ const c = VIVID_COMBO_MAP[document.documentElement.getAttribute('data-vivid-palette')] || VIVID_COMBO_MAP[DEFAULT_VIVID_COMBO]; return c.chart; }
function vividTint(key){ return document.documentElement.getAttribute('data-theme') === 'vivid' ? (activeVividChart()[key] || '#6366f1') : null; }
function shade(hex, p){ const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const t = p < 0 ? 0 : 255, a = Math.abs(p); r = Math.round((t - r) * a) + r; g = Math.round((t - g) * a) + g; b = Math.round((t - b) * a) + b; return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1); }

/* Resolve any colour spec (CSS var name, var(--x), hex, rgb()) against the
   wrap element so theme / hue / per-card invert all cascade — mirrors the
   cssVar('--cstop-1a', wrap) reads the SVG charts do. */
function resolveCssColor(c, el){
  if (c == null) return '#6366f1';
  let s = String(c).trim();
  if (s.startsWith('--')) return (cssVar(s, el) || '#6366f1');
  const m = /var\((--[^),]+)\)/.exec(s);
  if (m) return (cssVar(m[1], el) || '#6366f1');
  return s || '#6366f1';
}
function threeColor(c, el){
  const col = new THREE.Color();
  // THREE.Color.setStyle understands hex / rgb() / named colours, but NOT every CSS
  // Color-4 form — notably the space-separated hsl(220 52% 60%) emitted by the
  // single-hue palette ("Color" theme + custom hue), which silently left every WebGL
  // chart at the fallback colour. Normalise through the same canvas parser the SVG
  // charts use (toRGB), then hand setStyle a plain rgb() it always parses — this keeps
  // the sRGB interpretation identical to a direct setStyle for hex/rgb inputs.
  try {
    const { r, g, b } = toRGB(resolveCssColor(c, el));
    col.setStyle('rgb(' + r + ',' + g + ',' + b + ')');
  } catch (e) { col.set('#6366f1'); }
  return col;
}
// Push a colour's saturation (and optionally lightness) so it reads vividly under
// ACES tone-mapping — used for the process-graph flows so they really pop.
function vivify(col, sBoost, lShift){
  const hsl = { h: 0, s: 0, l: 0 }; col.getHSL(hsl);
  col.setHSL(hsl.h, clamp(hsl.s * (1 + (sBoost || 0)), 0, 1), clamp(hsl.l + (lShift || 0), 0, 1));
  return col;
}

/* ============================================================
   Stage singleton — one renderer + env map + shared rAF loop.
   ============================================================ */
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const maxAniso = () => { try { return renderer ? renderer.capabilities.getMaxAnisotropy() : 8; } catch (e) { return 8; } };
let renderer = null, envTex = null, raycaster = null;
let stageScene = null, keyLight = null, fillLight = null, hemiLight = null, groundMesh = null;
const registry = new Map();   // wrap -> instance
let rafId = 0, lastNow = 0;
let io = null;                // IntersectionObserver for on-screen culling

function ensureStage(){
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  } catch (e) { console.error('[webgl] WebGLRenderer unavailable', e); renderer = null; return false; }
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Studio environment for crisp PBR specular (kept off-screen; scene.background stays null → transparent).
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (e) { envTex = null; }
  raycaster = new THREE.Raycaster();

  // ONE shared scene + light rig + shadow map for every chart. Each chart's content
  // group is swapped into this scene just before its render (charts render one at a
  // time in the shared rAF loop), so GPU memory stays flat no matter how many charts
  // are on screen — a per-scene shadow map per chart would exhaust the GPU in galleries.
  stageScene = new THREE.Scene();
  stageScene.environment = envTex;
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x39414f, 0.55);
  stageScene.add(hemiLight);
  keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
  keyLight.castShadow = true;
  // Higher-res shadow map + a normal-bias kills the stair-stepped/jagged edges
  // (the previous 1024 map under-sampled larger scenes like the process graph).
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.022;
  keyLight.shadow.radius = 3;
  stageScene.add(keyLight); stageScene.add(keyLight.target);
  fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  stageScene.add(fillLight);
  groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.22 }));
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  stageScene.add(groundMesh);

  io = new IntersectionObserver(entries => {
    entries.forEach(en => { const inst = registry.get(en.target); if (inst) inst.visible = en.isIntersecting; });
  }, { root: null, rootMargin: '120px', threshold: 0 });
  return true;
}

// Aim the shared light rig + shadow camera + ground at the chart about to render.
function configureStageFor(inst){
  const R = inst.sphereR, c = inst.target;
  keyLight.position.set(c.x - R * 0.7, c.y + R * 1.6, c.z + R * 1.1);
  keyLight.target.position.copy(c); keyLight.target.updateMatrixWorld();
  const sc = keyLight.shadow.camera;
  // Tighter ortho frustum = more shadow texels per world-unit (sharper). Charts
  // keep the generous 1.9 margin for tall bars; the flat process map opts into a
  // snug fit (inst.shadowFit) so its slab shadows stay crisp.
  const f = inst.shadowFit || 1.9;
  sc.near = 0.1; sc.far = R * 6;
  sc.left = -R * f; sc.right = R * f; sc.top = R * f; sc.bottom = -R * f;
  sc.updateProjectionMatrix();
  fillLight.position.set(c.x + R * 1.2, c.y + R * 0.6, c.z + R * 0.4);
  groundMesh.position.set(c.x, 0, c.z);
}

function startLoop(){ if (!rafId) { lastNow = performance.now(); rafId = requestAnimationFrame(tick); } }
function stopLoop(){ if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

function tick(now){
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - lastNow) / 1000) || 0.016; lastNow = now;
  for (const [wrap, inst] of registry) {
    if (!document.contains(wrap)) { teardown(wrap); continue; }
    if (!inst.visible) continue;
    const w = wrap.clientWidth | 0;
    const h = (inst.fallbackH ? Math.max(wrap.clientHeight | 0, inst.fallbackH) : wrap.clientHeight | 0);
    if (w < 4 || h < 4) continue;
    updateInstance(inst, dt);
    drawInstance(inst, w, h);
  }
  if (!registry.size) stopLoop();
}

function updateInstance(inst, dt){
  // entrance reveal
  if (inst.reveal < 1) { inst.reveal = clamp(inst.reveal + dt / inst.revealDur, 0, 1); applyReveal(inst); }
  // navigation flythrough (eased enter/exit; the dot loops along the route)
  if (inst.fly) {
    const fly = inst.fly, target = fly.on ? 1 : 0;
    if (fly.blend !== target) fly.blend = clamp(fly.blend + (target > fly.blend ? 1 : -1) * dt / 0.6, 0, 1);
    if (inst.flyRoute && (fly.on || fly.blend > 0)) { fly.t += dt / fly.dur; if (fly.t > 1) fly.t -= 1; }
    if (fly.dot) { const vis = fly.blend > 0.02; fly.dot.visible = vis; if (vis && inst.flyRoute) fly.dot.position.copy(inst.flyRoute.getPointAt(clamp(fly.t, 0, 1))); }
  }
  // idle motion (paused while dragging, hovering a datum, or flying)
  const flying = inst.fly && (inst.fly.on || inst.fly.blend > 0.001);
  const idle = !inst.drag && !inst.hovered && inst.reveal >= 1 && !flying;
  if (idle && !inst.userMoved) {
    inst.clock += dt;
    if (inst.sway) inst.az = inst.baseAz + Math.sin(inst.clock * 0.5) * inst.swayAmp;
    else inst.az += inst.autoRotate * dt;
  }
}

function applyReveal(inst){
  const t = inst.revealAxis === 'uniform' ? (0.55 + 0.45 * easeOutBack(inst.reveal)) : easeOutBack(inst.reveal);
  const s = Math.max(0.0001, t);
  const c = inst.content;
  if (inst.revealAxis === 'x') c.scale.set(s, 1, 1);
  else if (inst.revealAxis === 'uniform') c.scale.set(s, s, s);
  else c.scale.set(1, s, 1);
}

const _tmpV = new THREE.Vector3();

// Camera distance that makes the chart fill the card as much as possible.
// Instead of fitting the rotation-invariant bounding *sphere* (which leaves wide/flat
// charts tiny — sphere ⌀ ≈ chart width crammed into the card height), we fit the
// chart's bounding-box silhouette as projected at its RESTING pose. Distance is fixed
// vs. the live orbit angle, so dragging/sway never makes it "breathe"; it just clips
// gracefully at extreme angles (acceptable per the spec).
function fitRadius(inst, aspect){
  const vFov = inst.camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.0001, aspect));
  const az = inst.fitAz, el = inst.fitEl;
  const dir = _tmpV.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)); // target → camera
  const fwd = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  let halfW = 0.001, halfH = 0.001;
  const c = inst.target;
  const corners = inst.boxCorners || [];
  for (const corner of corners) {
    const v = corner.clone().sub(c);
    halfW = Math.max(halfW, Math.abs(v.dot(right)));
    halfH = Math.max(halfH, Math.abs(v.dot(up)));
  }
  const distV = halfH / Math.tan(vFov / 2);
  const distH = halfW / Math.tan(hFov / 2);
  return Math.max(distV, distH) * inst.fitMargin;
}

function placeCamera(inst, aspect){
  const cam = inst.camera;
  // inst.zoom (mouse-wheel) scales the fitted distance: <1 closer, >1 farther.
  const R = fitRadius(inst, aspect) * (inst.zoom || 1);
  const c = inst.target, el = inst.el, az = inst.az;
  cam.position.set(
    c.x + R * Math.cos(el) * Math.sin(az),
    c.y + R * Math.sin(el),
    c.z + R * Math.cos(el) * Math.cos(az)
  );
  // Depth clipping bounded by the (rotation-invariant) sphere so it's safe at any orbit angle.
  cam.near = Math.max(0.02, R - inst.sphereR - 1);
  cam.far = R + inst.sphereR + 1;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.lookAt(c);
}

// Resting orbit pose (target → camera) written into out vectors, no side effects.
function orbitPose(inst, aspect, outPos, outTarget){
  const R = fitRadius(inst, aspect) * (inst.zoom || 1);
  const c = inst.target, el = inst.el, az = inst.az;
  outPos.set(c.x + R * Math.cos(el) * Math.sin(az), c.y + R * Math.sin(el), c.z + R * Math.cos(el) * Math.cos(az));
  outTarget.copy(c);
}

// Chase/POV pose along the flythrough route (Google-Maps style: a touch behind and
// above the dot, looking just ahead so the labels sweep past).
const _flyFwd = new THREE.Vector3();
function flyPose(inst, outPos, outTarget){
  const route = inst.flyRoute, t = clamp(inst.fly.t, 0, 1);
  const here = inst.content.localToWorld(route.getPointAt(t));
  const ahead = inst.content.localToWorld(route.getPointAt(clamp(t + 0.018, 0, 1)));
  const behind = inst.content.localToWorld(route.getPointAt(clamp(t - 0.024, 0, 1)));
  _flyFwd.copy(ahead).sub(behind); _flyFwd.y = 0;
  if (_flyFwd.lengthSq() < 1e-8) _flyFwd.set(0, 0, 1); else _flyFwd.normalize();
  outPos.copy(here).addScaledVector(_flyFwd, -inst.fly.dist); outPos.y += inst.fly.height;
  outTarget.copy(ahead); outTarget.y += inst.fly.look;
}

const _camPosA = new THREE.Vector3(), _camPosB = new THREE.Vector3();
const _camTgtA = new THREE.Vector3(), _camTgtB = new THREE.Vector3(), _camTgt = new THREE.Vector3();
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Blend between resting orbit and the flythrough POV (smooth enter/exit).
function applyCamera(inst, aspect){
  const cam = inst.camera, fly = inst.fly;
  if (fly && fly.blend > 0.001 && inst.flyRoute) {
    inst.content.updateMatrixWorld(true);
    orbitPose(inst, aspect, _camPosA, _camTgtA);
    flyPose(inst, _camPosB, _camTgtB);
    const b = easeInOut(clamp(fly.blend, 0, 1));
    const base = inst.baseFov != null ? inst.baseFov : cam.fov;
    cam.position.lerpVectors(_camPosA, _camPosB, b);
    _camTgt.lerpVectors(_camTgtA, _camTgtB, b);
    cam.fov = base + (fly.fov - base) * b;
    cam.near = 0.04; cam.far = Math.max(50, inst.sphereR * 8);
    cam.aspect = aspect; cam.updateProjectionMatrix();
    cam.lookAt(_camTgt);
  } else {
    if (inst.baseFov != null && cam.fov !== inst.baseFov) cam.fov = inst.baseFov;
    placeCamera(inst, aspect);
  }
}

function drawInstance(inst, w, h){
  const dpr = DPR();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  applyCamera(inst, w / h);
  // Swap this chart's content into the shared scene, render, then detach so the
  // next chart reuses the same lights / shadow map.
  configureStageFor(inst);
  stageScene.add(inst.content);
  renderer.render(stageScene, inst.camera);
  stageScene.remove(inst.content);
  const cv = inst.canvas, cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  const ctx = inst.ctx;
  ctx.clearRect(0, 0, cw, ch);
  try { ctx.drawImage(renderer.domElement, 0, 0, cw, ch); } catch (e) { /* drawing buffer not ready */ }
}

/* ============================================================
   Geometry / material helpers.
   ============================================================ */
function pbrMaterial(colorHex, wrap, opts){
  opts = opts || {};
  const m = new THREE.MeshPhysicalMaterial({
    color: threeColor(colorHex, wrap),
    metalness: opts.metalness != null ? opts.metalness : 0.16,
    roughness: opts.roughness != null ? opts.roughness : 0.34,
    clearcoat: opts.clearcoat != null ? opts.clearcoat : 0.55,
    clearcoatRoughness: 0.32,
    envMapIntensity: opts.env != null ? opts.env : 0.9,
    transparent: !!opts.transparent,
    opacity: opts.opacity != null ? opts.opacity : 1,
  });
  m.userData.baseColor = m.color.clone();
  return m;
}

const _sphereGeo = new THREE.SphereGeometry(1, 32, 24);

function addPickable(inst, mesh, tip, opts){
  opts = opts || {};
  inst.pickables.push({ mesh, tip, explode: opts.explode || null });
  inst.pickMap.set(mesh, inst.pickables[inst.pickables.length - 1]);
}

/* Hover: emissive lift (+ optional pie "explode") and tooltip wiring. */
function setHover(inst, pick){
  if (inst.hovered === pick) return;
  clearHover(inst);
  inst.hovered = pick;
  if (!pick) { inst.canvas.removeAttribute('data-ctip'); inst.canvas.removeAttribute('data-ctip-rows'); return; }
  const mat = pick.mesh.material;
  if (mat && mat.emissive) { mat.userData.emis = mat.emissive.getHex(); mat.emissive.copy(mat.color).multiplyScalar(0.35); }
  if (pick.explode) { pick.mesh.userData.base = pick.mesh.position.clone(); pick.mesh.position.addScaledVector(pick.explode, 0.38); }
  const t = pick.tip || {};
  if (t.title != null) inst.canvas.setAttribute('data-ctip', String(t.title)); else inst.canvas.removeAttribute('data-ctip');
  if (t.rows && t.rows.length) inst.canvas.setAttribute('data-ctip-rows', t.rows.map(r => r[0] + '\u001f' + r[1]).join('\u001e'));
  else inst.canvas.removeAttribute('data-ctip-rows');
}
function clearHover(inst){
  const pick = inst.hovered; if (!pick) return;
  const mat = pick.mesh.material;
  if (mat && mat.emissive && mat.userData.emis != null) mat.emissive.setHex(mat.userData.emis);
  if (pick.explode && pick.mesh.userData.base) pick.mesh.position.copy(pick.mesh.userData.base);
  inst.hovered = null;
  inst.canvas.removeAttribute('data-ctip'); inst.canvas.removeAttribute('data-ctip-rows');
}

function pickHover(inst, e){
  const rect = inst.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  // content is only parented to the shared scene during its own render frame, so
  // refresh its world matrices before raycasting against the detached group.
  inst.content.updateMatrixWorld(true);
  raycaster.setFromCamera({ x, y }, inst.camera);
  const hits = raycaster.intersectObjects(inst.pickRoots, true);
  let pick = null;
  for (const hit of hits) { let o = hit.object; while (o && !inst.pickMap.has(o)) o = o.parent; if (o) { pick = inst.pickMap.get(o); break; } }
  setHover(inst, pick);
}

/* ============================================================
   Per-family builders. Each pushes meshes into `inst.content`,
   registers pickables, and sets view defaults. World units: the main
   axis spans ~[-AX, AX]; heights rise to ~H. Camera framing normalises
   absolute scale so these are just proportions.
   ============================================================ */
const AX = 5;     // half-span of the primary (category / x) axis
const H = 5.4;    // nominal max height

function castAll(g){ g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } }); }

/* ---- bars: vertical / horizontal, simple / grouped / stacked ---- */
function buildBars(inst, wrap, model){
  const content = inst.content;
  const n = Math.max(1, model.cats.length);
  const G = Math.max(1, model.series.length);
  const horiz = model.orientation === 'h';
  const max = model.max || 1;

  if (horiz) {
    // categories along Z (rows receding), value along X (grows from x=0)
    const depthSpan = 2 * AX;                          // reuse AX as half-depth
    const slot = (2 * depthSpan) / n;                   // along Z
    const thick = Math.min(slot * 0.62, 1.1);           // Y thickness (slab)
    const barDepth = Math.min(slot * 0.7, 1.6);         // Z size of each row
    for (let i = 0; i < n; i++) {
      const z = -depthSpan + slot * (i + 0.5);
      let xStart = 0;
      for (let s = 0; s < G; s++) {
        const v = model.matrix[i][s] || 0;
        const len = Math.max(0.02, (Math.min(v, max) / max) * (2 * AX));
        const colHex = model.cellColor ? (model.cellColor(i, s) || model.series[s].color) : model.series[s].color;
        const geo = new RoundedBoxGeometry(len, thick, barDepth, 3, Math.min(0.12, thick * 0.3));
        const mat = pbrMaterial(colHex, wrap);
        const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
        mesh.position.set(xStart + len / 2, thick / 2, z);
        content.add(mesh);
        inst.disposables.push(geo, mat);
        addPickable(inst, mesh, model.tip(i, s));
        if (model.stacked) xStart += len; // stacked grows along X
      }
    }
    inst.revealAxis = 'x'; inst.ground = true; inst.viewAz = 0.62; inst.viewEl = 0.5; inst.sway = true; inst.swayAmp = 0.16;
  } else {
    // categories along X, value up (+Y); series grouped along Z or stacked up Y
    const slot = (2 * AX) / n;
    const groupDepth = model.grouped ? Math.min(slot * 0.78, 2.6) : Math.min(slot * 0.6, 1.4);
    const barW = model.grouped ? (slot * 0.62) / G : slot * 0.6;
    const barDepth = model.grouped ? Math.max(0.3, groupDepth / G * 0.78) : Math.min(slot * 0.6, 1.4);
    for (let i = 0; i < n; i++) {
      const x = -AX + slot * (i + 0.5);
      let yStart = 0;
      for (let s = 0; s < G; s++) {
        const v = model.matrix[i][s] || 0;
        const hgt = Math.max(0.02, (Math.min(v, max) / max) * H);
        const colHex = model.cellColor ? (model.cellColor(i, s) || model.series[s].color) : model.series[s].color;
        const geo = new RoundedBoxGeometry(barW, hgt, barDepth, 3, Math.min(0.1, barW * 0.18, hgt * 0.3));
        const mat = pbrMaterial(colHex, wrap);
        const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
        const z = model.grouped ? (-groupDepth / 2 + groupDepth * (s + 0.5) / G) : 0;
        mesh.position.set(x, model.stacked ? yStart + hgt / 2 : hgt / 2, z);
        content.add(mesh);
        inst.disposables.push(geo, mat);
        addPickable(inst, mesh, model.tip(i, s));
        if (model.stacked) yStart += hgt;
      }
      if (model.labels && n <= 14 && model.cats[i] != null) addAxisLabel(inst, wrap, String(model.cats[i]), x, 0, model.grouped ? 0 : barDepth * 0.6 + 0.2);
    }
    inst.revealAxis = 'y'; inst.ground = true; inst.viewAz = 0.6; inst.viewEl = 0.48; inst.sway = true; inst.swayAmp = 0.16;
  }
  if (model.line) buildOverlayLine(inst, wrap, model.line, n);
}

/* combo's secondary line, drawn above the bars (normalised to its own max) */
function buildOverlayLine(inst, wrap, line, n){
  const pts = [];
  const slot = (2 * AX) / n;
  const mx = line.max || Math.max(...line.values) || 1;
  line.values.forEach((v, i) => { const x = -AX + slot * (i + 0.5); const y = (Math.min(v, mx) / mx) * H; pts.push(new THREE.Vector3(x, y + 0.05, 0)); });
  if (pts.length < 2) return;
  const col = resolveCssColor(line.color, wrap);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 6), 0.05, 12, false);
  const mat = pbrMaterial(col, wrap, { roughness: 0.25, clearcoat: 0.8 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  inst.content.add(mesh); inst.disposables.push(geo, mat);
  pts.forEach(p => { const m = new THREE.Mesh(_sphereGeo, pbrMaterial(col, wrap, { roughness: 0.2 })); m.scale.setScalar(0.1); m.position.copy(p); m.castShadow = true; inst.content.add(m); inst.disposables.push(m.material); });
}

/* ---- pie / donut: a flat extruded disc, sectors as cylinder wedges ---- */
function buildPie(inst, wrap, model){
  const content = inst.content;
  const R = 4, depth = 1.3, inner = model.donut ? R * 0.52 : 0;
  let ang = -Math.PI / 2;
  model.segs.forEach(sg => {
    const theta = Math.max(0.0001, (sg.pct / 100) * Math.PI * 2);
    const a0 = ang, a1 = ang + theta; ang = a1;
    let geo;
    if (inner > 0) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, R, a0, a1, false);
      shape.absarc(0, 0, inner, a1, a0, true);
      geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 48 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, depth, 0);
    } else {
      geo = new THREE.CylinderGeometry(R, R, depth, 64, 1, false, a0, theta);
      geo.translate(0, depth / 2, 0);
    }
    const mat = pbrMaterial(sg.color, wrap, { roughness: 0.28, clearcoat: 0.7 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
    content.add(mesh); inst.disposables.push(geo, mat);
    // Outward "explode" direction = the sector's own centroid projected to the ground
    // plane. Derive it from the built geometry (CylinderGeometry uses x=sinθ/z=cosθ and
    // the donut shape is rotated), so a hovered slice always pulls straight outward.
    geo.computeBoundingBox();
    const bc = geo.boundingBox.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(bc.x, 0, bc.z);
    if (dir.lengthSq() < 1e-6) { const mid = (a0 + a1) / 2; dir.set(Math.cos(mid), 0, Math.sin(mid)); }
    dir.normalize();
    addPickable(inst, mesh, { title: sg.label, rows: [['Share', sg.pct.toFixed(2) + '%']] }, { explode: dir });
  });
  inst.revealAxis = 'uniform'; inst.ground = true; inst.viewAz = 0.5; inst.viewEl = 0.62; inst.autoRotate = 0.26;
  // Pies/donuts read small in their cards, so frame them tighter than the default
  // 1.06 — fill more of the space (mild edge clipping is fine; they auto-rotate).
  inst.fitMargin = 0.85;
}

/* ---- line / area: tube line(s) + markers; area gets an extruded ribbon ---- */
function buildLine(inst, wrap, model){
  const content = inst.content;
  const mx = model.max || 1;
  const seriesCount = model.series.length;
  model.series.forEach((s, si) => {
    const pts3 = [];
    const m = s.pts.length;
    const zoff = seriesCount > 1 ? (-0.9 + 1.8 * si / Math.max(1, seriesCount - 1)) : 0;
    s.pts.forEach((v, i) => { const x = -AX + (m > 1 ? (2 * AX) * i / (m - 1) : AX); const y = (Math.min(v, mx) / mx) * H; pts3.push(new THREE.Vector3(x, y, zoff)); });
    const col = resolveCssColor(s.color, wrap);
    if (model.area && pts3.length > 1) {
      const shape = new THREE.Shape();
      shape.moveTo(pts3[0].x, pts3[0].y);
      for (let i = 1; i < pts3.length; i++) shape.lineTo(pts3[i].x, pts3[i].y);
      shape.lineTo(pts3[pts3.length - 1].x, 0);
      shape.lineTo(pts3[0].x, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false, curveSegments: 12 });
      geo.translate(0, 0, zoff - 0.35);
      const mat = pbrMaterial(col, wrap, { transparent: true, opacity: 0.62, roughness: 0.4, clearcoat: 0.4 });
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
      content.add(mesh); inst.disposables.push(geo, mat);
    }
    if (pts3.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(pts3, false, 'catmullrom', 0.35);
      const geo = new THREE.TubeGeometry(curve, Math.max(28, pts3.length * 7), 0.055, 12, false);
      const mat = pbrMaterial(col, wrap, { roughness: 0.24, clearcoat: 0.8 });
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
      content.add(mesh); inst.disposables.push(geo, mat);
    }
    s.pts.forEach((v, i) => {
      const p = pts3[i];
      const mat = pbrMaterial(col, wrap, { roughness: 0.2 });
      const mk = new THREE.Mesh(_sphereGeo, mat); mk.scale.setScalar(0.11); mk.position.copy(p); mk.castShadow = true;
      content.add(mk); inst.disposables.push(mat);
      addPickable(inst, mk, model.tip(si, i));
    });
  });
  inst.revealAxis = 'y'; inst.ground = false; inst.sway = true; inst.viewAz = 0.32; inst.viewEl = 0.24;
}

/* ---- scatter / bubble: spheres in a standing XY plane ---- */
function buildScatter(inst, wrap, model){
  const content = inst.content;
  const col = resolveCssColor(model.color, wrap);
  model.pts.forEach(p => {
    const x = -AX + (Math.min(p.x, model.xmax) / model.xmax) * (2 * AX);
    const y = (Math.min(p.y, model.ymax) / model.ymax) * H;
    const r = model.bubble ? (0.18 + Math.sqrt((p.size / model.smax) || 0) * 0.7) : (p.color ? 0.24 : 0.16);
    const mat = pbrMaterial(p.color ? resolveCssColor(p.color, wrap) : col, wrap, { roughness: 0.22, clearcoat: 0.7, transparent: model.bubble, opacity: model.bubble ? 0.82 : 1 });
    const mesh = new THREE.Mesh(_sphereGeo, mat); mesh.scale.setScalar(r); mesh.position.set(x, y, 0); mesh.castShadow = true;
    content.add(mesh); inst.disposables.push(mat);
    addPickable(inst, mesh, p.tip);
  });
  if (model.trend && model.trendPts) {
    const a = model.trendPts;
    const x0 = -AX + (a[0][0] / model.xmax) * (2 * AX), y0 = (clamp(a[0][1], 0, model.ymax) / model.ymax) * H;
    const x1 = -AX + (a[1][0] / model.xmax) * (2 * AX), y1 = (clamp(a[1][1], 0, model.ymax) / model.ymax) * H;
    const curve = new THREE.LineCurve3(new THREE.Vector3(x0, y0, 0), new THREE.Vector3(x1, y1, 0));
    const geo = new THREE.TubeGeometry(curve, 1, 0.05, 8, false);
    const mat = pbrMaterial(col, wrap, { roughness: 0.4, opacity: 0.6, transparent: true });
    const mesh = new THREE.Mesh(geo, mat); content.add(mesh); inst.disposables.push(geo, mat);
  }
  inst.revealAxis = 'uniform'; inst.ground = false; inst.sway = true; inst.viewAz = 0.3; inst.viewEl = 0.26;
}

/* ---- dot plot: horizontal lollipops in a standing plane (rows up Y) ---- */
function buildDotplot(inst, wrap, model){
  const content = inst.content;
  const col = resolveCssColor(model.color, wrap);
  const n = Math.max(1, model.dots.length);
  const span = model.xmax - model.xmin || 1;
  model.dots.forEach((d, i) => {
    const y = n > 1 ? H * (1 - i / (n - 1)) * 0.92 + 0.2 : H / 2;
    const xv = -AX + ((d.v - model.xmin) / span) * (2 * AX);
    const x0 = -AX;
    const curve = new THREE.LineCurve3(new THREE.Vector3(x0, y, 0), new THREE.Vector3(xv, y, 0));
    const sgeo = new THREE.TubeGeometry(curve, 1, 0.03, 6, false);
    const smat = pbrMaterial(col, wrap, { roughness: 0.5, opacity: 0.5, transparent: true });
    content.add(new THREE.Mesh(sgeo, smat)); inst.disposables.push(sgeo, smat);
    const mat = pbrMaterial(col, wrap, { roughness: 0.22, clearcoat: 0.7 });
    const mesh = new THREE.Mesh(_sphereGeo, mat); mesh.scale.setScalar(0.22); mesh.position.set(xv, y, 0); mesh.castShadow = true;
    content.add(mesh); inst.disposables.push(mat);
    addPickable(inst, mesh, d.tip);
  });
  inst.revealAxis = 'x'; inst.ground = false; inst.sway = true; inst.viewAz = 0.26; inst.viewEl = 0.22;
}

/* ---- heatmap: 3D bar grid, height + colour encode value ---- */
function buildHeatmap(inst, wrap, model){
  const content = inst.content;
  const nc = Math.max(1, model.cols.length), nr = Math.max(1, model.rows.length);
  const cw = (2 * AX) / nc, cd = (2 * AX) / nr;
  const stops = ['--cstop-1b', '--cstop-1a', '--cstop-2a', '--cstop-3a', '--cstop-4a'].map(v => threeColor(v, wrap));
  const ramp = t => { if (stops.length === 1) return stops[0]; const p = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p)), f = p - i; return stops[i].clone().lerp(stops[i + 1], f); };
  const span = model.vmax - model.vmin || 1;
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const v = (model.matrix[r] && model.matrix[r][c]) || 0;
    const t = clamp((v - model.vmin) / span, 0, 1);
    const hgt = 0.25 + t * H;
    const geo = new RoundedBoxGeometry(cw * 0.86, hgt, cd * 0.86, 2, Math.min(0.08, cw * 0.1));
    const mat = new THREE.MeshPhysicalMaterial({ color: ramp(t), metalness: 0.12, roughness: 0.34, clearcoat: 0.5, envMapIntensity: 0.9 });
    mat.userData.baseColor = mat.color.clone();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
    mesh.position.set(-AX + cw * (c + 0.5), hgt / 2, -AX + cd * (r + 0.5));
    content.add(mesh); inst.disposables.push(geo, mat);
    addPickable(inst, mesh, { title: model.rows[r] + ' \u00b7 ' + model.cols[c], rows: [['Value', fmt(v) + (model.unit ? ' ' + model.unit : '')]] });
  }
  inst.revealAxis = 'y'; inst.ground = true; inst.viewAz = 0.62; inst.viewEl = 0.6; inst.sway = true; inst.swayAmp = 0.16;
}

/* ---- box plot: IQR box + whiskers + median, categories along X ---- */
function buildBoxplot(inst, wrap, model){
  const content = inst.content;
  const n = Math.max(1, model.boxes.length);
  const slot = (2 * AX) / n;
  const bw = Math.min(slot * 0.5, 1.4);
  const col = resolveCssColor(model.color, wrap);
  const span = model.ymax - model.ymin || 1;
  const sy = v => ((v - model.ymin) / span) * H;
  model.boxes.forEach((b, i) => {
    const x = -AX + slot * (i + 0.5);
    const mn = b[1], q1 = b[2], med = b[3], q3 = b[4], mx = b[5];
    const boxH = Math.max(0.05, sy(q3) - sy(q1));
    const geo = new RoundedBoxGeometry(bw, boxH, bw, 2, Math.min(0.08, bw * 0.16, boxH * 0.3));
    const mat = pbrMaterial(col, wrap, { transparent: true, opacity: 0.78, roughness: 0.3, clearcoat: 0.6 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.position.set(x, (sy(q1) + sy(q3)) / 2, 0);
    content.add(mesh); inst.disposables.push(geo, mat);
    addPickable(inst, mesh, { title: String(b[0]), rows: [['Max', fmt(mx)], ['Q3', fmt(q3)], ['Median', fmt(med)], ['Q1', fmt(q1)], ['Min', fmt(mn)]] });
    // whiskers
    const wcol = resolveCssColor(col, wrap);
    [[mx, q3], [q1, mn]].forEach(seg => { const g = new THREE.CylinderGeometry(0.04, 0.04, Math.max(0.02, sy(seg[0]) - sy(seg[1])), 8); const mt = pbrMaterial(wcol, wrap, { roughness: 0.5 }); const ms = new THREE.Mesh(g, mt); ms.position.set(x, (sy(seg[0]) + sy(seg[1])) / 2, 0); content.add(ms); inst.disposables.push(g, mt); });
    // median plate
    const mg = new THREE.BoxGeometry(bw * 1.02, 0.06, bw * 1.02); const mm = pbrMaterial('#ffffff', wrap, { roughness: 0.3 }); const mmesh = new THREE.Mesh(mg, mm); mmesh.position.set(x, sy(med), 0); content.add(mmesh); inst.disposables.push(mg, mm);
  });
  inst.revealAxis = 'y'; inst.ground = true; inst.viewAz = 0.5; inst.viewEl = 0.42; inst.sway = true; inst.swayAmp = 0.16;
}

/* ---- extruded outline shapes: violin (per group) & density (single) ---- */
function buildShape(inst, wrap, model){
  const content = inst.content;
  if (model.kind === 'violin') {
    const n = Math.max(1, model.groups.length);
    const slot = (2 * AX) / n;
    const halfW = Math.min(slot * 0.4, 1.6);
    model.groups.forEach((g, gi) => {
      const cx = -AX + slot * (gi + 0.5);
      const col = resolveCssColor(g.color, wrap);
      const shape = new THREE.Shape();
      const M = g.dens.length;
      g.dens.forEach((p, i) => { const y = (p.t) * H; const w = p.d * halfW; if (i === 0) shape.moveTo(w, y); else shape.lineTo(w, y); });
      for (let i = M - 1; i >= 0; i--) { const y = g.dens[i].t * H; const w = g.dens[i].d * halfW; shape.lineTo(-w, y); }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1, curveSegments: 8 });
      geo.translate(cx, 0, -0.4);
      const mat = pbrMaterial(col, wrap, { roughness: 0.32, clearcoat: 0.5 });
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
      content.add(mesh); inst.disposables.push(geo, mat);
      addPickable(inst, mesh, g.tip);
    });
  } else {
    const col = resolveCssColor(model.color, wrap);
    const shape = new THREE.Shape();
    model.dens.forEach((p, i) => { const x = -AX + p.t * (2 * AX); const y = p.d * H; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
    shape.lineTo(AX, 0); shape.lineTo(-AX, 0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, -0.45);
    const mat = pbrMaterial(col, wrap, { roughness: 0.34, clearcoat: 0.5, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
    content.add(mesh); inst.disposables.push(geo, mat);
    addPickable(inst, mesh, model.tip);
  }
  inst.revealAxis = 'y'; inst.ground = false; inst.sway = true; inst.viewAz = 0.3; inst.viewEl = 0.24;
}

/* ---- funnel: stacked extruded trapezoids (top→bottom) ---- */
function buildFunnel(inst, wrap, model){
  const content = inst.content;
  const n = model.stages.length;
  const vmax = Math.max(...model.stages.map(s => s.value)) || 1;
  const rh = H / n;
  const stops = ['--cstop-1a', '--cstop-2a', '--cstop-3a', '--cstop-4a', '--legend-2', '--legend-1'];
  model.stages.forEach((s, i) => {
    const wTop = (s.value / vmax) * (2 * AX);
    const wBot = ((i < n - 1 ? model.stages[i + 1].value : s.value * 0.78) / vmax) * (2 * AX);
    const yT = H - rh * i, yB = H - rh * (i + 1) + rh * 0.16;
    const col = resolveCssColor(stops[i % stops.length], wrap);
    const shape = new THREE.Shape();
    shape.moveTo(-wTop / 2, yT); shape.lineTo(wTop / 2, yT); shape.lineTo(wBot / 2, yB); shape.lineTo(-wBot / 2, yB); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 2 });
    geo.translate(0, 0, -0.55);
    const mat = pbrMaterial(col, wrap, { roughness: 0.3, clearcoat: 0.6 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
    content.add(mesh); inst.disposables.push(geo, mat);
    addPickable(inst, mesh, s.tip);
  });
  inst.revealAxis = 'y'; inst.ground = false; inst.sway = true; inst.viewAz = 0.3; inst.viewEl = 0.22;
}

/* ---- bullet: bands + measure bar + target (horizontal) ---- */
function buildBullet(inst, wrap, model){
  const content = inst.content;
  const sx = v => (Math.min(v, model.max) / model.max) * (2 * AX);
  const col = resolveCssColor(model.color, wrap);
  const edges = [0, ...model.bands, model.max];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = sx(edges[i]), x1 = sx(edges[i + 1]), len = Math.max(0.02, x1 - x0);
    const op = 0.12 + 0.07 * (edges.length - 2 - i);
    const geo = new THREE.BoxGeometry(len, 0.5, 2.2);
    const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0x8a8d98), roughness: 0.6, metalness: 0.0, transparent: true, opacity: op });
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.position.set(x0 + len / 2, 0.25, 0);
    content.add(mesh); inst.disposables.push(geo, mat);
  }
  const len = Math.max(0.05, sx(model.value));
  const geo = new RoundedBoxGeometry(len, 0.85, 1.0, 3, 0.1);
  const mat = pbrMaterial(col, wrap, { roughness: 0.28, clearcoat: 0.7 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.position.set(len / 2, 0.45, 0);
  content.add(mesh); inst.disposables.push(geo, mat);
  addPickable(inst, mesh, model.tip);
  if (!isNaN(model.target)) {
    const tx = sx(model.target);
    const tg = new THREE.BoxGeometry(0.12, 1.5, 2.6); const tm = pbrMaterial('--text', wrap, { roughness: 0.4 });
    const tmesh = new THREE.Mesh(tg, tm); tmesh.position.set(tx, 0.75, 0); tmesh.castShadow = true;
    content.add(tmesh); inst.disposables.push(tg, tm);
  }
  inst.revealAxis = 'x'; inst.ground = true; inst.viewAz = 0.5; inst.viewEl = 0.4; inst.sway = true; inst.swayAmp = 0.14;
}

/* category label sprite (subtle, faces the camera) */
function addAxisLabel(inst, wrap, text, x, y, z){
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 56; ctx.font = '600 ' + fs + 'px Inter, sans-serif';
  const tw = Math.ceil(ctx.measureText(text).width) + 16;
  c.width = tw; c.height = fs + 16;
  ctx.font = '600 ' + fs + 'px Inter, sans-serif';
  ctx.fillStyle = resolveCssColor('--text-dim', wrap) || '#9aa0aa';
  ctx.textBaseline = 'middle'; ctx.fillText(text, 8, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat); const sc = 0.34; sp.scale.set((tw / c.height) * sc * 2.2, sc * 1.0, 1);
  sp.position.set(x, y - 0.4, z);
  inst.content.add(sp); inst.disposables.push(tex, mat);
}

const BUILDERS = {
  bars: buildBars, pie: buildPie, line: buildLine, scatter: buildScatter,
  dotplot: buildDotplot, heatmap: buildHeatmap, boxplot: buildBoxplot,
  shape: buildShape, funnel: buildFunnel, bullet: buildBullet,
};

/* ============================================================
   modelFor(wrap, type) — mirror the exact data each SVG chart draws.
   Returns { family, ...fields } consumed by the family builders.
   ============================================================ */
function parse(wrap, key, def){ try { const v = JSON.parse(wrap.dataset[key] || 'null'); return v == null ? def : v; } catch (e) { return def; } }

function modelFor(wrap, type){
  switch (type) {
    case 'combo': return modelCombo(wrap);
    case 'donut': return modelDonut(wrap);
    case 'pie': return wrap.dataset.segs ? modelPieGen(wrap) : modelPieRQ(wrap);
    case 'pieGen': return modelPieGen(wrap);
    case 'area': return modelArea(wrap);
    case 'durline': return modelDurline(wrap);
    case 'linechart': return modelLinechart(wrap);
    case 'dots': return modelDots(wrap);
    case 'pbars': return modelPbars(wrap);
    case 'otd-class': return modelOtdClass(wrap);
    case 'otd-hist': return modelOtdHist(wrap);
    case 'otd-dev': return modelOtdDev(wrap);
    case 'freqhist': return modelFreqhist(wrap);
    case 'hbars': return modelHbars(wrap);
    case 'hbarcat': return modelHbarcat(wrap);
    case 'barcat': return modelBarcat(wrap);
    case 'groupbars': return modelGroupbars(wrap);
    case 'stackbars': return modelStackbars(wrap);
    case 'hstackbars': return modelHstackbars(wrap);
    case 'histogram': return modelHistogram(wrap);
    case 'scatter': return modelScatter(wrap);
    case 'bubble': return modelBubble(wrap);
    case 'dotplot': return modelDotplot(wrap);
    case 'heatmap': return modelHeatmap(wrap);
    case 'boxplot': return modelBoxplot(wrap);
    case 'violin': return modelViolin(wrap);
    case 'density': return modelDensity(wrap);
    case 'funnel': return modelFunnel(wrap);
    case 'bullet': return modelBullet(wrap);
  }
  return null;
}

function modelCombo(wrap){
  const key = wrap.dataset.key, rightMax = parseFloat(wrap.dataset.rightmax) || 40, leftLabel = wrap.dataset.leftlabel || '';
  const n = Math.max(2, parseInt(wrap.dataset.n, 10) || N);
  let bars, line;
  if (key === 'otd') { bars = series(11, n, 18, 26, 0.4); line = series(21, n, 30, 8, 0.1); }
  else if (key === 'touch') { bars = series(31, n, 30, 24, 0.6); line = series(41, n, 2.6, 1.2, 0.04); }
  else if (key === 'blocks') { bars = series(51, n, 28, 22, 0.5); line = series(61, n, 10, 3, 0.05); }
  else { bars = series(71, n, 50, 30, 0.5); line = series(81, n, 60, 18, 0.4); }
  const barMax = Math.max(...bars) * 1.15;
  const tint = vividTint(key);
  const barCol = tint || cssVar('--cstop-1a', wrap);
  const lineCol = tint ? shade(tint, -0.28) : (wrap.dataset.rightline === 'green' ? cssVar('--line-2', wrap) || '#22c55e' : cssVar('--text', wrap) || '#e5e7eb');
  return {
    family: 'bars', orientation: 'v', cats: bars.map((_, i) => monthLabel(i)), series: [{ color: barCol }], matrix: bars.map(v => [v]),
    max: barMax, grouped: false, stacked: false, labels: false,
    line: { values: line.map(v => Math.min(v, rightMax)), max: rightMax, color: lineCol },
    tip: (i) => ({ title: monthLabel(i), rows: [[leftLabel || 'Value', fmt(bars[i])], ['Rate', line[i].toFixed(1) + '%']] }),
  };
}

function segColor(s, fallback){ return s && s[2] ? s[2] : fallback; }

function modelDonut(wrap){
  let raw = parse(wrap, 'segs', null), segs;
  if (Array.isArray(raw) && raw.length) segs = raw.map(s => ({ pct: +s[1] || 0, color: resolveCssColor('var(' + (s[2] || '--cstop-1a') + ')', wrap), label: String(s[0]) }));
  else segs = [{ pct: 48.39, color: resolveCssColor('--legend-4', wrap), label: 'UK test' }, { pct: 41.94, color: resolveCssColor('--legend-3', wrap), label: 'Others (13)' }, { pct: 3.23, color: resolveCssColor('--legend-2', wrap), label: 'BE test' }, { pct: 3.23, color: resolveCssColor('--legend-2', wrap), label: 'AU test' }, { pct: 3.23, color: resolveCssColor('--legend-1', wrap), label: 'AE test' }];
  return { family: 'pie', donut: true, segs };
}
function modelPieGen(wrap){
  const segs = parse(wrap, 'segs', []);
  const pal = ['--cstop-1b', '--legend-3', '--cstop-1a', '--legend-2', '--legend-1', '--cstop-3a'];
  return { family: 'pie', donut: false, segs: segs.map((s, i) => ({ pct: +s[1] || 0, color: resolveCssColor(s[2] || pal[i % pal.length], wrap), label: String(s[0]) })) };
}
function modelPieRQ(wrap){
  const sliceColors = ['--cstop-1a', '--cstop-2a', '--cstop-3a', '--cstop-4a'];
  return { family: 'pie', donut: false, segs: RQ_PIE.map((s, i) => ({ pct: s.p, color: s.other ? 'rgba(140,142,150,0.85)' : resolveCssColor(sliceColors[i] || '--cstop-1a', wrap), label: s.l })) };
}

function modelArea(wrap){
  const key = wrap.dataset.key || 'rej';
  const pts = key === 'po' ? series(91, 18, 60, 28, 1.0) : series(101, N, 52, 26, 0.2);
  const tint = vividTint(key);
  const col = tint || cssVar('--cstop-1a', wrap);
  const mx = Math.max(...pts) * 1.15;
  return { family: 'line', area: true, max: mx, series: [{ color: col, pts }], tip: (s, i) => ({ title: monthLabel(i), rows: [['Value', fmt(pts[i])]] }) };
}
function modelDurline(wrap){
  const n = 19, pts = [], r = rng(7); let base = 13.0;
  for (let i = 0; i < n; i++) { base += 0.06; pts.push(Math.max(11, Math.min(17, base + (r() - 0.5) * 2.0 + Math.sin(i / 2) * 0.6))); }
  const col = cssVar('--cstop-1a', wrap);
  return { family: 'line', area: true, max: 20, series: [{ color: col, pts }], tip: (s, i) => ({ title: 'duration', rows: [['seconds', pts[i].toFixed(1)]] }) };
}
function modelLinechart(wrap){
  const ser = parse(wrap, 'series', []);
  if (!ser.length) return null;
  const ymax = parseFloat(wrap.dataset.ymax) || 100, pct = wrap.dataset.pct === '1';
  const xl = (wrap.dataset.xlabels || '').split('|').filter(Boolean);
  return {
    family: 'line', area: false, max: ymax,
    series: ser.map(s => ({ color: cssVar(s.c || '--cstop-1a', wrap), name: s.name, pts: s.pts || [] })),
    tip: (si, i) => ({ title: xl[i] || ('#' + i), rows: ser.map((s, k) => [s.name || ('series ' + (k + 1)), (s.pts && s.pts[i] != null) ? s.pts[i].toFixed(1) + (pct ? '%' : '') : '-']) }),
  };
}
function modelDots(wrap){
  const n = 24, r = rng(7), vals = []; for (let i = 0; i < n; i++) { vals.push(i === 6 ? 19500 : (r() * 3000 + 300)); }
  const tint = vividTint('dots');
  const hi = tint || cssVar('--cstop-1a', wrap);
  const grey = 'rgb(150,150,156)';
  return {
    family: 'scatter', xmax: n, ymax: 20000, smax: 1, bubble: false, color: hi,
    pts: vals.map((v, i) => ({ x: i + 0.5, y: v, size: 0, tip: { title: 'Country ' + (i + 1), rows: [['Value', fmt(v)]] }, color: i === 6 ? hi : grey })),
  };
}

function modelPbars(wrap){
  const vals = [47, 33, 35, 26, 13, 41, 20, 34, 34, 40, 49, 70, 47, 35, 33, 25, 13, 41, 21, 34, 34, 41, 49, 70];
  const months = []; for (let y = 2022; y <= 2023; y++) for (let m = 1; m <= 12; m++) months.push(y + '-' + String(m).padStart(2, '0'));
  const col = cssVar('--cstop-1a', wrap);
  return { family: 'bars', orientation: 'v', cats: months, series: [{ color: col }], matrix: vals.map(v => [v]), max: 80, tip: (i) => ({ title: months[i], rows: [['Value', vals[i] + 'K']] }) };
}
function modelOtdClass(wrap){
  const rows = [{ l: 'Early', v: 12000, c: '--cstop-1a' }, { l: 'On Time', v: 295000, c: '--cstop-1a' }, { l: 'Late', v: 312000, c: '--cstop-1b' }, { l: 'No Goods Issue', v: 290000, c: '--cstop-3a' }, { l: 'No Confirmation', v: 2000, c: '--cstop-1a' }];
  return { family: 'bars', orientation: 'h', cats: rows.map(r => r.l), series: [{ color: cssVar('--cstop-1a', wrap) }], matrix: rows.map(r => [r.v]), max: 320000, labels: false, cellColor: (i) => cssVar(rows[i].c, wrap), tip: (i) => ({ title: rows[i].l, rows: [['Orders', fmt(rows[i].v)]] }) };
}
function modelOtdHist(wrap){
  const bars = [[-4, 1000, 'l'], [-3, 2000, 'l'], [-2, 8000, 'l'], [-1, 52000, 'l'], [0, 240000, 'l'], [1, 3000, 'd'], [2, 2000, 'd'], [3, 6000, 'd'], [4, 210000, 'd'], [5, 33000, 'd'], [6, 25000, 'd'], [7, 16000, 'd'], [8, 9000, 'd'], [9, 5000, 'd'], [10, 3000, 'd'], [11, 6000, 'g']];
  const cvar = t => t === 'l' ? '--cstop-1a' : t === 'd' ? '--cstop-1b' : '--cstop-3a';
  return { family: 'bars', orientation: 'v', cats: bars.map(b => String(b[0])), series: [{ color: cssVar('--cstop-1a', wrap) }], matrix: bars.map(b => [b[1]]), max: 250000, cellColor: (i) => cssVar(cvar(bars[i][2]), wrap), tip: (i) => ({ title: 'Deviation ' + bars[i][0] + (Math.abs(bars[i][0]) === 1 ? ' day' : ' days'), rows: [['Count', fmt(bars[i][1])]] }) };
}
function modelOtdDev(wrap){
  return { family: 'bars', orientation: 'v', cats: ['1970-01'], series: [{ color: cssVar('--cstop-1a', wrap) }], matrix: [[760000]], max: 800000, labels: true, tip: () => ({ title: '1970-01', rows: [['On-Time', '760K'], ['Rate', '47.5%']] }) };
}
function modelFreqhist(wrap){
  const n = 21, vals = []; for (let i = 0; i < n; i++) vals.push(Math.round(2150000 * Math.exp(-i * 0.42))); vals.push(180000);
  const count = vals.length, col = cssVar('--cstop-1a', wrap);
  return { family: 'bars', orientation: 'v', cats: vals.map((_, i) => String(i)), series: [{ color: col }], matrix: vals.map(v => [v]), max: 2200000, cellColor: (i) => i === count - 1 ? 'rgba(140,142,150,0.85)' : col, tip: (i) => ({ title: (i === count - 1 ? '200+ s' : Math.round(i / count * 200) + '\u2013' + Math.round((i + 1) / count * 200) + ' s'), rows: [['Frequency', fmt(vals[i])]] }) };
}
function modelHbars(wrap){
  const col = cssVar('--cstop-1a', wrap);
  return { family: 'bars', orientation: 'h', cats: RQ_BARS.map(r => r[0]), series: [{ color: col }], matrix: RQ_BARS.map(r => [r[1]]), max: 50, tip: (i) => ({ title: RQ_BARS[i][0], rows: [['Count', String(RQ_BARS[i][1])]] }) };
}
function modelHbarcat(wrap){
  const bars = parse(wrap, 'bars', []);
  const xmax = parseFloat(wrap.dataset.xmax) || (bars.length ? Math.max(...bars.map(b => b[1])) * 1.1 : 1);
  const unit = wrap.dataset.unit || '';
  return { family: 'bars', orientation: 'h', cats: bars.map(b => String(b[0])), series: [{ color: cssVar('--cstop-1a', wrap) }], matrix: bars.map(b => [b[1]]), max: xmax, cellColor: (i) => cssVar(bars[i][2] || '--cstop-1a', wrap), tip: (i) => ({ title: String(bars[i][0]), rows: [['Value', fmt(bars[i][1]) + (unit ? ' ' + unit : '')]] }) };
}
function modelBarcat(wrap){
  const bars = parse(wrap, 'bars', []);
  const ymax = parseFloat(wrap.dataset.ymax) || (bars.length ? Math.max(...bars.map(b => b[1])) * 1.12 : 1);
  const unit = wrap.dataset.unit || '', cvar = wrap.dataset.color || '--cstop-1a';
  return { family: 'bars', orientation: 'v', cats: bars.map(b => String(b[0])), series: [{ color: cssVar(cvar, wrap) }], matrix: bars.map(b => [b[1]]), max: ymax, labels: true, tip: (i) => ({ title: String(bars[i][0]), rows: [['Value', fmt(bars[i][1]) + (unit ? ' ' + unit : '')]] }) };
}
function modelGroupbars(wrap){
  const cats = parse(wrap, 'cats', []), ser = parse(wrap, 'series', []);
  const sers = ser.length ? ser : [{ c: '--cstop-1a', name: 'series', vals: cats.map(() => 0) }];
  const allv = sers.reduce((a, s) => a.concat(s.vals || []), []);
  const ymax = parseFloat(wrap.dataset.ymax) || (allv.length ? Math.max(...allv) * 1.12 : 1);
  const unit = wrap.dataset.unit || '';
  return {
    family: 'bars', orientation: 'v', grouped: true, cats, series: sers.map(s => ({ color: cssVar(s.c || '--cstop-1a', wrap), name: s.name })),
    matrix: cats.map((_, i) => sers.map(s => (s.vals && s.vals[i]) || 0)), max: ymax, labels: true,
    tip: (i) => ({ title: String(cats[i]), rows: sers.map(s => [s.name || 'series', fmt((s.vals && s.vals[i]) || 0) + (unit ? ' ' + unit : '')]) }),
  };
}
function modelStackbars(wrap){
  const ser = parse(wrap, 'series', []);
  const sers = ser.length ? ser : [{ c: '--cstop-1a' }];
  const n = parseInt(wrap.dataset.n || '26', 10), ymax = parseFloat(wrap.dataset.ymax) || 200000, seed = parseInt(wrap.dataset.seed || '7', 10);
  const shape = wrap.dataset.shape || 'bell', full = wrap.dataset.full === '1', bias = wrap.dataset.bias === '1', pct = wrap.dataset.pct === '1';
  const r = rng(seed), last = sers.length - 1;
  const matrix = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const profile = shape === 'grow' ? (0.12 + 0.85 * t) * (0.85 + r() * 0.2) : shape === 'rand' ? (0.2 + r() * 0.78) : Math.pow(Math.sin(Math.min(1, t * 1.12) * Math.PI), 0.7);
    const total = full ? ymax * (0.9 + r() * 0.08) : ymax * (0.30 + 0.62 * profile) * (0.82 + r() * 0.3);
    const finalAllLast = bias && i === n - 1;
    const shares = sers.map((s, si) => { if (finalAllLast) return si === last ? 1 : 0.0001; let b = (s.w || 1) * (0.55 + 0.9 * r()); if (bias && si === last) b *= (0.1 + t * t * 4); return b; });
    const sum = shares.reduce((a, b) => a + b, 0);
    matrix.push(sers.map((s, si) => (shares[si] / sum) * Math.min(total, ymax)));
  }
  return {
    family: 'bars', orientation: 'v', stacked: true, cats: matrix.map((_, i) => String(i)),
    series: sers.map(s => ({ color: cssVar(s.c || '--cstop-1a', wrap) })), matrix, max: ymax,
    tip: (i) => ({ title: 'Step ' + i, rows: [['Total', (pct ? Math.round(matrix[i].reduce((a, b) => a + b, 0)) + '%' : fmt(matrix[i].reduce((a, b) => a + b, 0)))]] }),
  };
}
function modelHstackbars(wrap){
  const cats = parse(wrap, 'cats', []), ser = parse(wrap, 'series', []);
  const sers = ser.length ? ser : [{ c: '--cstop-1a' }];
  const xmax = parseFloat(wrap.dataset.xmax) || 100, seed = parseInt(wrap.dataset.seed || '9', 10);
  const m = Math.max(1, cats.length), r = rng(seed);
  const matrix = [], totals = [];
  for (let i = 0; i < m; i++) {
    const t = m > 1 ? i / (m - 1) : 0;
    const total = (0.34 + 0.62 * t) * (0.9 + r() * 0.2) * 100;
    const shares = sers.map(s => (s.w || 1) * (0.45 + 0.95 * r())); const sum = shares.reduce((a, b) => a + b, 0);
    matrix.push(sers.map(s => (shares[sers.indexOf(s)] / sum) * Math.min(total, xmax)));
    totals.push(total);
  }
  return {
    family: 'bars', orientation: 'h', stacked: true, cats, series: sers.map(s => ({ color: cssVar(s.c || '--cstop-1a', wrap) })),
    matrix, max: xmax, tip: (i) => ({ title: String(cats[i]), rows: [['Total', Math.round(totals[i]) + '%']] }),
  };
}
function modelHistogram(wrap){
  const vals = parse(wrap, 'values', []);
  if (!vals.length) return null;
  const bins = parseInt(wrap.dataset.bins, 10) || 12;
  const xmin = wrap.dataset.xmin != null ? parseFloat(wrap.dataset.xmin) : Math.min(...vals);
  const xmax = wrap.dataset.xmax != null ? parseFloat(wrap.dataset.xmax) : Math.max(...vals);
  const span = (xmax - xmin) || 1, bwv = span / bins, unit = wrap.dataset.unit || '', cvar = wrap.dataset.color || '--cstop-1a';
  const counts = new Array(bins).fill(0); vals.forEach(v => { let k = Math.floor((v - xmin) / bwv); if (k >= bins) k = bins - 1; if (k < 0) k = 0; counts[k]++; });
  const cmax = Math.max(...counts) * 1.1 || 1;
  return { family: 'bars', orientation: 'v', cats: counts.map((_, i) => String(i)), series: [{ color: cssVar(cvar, wrap) }], matrix: counts.map(c => [c]), max: cmax, tip: (i) => ({ title: fmt(xmin + i * bwv) + '\u2013' + fmt(xmin + (i + 1) * bwv) + (unit ? ' ' + unit : ''), rows: [['Count', String(counts[i])]] }) };
}

function modelScatter(wrap){
  const pts = parse(wrap, 'points', []);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const xmax = parseFloat(wrap.dataset.xmax) || (xs.length ? Math.max(...xs) * 1.1 : 1);
  const ymax = parseFloat(wrap.dataset.ymax) || (ys.length ? Math.max(...ys) * 1.1 : 1);
  const cvar = wrap.dataset.color || '--cstop-1a';
  const m = { family: 'scatter', xmax, ymax, smax: 1, bubble: false, color: cssVar(cvar, wrap), pts: pts.map(p => ({ x: p[0], y: p[1], size: 0, tip: { title: 'Point', rows: [['x', fmt(p[0])], ['y', fmt(p[1])]] } })) };
  if (wrap.dataset.trend === '1' && pts.length > 1) {
    const n = pts.length, sX = xs.reduce((a, b) => a + b, 0), sY = ys.reduce((a, b) => a + b, 0), sXY = pts.reduce((a, p) => a + p[0] * p[1], 0), sXX = xs.reduce((a, b) => a + b * b, 0);
    const slope = (n * sXY - sX * sY) / ((n * sXX - sX * sX) || 1), b = (sY - slope * sX) / n;
    m.trend = true; m.trendPts = [[0, b], [xmax, slope * xmax + b]];
  }
  return m;
}
function modelBubble(wrap){
  const pts = parse(wrap, 'points', []);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), ss = pts.map(p => p[2] || 0);
  const xmax = parseFloat(wrap.dataset.xmax) || (xs.length ? Math.max(...xs) * 1.1 : 1);
  const ymax = parseFloat(wrap.dataset.ymax) || (ys.length ? Math.max(...ys) * 1.1 : 1);
  const smax = parseFloat(wrap.dataset.smax) || (ss.length ? Math.max(...ss) : 1);
  const cvar = wrap.dataset.color || '--cstop-1a';
  return { family: 'scatter', xmax, ymax, smax, bubble: true, color: cssVar(cvar, wrap), pts: pts.map(p => ({ x: p[0], y: p[1], size: p[2] || 0, tip: { title: p[3] || 'Bubble', rows: [['x', fmt(p[0])], ['y', fmt(p[1])], ['size', fmt(p[2] || 0)]] } })) };
}
function modelDotplot(wrap){
  const dots = parse(wrap, 'dots', []);
  const vals = dots.map(d => d[1]);
  const xmin = wrap.dataset.xmin != null ? parseFloat(wrap.dataset.xmin) : Math.min(0, ...(vals.length ? vals : [0]));
  const xmax = parseFloat(wrap.dataset.xmax) || (vals.length ? Math.max(...vals) * 1.08 : 1);
  const unit = wrap.dataset.unit || '', cvar = wrap.dataset.color || '--cstop-1a';
  return { family: 'dotplot', xmin, xmax, color: cssVar(cvar, wrap), dots: dots.map(d => ({ v: d[1], tip: { title: String(d[0]), rows: [['Value', fmt(d[1]) + (unit ? ' ' + unit : '')]] } })) };
}
function modelHeatmap(wrap){
  const rows = parse(wrap, 'rows', []), cols = parse(wrap, 'cols', []), matrix = parse(wrap, 'matrix', []);
  const flat = matrix.reduce((a, r) => a.concat(r), []);
  const vmax = parseFloat(wrap.dataset.vmax) || (flat.length ? Math.max(...flat) : 1);
  const vmin = wrap.dataset.vmin != null ? parseFloat(wrap.dataset.vmin) : 0;
  return { family: 'heatmap', rows, cols, matrix, vmin, vmax, unit: wrap.dataset.unit || '' };
}
function modelBoxplot(wrap){
  const boxes = parse(wrap, 'boxes', []);
  const allv = boxes.reduce((a, b) => a.concat(b.slice(1)), []);
  const ymax = parseFloat(wrap.dataset.ymax) || (allv.length ? Math.max(...allv) * 1.1 : 1);
  const ymin = wrap.dataset.ymin != null ? parseFloat(wrap.dataset.ymin) : 0;
  return { family: 'boxplot', boxes, ymin, ymax, color: cssVar(wrap.dataset.color || '--cstop-1a', wrap) };
}
function modelViolin(wrap){
  const groups = parse(wrap, 'violins', []);
  const allv = groups.reduce((a, g) => a.concat(g.values || []), []);
  if (!allv.length) return null;
  const ymin = wrap.dataset.ymin != null ? parseFloat(wrap.dataset.ymin) : Math.min(...allv);
  const ymax = wrap.dataset.ymax != null ? parseFloat(wrap.dataset.ymax) : Math.max(...allv);
  const span = (ymax - ymin) || 1, bw = parseFloat(wrap.dataset.bw) || span / 10, cvar = wrap.dataset.color || '--cstop-1a';
  const M = 40;
  const built = groups.map(g => {
    const vals = g.values || [], dens = []; let dmax = 0;
    for (let i = 0; i <= M; i++) { const y = ymin + span * i / M; let s = 0; vals.forEach(v => { const u = (y - v) / bw; s += Math.exp(-0.5 * u * u); }); dens.push({ t: i / M, raw: s }); if (s > dmax) dmax = s; }
    dens.forEach(p => { p.d = p.raw / (dmax || 1); });
    const sorted = vals.slice().sort((a, b) => a - b), q = p => sorted.length ? sorted[Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1)))] : 0;
    return { color: cssVar(g.c || cvar, wrap), dens, tip: { title: String(g.name || ''), rows: [['Median', fmt(q(0.5))], ['Q3', fmt(q(0.75))], ['Q1', fmt(q(0.25))], ['n', String(vals.length)]] } };
  });
  return { family: 'shape', kind: 'violin', groups: built };
}
function modelDensity(wrap){
  const vals = parse(wrap, 'values', []);
  if (!vals.length) return null;
  const xmin = wrap.dataset.xmin != null ? parseFloat(wrap.dataset.xmin) : Math.min(...vals);
  const xmax = wrap.dataset.xmax != null ? parseFloat(wrap.dataset.xmax) : Math.max(...vals);
  const span = (xmax - xmin) || 1, bw = parseFloat(wrap.dataset.bw) || span / 12, cvar = wrap.dataset.color || '--cstop-1a', M = 64;
  const dens = []; let dmax = 0;
  for (let i = 0; i <= M; i++) { const x = xmin + span * i / M; let s = 0; vals.forEach(v => { const u = (x - v) / bw; s += Math.exp(-0.5 * u * u); }); s /= (vals.length * bw * Math.sqrt(2 * Math.PI)); dens.push({ t: i / M, raw: s, x }); if (s > dmax) dmax = s; }
  dens.forEach(p => { p.d = p.raw / (dmax || 1); });
  return { family: 'shape', kind: 'density', color: cssVar(cvar, wrap), dens, tip: { title: 'density', rows: [['peak', dmax.toFixed(4)]] } };
}
function modelFunnel(wrap){
  const stages = parse(wrap, 'stages', []);
  if (!stages.length) return null;
  const unit = wrap.dataset.unit || '', top = stages[0][1];
  return { family: 'funnel', stages: stages.map(s => ({ label: String(s[0]), value: s[1], tip: { title: String(s[0]), rows: [['Value', fmt(s[1]) + (unit ? ' ' + unit : '')], ['Of top', (s[1] / top * 100).toFixed(1) + '%']] } })) };
}
function modelBullet(wrap){
  const value = parseFloat(wrap.dataset.value) || 0, target = parseFloat(wrap.dataset.target), max = parseFloat(wrap.dataset.max) || (Math.max(value, target || 0) * 1.1) || 1;
  const bands = parse(wrap, 'bands', []);
  const unit = wrap.dataset.unit || '', label = wrap.dataset.label || '', cvar = wrap.dataset.color || '--cstop-1a';
  return { family: 'bullet', value, target, max, bands, color: cssVar(cvar, wrap), tip: { title: label || 'Bullet', rows: [['Value', fmt(value) + (unit ? ' ' + unit : '')], ['Target', isNaN(target) ? '-' : fmt(target) + (unit ? ' ' + unit : '')]] } };
}

/* ============================================================
   Instance lifecycle: build, signature, dispose.
   ============================================================ */
function colorSig(wrap){
  return ['--cstop-1a', '--cstop-1b', '--cstop-2a', '--cstop-3a', '--cstop-4a', '--legend-1', '--legend-2', '--legend-3', '--legend-4', '--text']
    .map(v => cssVar(v, wrap)).join('|');
}
function buildSig(wrap, type){
  const d = wrap.dataset;
  const data = [d.segs, d.bars, d.series, d.cats, d.points, d.values, d.boxes, d.violins, d.stages, d.rows, d.cols, d.matrix, d.dots,
    d.key, d.n, d.ymax, d.xmax, d.value, d.target, d.bands, d.color, d.bins, d.shape, d.full, d.bias].join('~');
  const theme = [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-mode'), document.documentElement.getAttribute('data-vivid-palette')].join('|');
  return type + '::' + theme + '::' + colorSig(wrap) + '::' + data;
}

const _orbitCache = new WeakMap();   // wrap -> {az, el} preserved across rebuilds

function buildInstance(wrap, type){
  const model = modelFor(wrap, type);
  if (!model) return null;
  const builder = BUILDERS[model.family];
  if (!builder) return null;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 1000);
  const content = new THREE.Group();   // swapped into the shared stageScene at render time

  const inst = {
    wrap, type, camera, content,
    pickables: [], pickMap: new Map(), pickRoots: [content],
    disposables: [], visible: true,
    reveal: 0, revealDur: 0.78, revealAxis: 'y',
    az: 0.5, el: 0.45, baseAz: 0.5, clock: 0, autoRotate: 0.2, sway: false, swayAmp: 0.2,
    userMoved: false, drag: null, hovered: null,
    target: new THREE.Vector3(), sphereR: 6,
    boxCorners: null, fitAz: 0.5, fitEl: 0.45, fitMargin: 1.06,
    canvas: null, ctx: null, fallbackH: 0,
    zoom: 1, zoomable: false,
  };

  builder(inst, wrap, model);
  inst.az = inst.viewAz != null ? inst.viewAz : inst.az;
  inst.el = inst.viewEl != null ? inst.viewEl : inst.el;
  inst.baseAz = inst.az;
  castAll(content);

  // Drop the built content onto the floor (y=0) and frame the camera.
  const box = new THREE.Box3().setFromObject(content);
  if (isFinite(box.min.y)) content.position.y -= box.min.y;
  const fbox = new THREE.Box3().setFromObject(content);
  const sphere = fbox.getBoundingSphere(new THREE.Sphere());
  inst.target.copy(sphere.center);
  inst.sphereR = Math.max(0.5, sphere.radius);
  // 8 world corners of the content box + the resting pose, used to fit the chart
  // tightly into the card (see fitRadius).
  const mn = fbox.min, mx = fbox.max;
  inst.boxCorners = [
    new THREE.Vector3(mn.x, mn.y, mn.z), new THREE.Vector3(mx.x, mn.y, mn.z),
    new THREE.Vector3(mn.x, mx.y, mn.z), new THREE.Vector3(mx.x, mx.y, mn.z),
    new THREE.Vector3(mn.x, mn.y, mx.z), new THREE.Vector3(mx.x, mn.y, mx.z),
    new THREE.Vector3(mn.x, mx.y, mx.z), new THREE.Vector3(mx.x, mx.y, mx.z),
  ];
  inst.fitAz = inst.az; inst.fitEl = inst.el;
  return inst;
}

function disposeInstance(inst){
  if (!inst) return;
  try { clearHover(inst); } catch (e) {}
  // Let a non-chart instance (e.g. the process graph) put back any DOM it hid.
  try { if (inst.onDispose) inst.onDispose(); } catch (e) {}
  try { if (stageScene && inst.content) stageScene.remove(inst.content); } catch (e) {}
  inst.disposables.forEach(d => { try { d.dispose && d.dispose(); } catch (e) {} });
  inst.disposables.length = 0;
  inst.pickables.length = 0; inst.pickMap.clear();
  if (inst.canvas && inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
  if (inst._listeners) inst._listeners.forEach(([t, fn]) => inst.canvas && inst.canvas.removeEventListener(t, fn));
}

function teardown(wrap){
  const inst = registry.get(wrap);
  if (inst) { try { io && io.unobserve(wrap); } catch (e) {} disposeInstance(inst); }
  registry.delete(wrap);
  if (wrap.dataset && wrap.dataset.webglFallbackH != null) { wrap.style.minHeight = ''; delete wrap.dataset.webglFallbackH; }
}

function attachCanvas(inst, wrap){
  const cv = document.createElement('canvas');
  cv.className = 'webgl-chart';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', '3D chart');
  inst.canvas = cv; inst.ctx = cv.getContext('2d');
  wrap.appendChild(cv);
  const listeners = [];
  const onDown = e => { inst.drag = { x: e.clientX, y: e.clientY }; inst.userMoved = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} };
  const onMove = e => {
    if (e.pointerType !== 'touch') pickHover(inst, e);
    if (inst.drag) { const dx = e.clientX - inst.drag.x, dy = e.clientY - inst.drag.y; inst.drag.x = e.clientX; inst.drag.y = e.clientY; inst.az -= dx * 0.01; inst.el = clamp(inst.el - dy * 0.01, 0.1, 1.45); }
  };
  const onUp = e => { inst.drag = null; try { cv.releasePointerCapture(e.pointerId); } catch (_) {} };
  const onLeave = () => { inst.drag = null; clearHover(inst); };
  // Mouse-wheel zoom (opt-in via inst.zoomable so dashboard charts don't trap page
  // scroll). Scales the fitted camera distance; preventDefault keeps the page still.
  const onWheel = e => {
    if (!inst.zoomable) return;
    e.preventDefault();
    inst.zoom = clamp((inst.zoom || 1) * Math.exp((e.deltaY > 0 ? 1 : -1) * 0.14), 0.4, 2.6);
    inst.userMoved = true;
  };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove, { passive: true });
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('pointerleave', onLeave);
  if (inst.zoomable) cv.addEventListener('wheel', onWheel, { passive: false });
  listeners.push(['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['pointerleave', onLeave], ['wheel', onWheel]);
  inst._listeners = listeners;
}

/* ============================================================
   Process Explorer graph — a cinematic 3D "floor map".

   The graph (index.html .pgraph) is NOT a data-chart wrap: it's an absolutely
   positioned HTML layout (activity .pnode slabs, object .pobj + duration
   .elabel text) overlaid by an <svg.pedges> of coloured connector paths. We
   keep that SVG board as the source of truth AND the fallback, and build the
   3D scene by reading the LIVE DOM:
     • each node/object/label box is measured in the 1120x1640 board space,
     • each connector path's geometry + colour is parsed from the SVG.
   Everything is laid flat on the shared ground plane (board-y → world +Z, the
   process flows away from the camera), so it reuses the exact same stage,
   rAF loop, orbit, raycast-hover and tooltip plumbing as the charts.
   ============================================================ */
const PG_VIEWW = 1120, PG_VIEWH = 1640;   // .pedges viewBox (board coordinate space)
const PG_S = 0.02;                         // board px → world units
const PG_CX = PG_VIEWW / 2, PG_CY = PG_VIEWH / 2;
const PG_EDGE_Y = 0.16;                    // connectors hover just above the floor
const PG_TILE_T = 0.4;                     // activity slab thickness
const PG_TILE_Y = 0.45;                    // slab centre height (floats slightly → soft shadow)
const pgX = px => (px - PG_CX) * PG_S;
const pgZ = py => (py - PG_CY) * PG_S;     // board y grows downward → world +Z (receding)

function roundRectPath(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* A camera-facing text label (title + optional subtitle) on a soft theme pill,
   so it stays crisp and readable at any orbit angle — floating holographic
   captions over the 3D board. */
function makeTextSprite(title, sub, opts){
  opts = opts || {};
  // Render the label at high supersample, then let mipmaps + max anisotropy
  // resample it crisply at any orbit distance (the old 2x was soft when zoomed).
  const k = 4;
  const fsT = (opts.fsT || 26) * k, fsS = (opts.fsS || 18) * k;
  const padX = 18 * k, padY = 12 * k, gap = 5 * k, rad = 13 * k;
  const fontT = '700 ' + fsT + 'px Inter, system-ui, sans-serif';
  const fontS = '500 ' + fsS + 'px Inter, system-ui, sans-serif';
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = fontT; const wT = title ? ctx.measureText(title).width : 0;
  ctx.font = fontS; const wS = sub ? ctx.measureText(sub).width : 0;
  const tw = Math.ceil(Math.max(wT, wS)) + padX * 2;
  const th = Math.ceil(padY * 2 + fsT + (sub ? gap + fsS : 0));
  c.width = tw; c.height = th;
  if (opts.bg) { ctx.fillStyle = opts.bg; roundRectPath(ctx, 0, 0, tw, th, rad); ctx.fill(); }
  if (opts.stroke) { ctx.strokeStyle = opts.stroke; ctx.lineWidth = 1.5 * k; roundRectPath(ctx, 0.75 * k, 0.75 * k, tw - 1.5 * k, th - 1.5 * k, rad - k); ctx.stroke(); }
  ctx.textBaseline = 'top';
  if (title) { ctx.fillStyle = opts.titleColor || '#fff'; ctx.font = fontT; ctx.fillText(title, padX, padY); }
  if (sub) { ctx.fillStyle = opts.subColor || 'rgba(255,255,255,0.62)'; ctx.font = fontS; ctx.fillText(sub, padX, padY + fsT + gap); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso();
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
  const sp = new THREE.Sprite(mat);
  const worldH = opts.worldH || 0.82;
  sp.scale.set(worldH * (tw / th), worldH, 1);
  return { sprite: sp, tex, mat };
}

/* Minimal absolute-coordinate SVG path parser (handles the M/L/H/V/Q commands
   the connector board uses) → a flat list of [x,y] board-space points; Q arcs
   are sampled so corner fillets stay smooth as 3D tubes. */
function parsePathD(d){
  const pts = []; let cx = 0, cy = 0;
  const re = /([MLHVQ])([^MLHVQ]*)/gi; let m;
  const nums = s => { const a = (s || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi); return a ? a.map(Number) : []; };
  const push = (x, y) => { const last = pts[pts.length - 1]; if (!last || Math.abs(last[0] - x) > 0.01 || Math.abs(last[1] - y) > 0.01) pts.push([x, y]); };
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase(), a = nums(m[2]);
    if (cmd === 'M') { cx = a[0]; cy = a[1]; push(cx, cy); for (let i = 2; i + 1 < a.length; i += 2) { cx = a[i]; cy = a[i + 1]; push(cx, cy); } }
    else if (cmd === 'L') { for (let i = 0; i + 1 < a.length; i += 2) { cx = a[i]; cy = a[i + 1]; push(cx, cy); } }
    else if (cmd === 'H') { for (let i = 0; i < a.length; i++) { cx = a[i]; push(cx, cy); } }
    else if (cmd === 'V') { for (let i = 0; i < a.length; i++) { cy = a[i]; push(cx, cy); } }
    else if (cmd === 'Q') { for (let i = 0; i + 3 < a.length; i += 4) { const x1 = a[i], y1 = a[i + 1], x2 = a[i + 2], y2 = a[i + 3]; const segs = 9; for (let s = 1; s <= segs; s++) { const t = s / segs, it = 1 - t; push(it * it * cx + 2 * it * t * x1 + t * t * x2, it * it * cy + 2 * it * t * y1 + t * t * y2); } cx = x2; cy = y2; } }
  }
  return pts;
}

const _up = new THREE.Vector3(0, 1, 0);

function buildProcessGraphInstance(graphEl, card){
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 4000);
  const content = new THREE.Group();
  const inst = {
    wrap: card, type: '__pgraph', camera, content,
    pickables: [], pickMap: new Map(), pickRoots: [content],
    disposables: [], visible: true,
    reveal: 0, revealDur: 1.0, revealAxis: 'uniform',
    az: 0.0, el: 0.92, baseAz: 0.0, clock: 0, autoRotate: 0, sway: true, swayAmp: 0.08,
    userMoved: false, drag: null, hovered: null,
    target: new THREE.Vector3(), sphereR: 12,
    boxCorners: null, fitAz: 0.0, fitEl: 0.92, fitMargin: 1.14,
    canvas: null, ctx: null, fallbackH: 0,
    viewAz: 0.0, viewEl: 0.92, onDispose: null,
    zoom: 1, zoomable: true, shadowFit: 1.25,
    baseFov: 32, flyRoute: null, fly: null,
  };

  // Resolve theme-driven surface/label colours once (edges keep their own
  // categorical brand colours, exactly like the SVG board).
  const surfaceCol = resolveCssColor('--bg-1', card);
  const rimCol = resolveCssColor('--cstop-1a', card);
  const textCol = resolveCssColor('--text', card) || '#e8eaf0';
  const dimCol = resolveCssColor('--text-dim', card) || '#9aa0aa';
  const pill = (() => { try { const { r, g, b } = toRGB(surfaceCol); return 'rgba(' + r + ',' + g + ',' + b + ',0.66)'; } catch (e) { return 'rgba(18,20,28,0.66)'; } })();
  const pillBorder = (() => { try { const { r, g, b } = toRGB(resolveCssColor('--border', card)); return 'rgba(' + r + ',' + g + ',' + b + ',0.9)'; } catch (e) { return 'rgba(255,255,255,0.12)'; } })();

  // Board-space → relative box helper (measured while the SVG layout is still live).
  const gb = graphEl.getBoundingClientRect();
  const sx = gb.width ? PG_VIEWW / gb.width : 1;     // map rendered px back to viewBox px (card may clip, never scales)
  const sy = gb.height ? PG_VIEWH / gb.height : 1;
  function relBox(el){ const r = el.getBoundingClientRect(); return { x: (r.left - gb.left) * sx, y: (r.top - gb.top) * sy, w: r.width * sx, h: r.height * sy }; }

  // ---- activity nodes → glossy floating slabs + floating caption ----
  graphEl.querySelectorAll('.pnode').forEach(node => {
    const b = relBox(node); if (!b.w || !b.h) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const w = Math.max(0.6, b.w * PG_S), d = Math.max(0.5, b.h * PG_S);
    const geo = new RoundedBoxGeometry(w, PG_TILE_T, d, 3, Math.min(0.12, PG_TILE_T * 0.4));
    const mat = new THREE.MeshPhysicalMaterial({ color: threeColor(surfaceCol, card), metalness: 0.14, roughness: 0.46, clearcoat: 0.65, clearcoatRoughness: 0.3, envMapIntensity: 1.0 });
    mat.emissive = threeColor(rimCol, card).multiplyScalar(0.05); mat.userData.baseColor = mat.color.clone();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(pgX(cx), PG_TILE_Y, pgZ(cy));
    content.add(mesh); inst.disposables.push(geo, mat);
    const title = (node.querySelector('.t') || {}).textContent || '';
    const subtxt = ((node.querySelector('.s') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const lbl = makeTextSprite(title, subtxt, { worldH: 0.78, fsT: 25, fsS: 17, bg: pill, stroke: pillBorder, titleColor: textCol, subColor: dimCol });
    lbl.sprite.position.set(pgX(cx), PG_TILE_Y + PG_TILE_T / 2 + 0.5, pgZ(cy));
    content.add(lbl.sprite); inst.disposables.push(lbl.tex, lbl.mat);
    addPickable(inst, mesh, { title, rows: subtxt ? [['Detail', subtxt]] : [] });
  });

  // ---- object cards (.pobj) → low floating captions ----
  graphEl.querySelectorAll('.pobj').forEach(obj => {
    const b = relBox(obj); if (!b.w) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const title = (obj.querySelector('.t') || {}).textContent || '';
    const subtxt = ((obj.querySelector('.s') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const lbl = makeTextSprite(title, subtxt, { worldH: 0.58, fsT: 20, fsS: 15, bg: pill, stroke: pillBorder, titleColor: dimCol, subColor: dimCol });
    lbl.sprite.position.set(pgX(cx), 0.82, pgZ(cy));
    content.add(lbl.sprite); inst.disposables.push(lbl.tex, lbl.mat);
  });

  // ---- duration pills (.elabel) → tiny floating captions over their edge ----
  graphEl.querySelectorAll('.elabel').forEach(lab => {
    const b = relBox(lab); if (!b.w) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const txt = (lab.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt) return;
    const lbl = makeTextSprite(txt, '', { worldH: 0.4, fsT: 17, bg: pill, stroke: pillBorder, titleColor: dimCol });
    lbl.sprite.position.set(pgX(cx), 0.56, pgZ(cy));
    content.add(lbl.sprite); inst.disposables.push(lbl.tex, lbl.mat);
  });

  // ---- connector paths → glowing coloured tubes + arrowheads ----
  const svg = graphEl.querySelector('svg.pedges');
  const routeGroups = new Map();   // strokeColour → { len, segs:[ [Vector3...] ] } for the flythrough route
  if (svg) {
    svg.querySelectorAll('g path[d]').forEach(p => {
      const pts2 = parsePathD(p.getAttribute('d') || '');
      if (pts2.length < 2) return;
      const stroke = p.getAttribute('stroke') || '#8a8d98';
      const sw = parseFloat(p.getAttribute('stroke-width')) || 3;
      const hasArrow = !!p.getAttribute('marker-end');
      const v3 = pts2.map(pt => new THREE.Vector3(pgX(pt[0]), PG_EDGE_Y, pgZ(pt[1])));
      // Accumulate this segment under its colour (DOM order == flow order) so the
      // longest-total colour becomes one continuous navigation route.
      let segLen = 0; for (let i = 1; i < v3.length; i++) segLen += v3[i].distanceTo(v3[i - 1]);
      const gkey = stroke.toLowerCase();
      let grp = routeGroups.get(gkey); if (!grp) { grp = { len: 0, segs: [] }; routeGroups.set(gkey, grp); }
      grp.len += segLen; grp.segs.push(v3);
      const radius = Math.max(0.045, sw * PG_S * 0.7);
      const curve = new THREE.CatmullRomCurve3(v3, false, 'centripetal', 0.5);
      const geo = new THREE.TubeGeometry(curve, Math.max(24, v3.length * 4), radius, 10, false);
      const col = vivify(threeColor(stroke, card), 0.32, 0.02);
      const mat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.22, roughness: 0.26, clearcoat: 0.8, clearcoatRoughness: 0.22, envMapIntensity: 1.15 });
      mat.emissive = col.clone().multiplyScalar(0.3);
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
      content.add(mesh); inst.disposables.push(geo, mat);
      if (hasArrow) {
        const end = v3[v3.length - 1], prev = v3[v3.length - 2];
        const dir = end.clone().sub(prev); if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1); dir.normalize();
        const ah = radius * 5.2, ar = radius * 2.3;
        const ageo = new THREE.ConeGeometry(ar, ah, 16);
        const amat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.22, roughness: 0.26, clearcoat: 0.7 });
        amat.emissive = col.clone().multiplyScalar(0.3);
        const arrow = new THREE.Mesh(ageo, amat); arrow.castShadow = true;
        arrow.quaternion.setFromUnitVectors(_up, dir);
        arrow.position.copy(end).addScaledVector(dir, ah * 0.25);
        content.add(arrow); inst.disposables.push(ageo, amat);
      }
    });
    // endpoint markers (filled dots → spheres, hollow rings → tori)
    svg.querySelectorAll('g circle').forEach(c => {
      const cx = parseFloat(c.getAttribute('cx')), cy = parseFloat(c.getAttribute('cy')), r = parseFloat(c.getAttribute('r')) || 5;
      if (isNaN(cx) || isNaN(cy)) return;
      const fill = c.getAttribute('fill'), hollow = !fill || fill === 'none';
      const colStr = hollow ? (c.getAttribute('stroke') || '#8a8d98') : fill;
      const col = vivify(threeColor(colStr, card), 0.32, 0.02);
      const wr = r * PG_S * 1.5;
      if (hollow) {
        const geo = new THREE.TorusGeometry(wr, Math.max(0.02, wr * 0.34), 8, 20);
        const mat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.22, roughness: 0.28, clearcoat: 0.6 }); mat.emissive = col.clone().multiplyScalar(0.34);
        const mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(pgX(cx), PG_EDGE_Y, pgZ(cy)); mesh.castShadow = true;
        content.add(mesh); inst.disposables.push(geo, mat);
      } else {
        const mat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.22, roughness: 0.26, clearcoat: 0.6 }); mat.emissive = col.clone().multiplyScalar(0.34);
        const mesh = new THREE.Mesh(_sphereGeo, mat); mesh.scale.setScalar(Math.max(0.06, wr)); mesh.position.set(pgX(cx), PG_EDGE_Y, pgZ(cy)); mesh.castShadow = true;
        content.add(mesh); inst.disposables.push(mat);
      }
    });

    // ---- navigation flythrough: the longest single-colour flow (the yellow one)
    // becomes one continuous route; a glowing red dot drives along it with a
    // chase/POV camera, Google-Maps style, so you cruise past the labels. ----
    let best = null; routeGroups.forEach(g => { if (!best || g.len > best.len) best = g; });
    if (best && best.segs.length) {
      const rpts = [];
      best.segs.forEach(seg => seg.forEach(p => { const l = rpts[rpts.length - 1]; if (!l || l.distanceToSquared(p) > 1e-5) rpts.push(p.clone()); }));
      if (rpts.length >= 2) {
        inst.flyRoute = new THREE.CatmullRomCurve3(rpts, false, 'centripetal', 0.5);
        const dgeo = new THREE.SphereGeometry(0.26, 24, 18);
        const dmat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xe5241a, emissiveIntensity: 1.6, roughness: 0.34, metalness: 0.0 });
        const dot = new THREE.Mesh(dgeo, dmat); dot.castShadow = true; dot.visible = false;
        dot.position.copy(inst.flyRoute.getPointAt(0));
        content.add(dot); inst.disposables.push(dgeo, dmat);
        inst.fly = { on: false, t: 0, blend: 0, dur: 17, dist: 1.95, height: 1.52, look: 0.34, fov: 60, dot, btn: null };
      }
    }
  }

  if (!content.children.length) return null;

  // Frame: drop to the floor, fit the (large, portrait) board box into the card.
  const box = new THREE.Box3().setFromObject(content);
  if (isFinite(box.min.y)) content.position.y -= box.min.y;
  const fbox = new THREE.Box3().setFromObject(content);
  const sphere = fbox.getBoundingSphere(new THREE.Sphere());
  inst.target.copy(sphere.center);
  inst.sphereR = Math.max(0.5, sphere.radius);
  const mn = fbox.min, mx = fbox.max;
  inst.boxCorners = [
    new THREE.Vector3(mn.x, mn.y, mn.z), new THREE.Vector3(mx.x, mn.y, mn.z),
    new THREE.Vector3(mn.x, mx.y, mn.z), new THREE.Vector3(mx.x, mx.y, mn.z),
    new THREE.Vector3(mn.x, mn.y, mx.z), new THREE.Vector3(mx.x, mn.y, mx.z),
    new THREE.Vector3(mn.x, mx.y, mx.z), new THREE.Vector3(mx.x, mx.y, mx.z),
  ];
  inst.fitAz = inst.az; inst.fitEl = inst.el;
  return inst;
}

function pgraphSig(card){
  const theme = [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-mode'), document.documentElement.getAttribute('data-vivid-palette')].join('|');
  const cols = ['--bg-1', '--text', '--text-dim', '--border', '--cstop-1a'].map(v => cssVar(v, card)).join('|');
  return '__pgraph::' + theme + '::' + cols;
}

/* ============================================================
   Public API (called by engine.js buildChart routing).
   ============================================================ */
export function mountWebGLChart(wrap){
  if (!wrap || !wrap.dataset || !wrap.dataset.chart) return false;
  if (!ensureStage()) return false;
  const type = wrap.dataset.chart;
  const sig = buildSig(wrap, type);
  const existing = registry.get(wrap);

  // Same data + theme → keep the running instance (preserves orbit / animation).
  if (existing && existing.sig === sig && existing.canvas && existing.canvas.parentNode === wrap) {
    return true;
  }

  // The wrap's natural height BEFORE its in-flow SVG is swapped for an absolute
  // <canvas>. In a content-sized metric card (auto grid-row) the in-flow SVG is what
  // gives the card its height — an absolute canvas contributes none, so the card
  // would otherwise collapse to its min-height (the reported "charts get smaller in
  // WebGL" bug). Captured here, while the SVG is still in place on a flat→WebGL
  // toggle, and re-applied as a min-height below; cleared again on teardown().
  const preH = Math.round(wrap.getBoundingClientRect().height);

  // Carry over the user's orbit when rebuilding the same wrap.
  if (existing) { _orbitCache.set(wrap, { az: existing.az, el: existing.el, userMoved: existing.userMoved }); }

  // Clear any SVG (or stale canvas) the wrap currently holds.
  if (existing) { try { io && io.unobserve(wrap); } catch (e) {} disposeInstance(existing); registry.delete(wrap); }
  Array.from(wrap.childNodes).forEach(n => { if (!(n.classList && n.classList.contains('webgl-chart'))) wrap.removeChild(n); });

  let inst;
  try { inst = buildInstance(wrap, type); } catch (e) { console.error('[webgl] build failed for "' + type + '"', e); inst = null; }
  if (!inst) return false;
  inst.sig = sig;

  // Reserve the wrap's height so the absolute canvas can't collapse a content-sized
  // card. Skip wraps that already size themselves deterministically (e.g. a square
  // donut wrap via aspect-ratio). The width-derived fallback covers a fresh load that
  // starts directly in WebGL, where no SVG height was ever measured.
  if (!(wrap.style && wrap.style.aspectRatio)) {
    const reserveH = preH >= 60 ? preH : Math.max(150, Math.round((wrap.clientWidth || 280) * 0.52));
    inst.fallbackH = reserveH;
    wrap.style.minHeight = reserveH + 'px';
    wrap.dataset.webglFallbackH = String(reserveH);
  }

  attachCanvas(inst, wrap);

  // Restore preserved orbit (skip the entrance replay when only the theme changed).
  const saved = _orbitCache.get(wrap);
  if (saved) { inst.az = saved.az; inst.el = saved.el; inst.userMoved = saved.userMoved; inst.reveal = 1; applyReveal(inst); }

  registry.set(wrap, inst);
  try { io.observe(wrap); } catch (e) {}
  startLoop();
  return true;
}

export function unmountWebGLChart(wrap){
  if (registry.has(wrap)) teardown(wrap);
}

/* Process Explorer graph: mount onto the scrollable .pgraph-card (which becomes
   the 3D stage) by reading the live SVG/HTML board. Reuses the shared registry /
   rAF loop / orbit / hover, so it behaves like any other instance. */
// Small overlay play button (top-left of the card) that toggles the flythrough.
const FLY_PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.4v13.2a.6.6 0 0 0 .92.5l10.3-6.6a.6.6 0 0 0 0-1L8.92 4.9A.6.6 0 0 0 8 5.4z"/></svg>';
const FLY_STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.6"/></svg>';
function syncFlyBtn(inst){
  const b = inst.fly && inst.fly.btn; if (!b) return;
  b.classList.toggle('on', inst.fly.on);
  b.innerHTML = inst.fly.on ? FLY_STOP_ICON : FLY_PLAY_ICON;
  b.setAttribute('aria-label', inst.fly.on ? 'Stop navigation flythrough' : 'Play navigation flythrough');
}
function toggleFly(inst){
  if (!inst.fly || !inst.flyRoute) return;
  inst.fly.on = !inst.fly.on;
  if (inst.fly.on) { inst.fly.t = 0; inst.userMoved = false; }
  syncFlyBtn(inst);
  startLoop();
}

export function mountWebGLProcessGraph(graphEl){
  if (!graphEl) return false;
  if (!ensureStage()) return false;
  const card = graphEl.closest('.pgraph-card') || graphEl.parentElement || graphEl;
  if (card.clientWidth < 4 || card.clientHeight < 4) return false;   // hidden subtab: nothing to measure
  const sig = pgraphSig(card);
  const existing = registry.get(card);
  if (existing && existing.sig === sig && existing.canvas && existing.canvas.parentNode === card) return true;

  if (existing) _orbitCache.set(card, { az: existing.az, el: existing.el, userMoved: existing.userMoved, zoom: existing.zoom, flyOn: !!(existing.fly && existing.fly.on), flyT: existing.fly ? existing.fly.t : 0 });
  if (existing) { try { io && io.unobserve(card); } catch (e) {} disposeInstance(existing); registry.delete(card); }

  let inst;
  try { inst = buildProcessGraphInstance(graphEl, card); } catch (e) { console.error('[webgl] process graph build failed', e); inst = null; }
  if (!inst) return false;
  inst.sig = sig;

  // Swap the SVG board for the 3D stage (CSS hides .pgraph + clips the card),
  // and restore it verbatim if this instance is ever disposed.
  card.setAttribute('data-webgl', '');
  inst.onDispose = () => {
    try { card.removeAttribute('data-webgl'); } catch (e) {}
    try { if (inst.fly && inst.fly.btn && inst.fly.btn.parentNode) inst.fly.btn.parentNode.removeChild(inst.fly.btn); } catch (e) {}
  };

  attachCanvas(inst, card);
  const saved = _orbitCache.get(card);
  if (saved) { inst.az = saved.az; inst.el = saved.el; inst.userMoved = saved.userMoved; if (saved.zoom) inst.zoom = saved.zoom; inst.reveal = 1; applyReveal(inst); }

  // Top-left play button → navigation flythrough along the longest (yellow) flow.
  if (inst.fly && inst.flyRoute) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pgraph-fly-btn';
    btn.title = 'Navigation flythrough';
    btn.addEventListener('click', () => toggleFly(inst));
    card.appendChild(btn);
    inst.fly.btn = btn;
    if (saved && saved.flyOn) { inst.fly.on = true; inst.fly.t = saved.flyT || 0; inst.fly.blend = 1; }
    syncFlyBtn(inst);
  }

  registry.set(card, inst);
  try { io.observe(card); } catch (e) {}
  startLoop();
  return true;
}

export function unmountWebGLProcessGraph(graphEl){
  if (!graphEl) return;
  const card = graphEl.closest('.pgraph-card') || graphEl.parentElement || graphEl;
  if (registry.has(card)) teardown(card);
}

// Expose disposers for engine.js (sync access without re-import).
if (typeof window !== 'undefined') {
  window.__webglChartsLoaded = true;
  window.__disposeWebGLChart = unmountWebGLChart;
  window.__disposeWebGLProcessGraph = unmountWebGLProcessGraph;
}
