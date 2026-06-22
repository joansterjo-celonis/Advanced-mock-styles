// Repeatable structural audit for the split prototype (run: `npm run audit`).
//
// Scans the live source set — index.html + src/** — and ONLY that set (dist/
// build output and the legacy *.html monoliths are ignored). Findings are
// CANDIDATES to review, not proof; the heuristics are regex-based and can't
// see classes assembled from computed strings. Three reports:
//
//   (a) dead code .... CSS classes / ids / custom properties defined but never
//                      referenced from HTML or JS (bloat / leftovers).
//   (b) duplicate svg . identical inline <svg> path `d` data used more than once
//                      (icon-dedup candidates → move into src/scripts/icons.js).
//   (c) missed glass .. overlay-like surfaces (.modal-card, *-pop, *menu, gsearch,
//                      *-overlay children) not covered by the glass manifest in
//                      effects.css (so none silently ships opaque).
//
// Exit code is always 0 — this is an advisory report, not a gate.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
}

const read = (f) => readFileSync(f, 'utf8');
const uniq = (a) => [...new Set(a)];
const bullet = (a) => a.map((x) => '    · ' + x).join('\n');

const srcFiles = [];
walk(join(ROOT, 'src'), srcFiles);
const html = read(join(ROOT, 'index.html'));
const cssText = srcFiles.filter((f) => f.endsWith('.css')).map(read).join('\n');
const jsText = srcFiles.filter((f) => f.endsWith('.js')).map(read).join('\n');
const effects = read(join(ROOT, 'src/styles/effects.css'));

// Where a class/id/var could legitimately be *referenced* (rendered or wired).
const usage = html + '\n' + jsText;
// Whole-token match: `tab` must not match inside `table`, `tabbar` or `data-tab`.
const used = (name) => new RegExp('(?<![\\w-])' + name.replace(/[-]/g, '\\-') + '(?![\\w-])').test(usage);

let warnings = 0;
const section = (title) => console.log('\n\u2500\u2500 ' + title + ' ' + '\u2500'.repeat(Math.max(2, 58 - title.length)));

/* ------------------------------------------------------------------ */
/* (a) dead CSS classes / ids / custom properties                     */
/* ------------------------------------------------------------------ */
section('(a) dead code — defined in CSS, never referenced in HTML/JS');

// Read selector text only: drop comments, then take the run of text that
// precedes each "{" (after the previous "}"/";"). This skips declaration
// values and nested at-rule bodies, so hex colors / url()s never leak in.
const noComments = cssText.replace(/\/\*[\s\S]*?\*\//g, ' ');
const selectorsOnly = noComments.split('{').map((chunk) => {
  const afterBody = chunk.slice(chunk.lastIndexOf('}') + 1);
  return afterBody.slice(afterBody.lastIndexOf(';') + 1);
}).join(' ');
const isHex = (s) => /^[0-9a-fA-F]{3,8}$/.test(s);
const definedClasses = uniq([...selectorsOnly.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const definedIds = uniq([...selectorsOnly.matchAll(/#([a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((i) => !isHex(i)));
const definedVars = uniq([...cssText.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

const deadClasses = definedClasses.filter((c) => !used(c)).sort();
const deadIds = definedIds.filter((i) => !used(i)).sort();
// A var is live if it's read via var() anywhere — CSS, JS, OR inline style="" in the HTML.
const deadVars = definedVars.filter((v) => !new RegExp('var\\(\\s*' + v.replace(/-/g, '\\-') + '\\b').test(cssText + jsText + html)).sort();

if (deadClasses.length) { warnings++; console.log('  classes (' + deadClasses.length + '):\n' + bullet(deadClasses.map((c) => '.' + c))); }
if (deadIds.length) { warnings++; console.log('  ids (' + deadIds.length + '):\n' + bullet(deadIds.map((i) => '#' + i))); }
if (deadVars.length) { warnings++; console.log('  custom properties (' + deadVars.length + '):\n' + bullet(deadVars)); }
if (!deadClasses.length && !deadIds.length && !deadVars.length) console.log('  none \u2713');

/* ------------------------------------------------------------------ */
/* (b) duplicate inline svg paths (icon dedup candidates)             */
/* ------------------------------------------------------------------ */
section('(b) duplicate inline <svg> path data — move into icons.js');

const paths = [...(html + jsText).matchAll(/\bd="([^"]{12,})"/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
const counts = paths.reduce((m, d) => (m.set(d, (m.get(d) || 0) + 1), m), new Map());
const dupes = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
if (dupes.length) {
  warnings++;
  console.log('  ' + dupes.length + ' path(s) duplicated:');
  for (const [d, n] of dupes) console.log('    \u00d7' + n + '  d="' + (d.length > 64 ? d.slice(0, 61) + '\u2026' : d) + '"');
} else console.log('  none \u2713');

/* ------------------------------------------------------------------ */
/* (c) overlay surfaces not covered by the glass manifest             */
/* ------------------------------------------------------------------ */
section('(c) missed glass — overlay surfaces outside the effects.css manifest');

// Pull the manifest selector list straight from effects.css (the rule that
// sets both background:var(--glass-bg) and backdrop-filter), so this check
// tracks the single source of truth automatically.
const effectsNoComments = effects.replace(/\/\*[\s\S]*?\*\//g, ' ');
const manifestRule = effectsNoComments.match(/([^{}]*)\{[^{}]*var\(--glass-bg\)[^{}]*backdrop-filter[^{}]*\}/);
const manifest = new Set(manifestRule ? [...manifestRule[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]) : []);
manifest.add('glass'); // the alias every covered element may also carry

// Candidate overlay classes present in the markup.
const classTokens = uniq([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
const looksOverlay = (c) => /-pop$/.test(c) || /menu$/.test(c) || c === 'modal-card' || c === 'gsearch';
const candidates = classTokens.filter(looksOverlay);

const missed = candidates.filter((c) => {
  if (manifest.has(c)) return false;
  // covered if every element carrying this class also carries `glass`
  const re = new RegExp('class="([^"]*\\b' + c.replace(/-/g, '\\-') + '\\b[^"]*)"', 'g');
  const occ = [...html.matchAll(re)].map((m) => m[1]);
  return occ.length > 0 && !occ.every((cls) => /\bglass\b/.test(cls));
});

if (missed.length) {
  warnings++;
  console.log('  overlay-like classes not in the manifest and not aliased .glass:');
  console.log(bullet(uniq(missed).map((c) => '.' + c)));
  console.log('    \u2192 add the selector to the OVERLAY manifest in src/styles/effects.css');
} else console.log('  manifest covers every overlay surface found \u2713  (' + [...manifest].map((c) => '.' + c).join(', ') + ')');

/* ------------------------------------------------------------------ */
console.log('\n' + (warnings ? '\u26a0 audit finished with ' + warnings + ' report group(s) above to review.'
                              : '\u2713 audit clean — no dead code, duplicate icons, or missed glass surfaces.'));
process.exit(0);
