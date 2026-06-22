// Regression check: confirm the split is byte-faithful to the original.
import fs from 'node:fs';

const lines = fs.readFileSync('celonis-merged.html', 'utf8').split('\n');
const slice = (a, b) => lines.slice(a - 1, b).join('\n');
const stripWs = (s) => s.replace(/\s+/g, '');

let ok = true;
const check = (label, cond) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

// 1) CSS: union of the 6 files === original CSS block (lines 8..1511), ignoring whitespace.
const cssFiles = ['tokens.css', 'shell.css', 'views.css', 'charts.css', 'knobs.css', 'components.css'];
const cssCat = cssFiles.map((f) => fs.readFileSync('src/styles/' + f, 'utf8')).join('\n');
check('CSS concatenation matches original (whitespace-insensitive)', stripWs(cssCat) === stripWs(slice(8, 1511)));

// 2) engine.js begins with the exact original script-1 body (lines 5336..6201).
const engine = fs.readFileSync('src/scripts/engine.js', 'utf8');
const engineBody = slice(5336, 6201);
check('engine.js contains original script-1 body verbatim', engine.startsWith(engineBody));

// 3) shell.js === original script-2 (lines 6206..6468) + import prefix, with only the 2 IA swaps.
const shell = fs.readFileSync('src/scripts/shell.js', 'utf8');
let shellExpected = slice(6206, 6468)
  .replace('if(window.IA&&window.IA.selectView) window.IA.selectView(v);', 'selectView(v);')
  .replace('if(window.IA&&av){ window.IA.renderChartsIn(av); window.IA.runCounters(av); }', 'if(av){ renderChartsIn(av); runCounters(av); }');
shellExpected = "import { selectView, renderChartsIn, runCounters } from './engine.js';\n\n" + shellExpected;
check('shell.js matches original script-2 plus the 2 intended IA swaps', shell.trim() === shellExpected.trim());

// 4) the 2 IA swaps actually happened (no leftover window.IA bridge calls).
check('no leftover window.IA.* calls in shell.js', !/window\.IA\./.test(shell));

console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
