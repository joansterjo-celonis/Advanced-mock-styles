// One-shot: move the SVG iso/glass/sheen toolkit + colour utils out of engine.js
// into a reusable effects.js module. Run: node tools/extract-effects.mjs
import fs from 'node:fs';

let eng = fs.readFileSync('src/scripts/engine.js', 'utf8');

const nsLine = "      const NS = 'http://www.w3.org/2000/svg';\n";
const eLine = "      function E(t, a){ const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); return e; }\n";

const startMarker = '      function svgText(E2,x,y,s,a){';
const endMarker = '      /* ---- COMBO chart (bars + line, dual axis) — size-aware ---- */';
const si = eng.indexOf(startMarker);
const ei = eng.indexOf(endMarker);
if (si < 0 || ei < 0 || ei < si) { console.error('markers not found', { si, ei }); process.exit(1); }
const toolkit = eng.slice(si, ei);

// ---- build effects.js ----
let body = toolkit.replace(/^ {6}/gm, '');               // dedent the 6-space IIFE indent
body = body.replace(/(^|\n)function (svgText|chartMode|cssVar|toRGB|shadeC|rgbaC|resolveColor|ensureSoftShadow|sheenGrad|sphere|bar3dV|bar3dH)/g, '$1export function $2');
body = body.replace(/\nlet _gid=0;\n/, '\n');             // _gid now lives at the top with an accessor
body = body.replace(/_gid\+\+/g, 'nextGid()');

const effects =
`// ============================================================
//  Reusable visual-effects layer.
//  SVG isometric / glass / sheen builders + colour-resolution utils,
//  shared by every chart. Import these to add new glassy effects
//  without reaching into engine.js.
// ============================================================

const NS = 'http://www.w3.org/2000/svg';
export function E(t, a){ const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); return e; }

let _gid = 0;
export function nextGid(){ return _gid++; }

${body.trimEnd()}
`;
fs.writeFileSync('src/scripts/effects.js', effects);

// ---- rewrite engine.js ----
eng = eng.replace(toolkit, '');
eng = eng.replace(nsLine, '');
eng = eng.replace(eLine, '');
eng = eng.replace(/_gid\+\+/g, 'nextGid()');             // pie()'s remaining usage
eng = eng.replace(
  "import { PALETTE, rng, series, N, RQ_BARS, RQ_PIE, RQ_CASES, RQ_ACTIVITIES } from '../data/data.js';",
  "import { PALETTE, rng, series, N, RQ_BARS, RQ_PIE, RQ_CASES, RQ_ACTIVITIES } from '../data/data.js';\nimport { E, svgText, chartMode, cssVar, toRGB, shadeC, rgbaC, resolveColor, ensureSoftShadow, sheenGrad, sphere, bar3dV, bar3dH, nextGid } from './effects.js';"
);
fs.writeFileSync('src/scripts/engine.js', eng);

const has = (s, t) => s.includes(t);
console.log('effects.js written:', (fs.statSync('src/scripts/effects.js').size / 1024).toFixed(1) + ' kB');
console.log('engine.js still references _gid:', /_gid/.test(eng) ? 'YES (BAD)' : 'no');
console.log('engine.js still references _ccx:', /_ccx/.test(eng) ? 'YES (BAD)' : 'no');
console.log('engine.js still defines NS:', /const NS =/.test(eng) ? 'YES (BAD)' : 'no');
console.log('engine.js imports effects:', has(eng, "from './effects.js'") ? 'yes' : 'NO (BAD)');
