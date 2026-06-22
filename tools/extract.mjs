// One-shot mechanical extractor: carves celonis-merged.html into src/ modules.
// Run with: node tools/extract.mjs
import fs from 'node:fs';

const SRC = 'celonis-merged.html';
const lines = fs.readFileSync(SRC, 'utf8').split('\n');
// 1-indexed inclusive slice
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

// ---- CSS: contiguous, order-preserving sections (content lives on lines 8..1511) ----
const cssSections = [
  ['tokens.css', 8, 162],       // reset, design tokens, color/vivid themes, density, body, svg stops, light mode
  ['shell.css', 163, 530],      // app shell, L0 flyout, flowy layers, slider radii, inverted L0, tab base styles
  ['views.css', 531, 726],      // process explorer, OTD, edit panel, final radius pass, homepage
  ['charts.css', 727, 845],     // rework & quality charts view + slide-fade transition
  ['knobs.css', 846, 968],      // intensity, shell sep, composition, KPI numerals, tab model, tables, ctx menu, inverted
  ['components.css', 969, 1511], // token bridge, avatar, popovers, modals, space view, ctx menus, L1 actions, late overrides
];
for (const [name, a, b] of cssSections) {
  fs.writeFileSync(`src/styles/${name}`, slice(a, b).replace(/^\n/, '') + '\n');
}

// ---- engine.js: script 1 body (outer IIFE wrapper at 5335/6202 removed) ----
let engine = slice(5336, 6201);
engine += '\n\nexport { selectView, renderChartsIn, runCounters };\n';
fs.writeFileSync('src/scripts/engine.js', engine + '\n');

// ---- shell.js: script 2 (two IIFEs); swap window.IA bridge for explicit imports ----
let shell = slice(6206, 6468);
shell = shell.replace(
  'if(window.IA&&window.IA.selectView) window.IA.selectView(v);',
  'selectView(v);'
);
shell = shell.replace(
  'if(window.IA&&av){ window.IA.renderChartsIn(av); window.IA.runCounters(av); }',
  'if(av){ renderChartsIn(av); runCounters(av); }'
);
shell = "import { selectView, renderChartsIn, runCounters } from './engine.js';\n\n" + shell;
fs.writeFileSync('src/scripts/shell.js', shell + '\n');

// ---- main.js: entry — CSS first (applied before engine runs), then engine, then shell ----
const main = `// App entry. Vite bundles + hashes the CSS imports; importing them before
// the engine guarantees styles are applied before any layout measurement.
import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/views.css';
import '../styles/charts.css';
import '../styles/knobs.css';
import '../styles/components.css';

import './engine.js';
import './shell.js';
`;
fs.writeFileSync('src/scripts/main.js', main);

// ---- index.html: markup only; single </head>/<body> (fixes the duplicate); module entry ----
const head = slice(1, 6);
const body = slice(1517, 5332);
const tail = lines.slice(6469).join('\n'); // line 6470 onward (</body> [+ </html>])
const indexHtml =
  head +
  '\n</head>\n<body>\n' +
  body +
  '\n<script type="module" src="/src/scripts/main.js"></script>\n' +
  tail +
  (tail.endsWith('\n') ? '' : '\n');
fs.writeFileSync('index.html', indexHtml);

// ---- report ----
const sz = (p) => (fs.statSync(p).size / 1024).toFixed(1) + ' kB';
console.log('index.html        ', sz('index.html'), `(${indexHtml.split('\n').length} lines)`);
for (const [name] of cssSections) console.log('src/styles/' + name.padEnd(16), sz('src/styles/' + name));
console.log('src/scripts/engine.js', sz('src/scripts/engine.js'));
console.log('src/scripts/shell.js ', sz('src/scripts/shell.js'));
console.log('src/scripts/main.js  ', sz('src/scripts/main.js'));
