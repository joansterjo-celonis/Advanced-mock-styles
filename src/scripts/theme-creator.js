import { icon } from './icons.js';
import { VIVID_COMBOS, VIVID_COMBO_MAP, DEFAULT_VIVID_COMBO } from '../data/data.js';

const DEFAULT_DRAFT = {
  appearance: 'light',
  palette: 'mono',
  vividPalette: DEFAULT_VIVID_COMBO,
  accent: '#6366f1',
  energy: 'strategic',
  layout: 'default',
  shell: 'tinted',
  finish: 'flat',
  glass: 0,
  glassAdvanced: false,
  glassOp: 0,
  glassBl: 0,
  surfaceRadius: 12,
  controlRadius: 9,
  density: 'spacious',
  // advanced (decoupled) density is a proto-panel power feature; the creator only offers
  // the 3 presets, so it just carries these through untouched to avoid a lossy round-trip.
  densityAdv: false,
  densityPad: null,
  densityGap: null,
  composition: 'bento',
  tabs: 'filled',
  tabColor: null,
  tabFx: 'flat',
  kpiFont: 'sans',
  kpiWeight: 600,
  numFeats: [],
  tables: 'plain',
  charts: 'flat',
  chartFill: 'classic',
  chartScope: 'accent',
  name: '',
};

const ACCENTS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#111827'];

const STEPS = [
  {
    id: 'appearance',
    eyebrow: 'Step 1',
    title: 'Choose the atmosphere',
    copy: 'Set the base surface for the entire product before tuning color and detail.',
    groups: [
      {
        key: 'appearance',
        label: 'Appearance',
        options: [
          { value: 'light', title: 'Luminous', desc: 'Light mode, tinted shell, flat surfaces, no glass.', art: 'appearance-light', knobs: ['Light', 'Tinted', 'Flat', '0% glass'] },
          { value: 'dark', title: 'Nocturne', desc: 'Dark mode, tinted shell, flat surfaces, no glass.', art: 'appearance-dark', knobs: ['Dark', 'Tinted', 'Flat', '0% glass'] },
          { value: 'obsidian', title: 'Dark Contrast', desc: 'Dark mode with contrast shell, frosted finish, and stronger global glass.', art: 'appearance-obsidian', knobs: ['Dark', 'Contrast', 'Frosted', '36% glass'] },
        ],
      },
    ],
  },
  {
    id: 'color',
    eyebrow: 'Step 2',
    title: 'Define the color language',
    copy: 'Pick how much color the product should carry, then set the accent used for active states.',
    groups: [
      {
        key: 'palette',
        label: 'Palette system',
        options: [
          { value: 'mono', title: 'Mono', desc: 'Single-ink hierarchy with minimal chroma and maximum calm.', art: 'palette-mono' },
          { value: 'color', title: 'Color', desc: 'A controlled brand hue for charts, tabs, and primary actions.', art: 'palette-color' },
          { value: 'vivid', title: 'Vivid', desc: 'Multi-hue storytelling for high-energy dashboards and chart suites.', art: 'palette-vivid' },
        ],
      },
      { key: 'vividPalette', label: 'Color combo', type: 'vivid-combo' },
      { key: 'accent', label: 'Accent hue', type: 'accent' },
    ],
  },
  {
    id: 'energy',
    eyebrow: 'Step 3',
    title: 'Set the visual energy',
    copy: 'Dial how expressive shadows, gloss, and glass should feel across the shell.',
    groups: [
      {
        key: 'energy',
        label: 'Intensity',
        options: [
          { value: 'calm', title: 'Calm', desc: 'Matte, quiet, and intentionally restrained.', art: 'energy-calm' },
          { value: 'strategic', title: 'Strategic', desc: 'Balanced polish with enough depth to guide attention.', art: 'energy-strategic' },
          { value: 'expressive', title: 'Expressive', desc: 'Rich shadows, stronger highlights, and more visual lift.', art: 'energy-expressive' },
        ],
      },
      { key: 'glass', label: 'Global glass', type: 'range', min: 0, max: 100, suffix: '%', art: 'glass' },
    ],
  },
  {
    id: 'surfaces',
    eyebrow: 'Step 4',
    title: 'Shape the shell and surfaces',
    copy: 'Choose the structure, separation, finish, and corner language for the product chrome.',
    groups: [
      {
        key: 'layout',
        label: 'Main layout',
        options: [
          { value: 'default', title: 'Default', desc: 'Stable workbench layout with familiar platform geometry.', art: 'layout-default' },
          { value: 'flowy', title: 'Flowy', desc: 'Layered canvas with more spatial softness between surfaces.', art: 'layout-flowy' },
          { value: 'flap', title: 'Flap', desc: 'A fused active tab treatment for a stronger editor feel.', art: 'layout-flap' },
        ],
      },
      {
        key: 'shell',
        label: 'Shell separation',
        options: [
          { value: 'seamless', title: 'Seamless', desc: 'Chrome and workspace blend into one continuous material.', art: 'shell-seamless' },
          { value: 'tinted', title: 'Tinted', desc: 'Subtle contrast without introducing heavy boundaries.', art: 'shell-tinted' },
          { value: 'contrast', title: 'Contrast', desc: 'Strong chrome frame that makes content feel inset.', art: 'shell-contrast' },
        ],
      },
      {
        key: 'finish',
        label: 'Surface finish',
        options: [
          { value: 'flat', title: 'Flat', desc: 'Crisp opaque panels with clean borders.', art: 'finish-flat' },
          { value: 'frost', title: 'Frosted', desc: 'Soft translucent panels with light diffusion.', art: 'finish-frost' },
        ],
      },
      { key: 'surfaceRadius', label: 'Surface radius', type: 'range', min: 0, max: 28, suffix: 'px', art: 'surface-radius' },
      { key: 'controlRadius', label: 'Control radius', type: 'range', min: 0, max: 20, suffix: 'px', art: 'control-radius' },
    ],
  },
  {
    id: 'content',
    eyebrow: 'Step 5',
    title: 'Tune content and interaction',
    copy: 'Pick how dashboard sections, tabs, tables, and KPI numerals should communicate.',
    groups: [
      {
        key: 'density',
        label: 'Density',
        options: [
          { value: 'spacious', title: 'Spacious', desc: 'Airy spacing for executive readability.', art: 'density-spacious' },
          { value: 'compact', title: 'Compact', desc: 'More information with comfortable touch targets.', art: 'density-compact' },
          { value: 'dense', title: 'Dense', desc: 'Maximum analytical throughput for power users.', art: 'density-dense' },
        ],
      },
      {
        key: 'tabs',
        label: 'Tabs',
        options: [
          { value: 'filled', title: 'Filled', desc: 'Pill-like active state for clear selection.', art: 'tabs-filled' },
          { value: 'underline', title: 'Underline', desc: 'Lightweight navigation with a crisp active indicator.', art: 'tabs-underline' },
          { value: 'color', title: 'Color', desc: 'Brand-colored tabs for a stronger product signature.', art: 'tabs-color' },
        ],
      },
      {
        key: 'kpiFont',
        label: 'Numeral font',
        options: [
          { value: 'sans', title: 'Sans', desc: 'Clean product numerals with broad readability.', art: 'font-sans' },
          { value: 'mono', title: 'Mono', desc: 'Tabular precision for analytical dashboards.', art: 'font-mono' },
          { value: 'serif', title: 'Serif', desc: 'Editorial emphasis for high-level storytelling.', art: 'font-serif' },
        ],
      },
      { key: 'kpiWeight', label: 'Numeral weight', type: 'range', min: 100, max: 800, step: 100, suffix: '', art: 'kpi-weight' },
      { key: 'numFeats', label: 'Inter features', type: 'feats' },
      {
        key: 'tables',
        label: 'Tables',
        options: [
          { value: 'plain', title: 'Plain', desc: 'Quiet rows and minimal grid friction.', art: 'tables-plain' },
          { value: 'lined', title: 'Lined', desc: 'Alternating treatment for dense row scanning.', art: 'tables-lined' },
        ],
      },
    ],
  },
  {
    id: 'charts',
    eyebrow: 'Step 6',
    title: 'Style the data visualization',
    copy: 'Choose how charts render depth, dimensionality, and where that effect is allowed.',
    groups: [
      {
        key: 'charts',
        label: '3D charts',
        options: [
          { value: 'flat', title: 'Flat', desc: 'Fast, editorial, and precise.', art: 'charts-flat' },
          { value: 'iso', title: 'Isometric', desc: 'Dimensional bars and tilted surfaces for hero impact.', art: 'charts-iso' },
          { value: 'glass', title: 'Glass', desc: 'Glossy, translucent chart materials that match frosted surfaces.', art: 'charts-glass' },
          { value: 'webgl', title: 'WebGL', desc: 'Real interactive 3D charts rendered with three.js — lit, glossy, and orbitable.', art: 'charts-webgl' },
        ],
      },
      {
        key: 'chartFill',
        label: 'Fill style',
        options: [
          { value: 'classic', title: 'Classic', desc: 'Solid color fills — series separated by hue alone.', art: 'fill-classic' },
          { value: 'pattern', title: 'Patterns', desc: 'Hatching, dots, and crosshatch textures over each series, so charts read without relying on color.', art: 'fill-pattern' },
        ],
      },
      {
        key: 'chartScope',
        label: 'Applies to',
        options: [
          { value: 'accent', title: 'Hero only', desc: 'Reserve depth for the focal chart.', art: 'scope-accent' },
          { value: 'full', title: 'All charts', desc: 'Apply the visualization language across every chart.', art: 'scope-full' },
        ],
      },
      {
        key: 'tabFx',
        label: 'Transitions',
        options: [
          { value: 'flat', title: 'Default', desc: 'Immediate tab changes with no extra motion.', art: 'motion-flat' },
          { value: 'slide', title: 'Slide', desc: 'A gentle slide-fade for richer navigation.', art: 'motion-slide' },
        ],
      },
    ],
  },
  {
    id: 'save',
    eyebrow: 'Step 7',
    title: 'Review and save',
    copy: 'Name the finished theme. Saving creates a new preset and selects it in the existing Presets carousel.',
    review: true,
  },
];

let overlay;
let stepIndex = 0;
let draft = clone(DEFAULT_DRAFT);
let baseline = null;
let saved = false;
let previewShell = null;
let previewCountersDone = false;

export function initThemeCreator() {
  if (typeof document === 'undefined') return;
  const opener = document.getElementById('theme-creator-open');
  if (!opener || opener.dataset.tcReady) return;
  opener.dataset.tcReady = 'true';
  opener.addEventListener('click', openCreator);
  document.addEventListener('keydown', onKey);
}

function openCreator() {
  baseline = captureCurrent();
  saved = false;
  previewShell = null;
  previewCountersDone = false;
  stepIndex = 0;
  draft = draftFromState(baseline);
  draft.name = nextThemeName();
  mount();
  overlay.classList.add('open');
  overlay.removeAttribute('aria-hidden');
  applyDraft();
  render();
}

function mount() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'tc-overlay';
  overlay.id = 'theme-creator-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="tc-modal glass" role="dialog" aria-modal="true" aria-labelledby="tc-title">
      <div class="tc-head">
        <div class="tc-mark" aria-hidden="true">${icon('settings')}</div>
        <div>
          <div class="tc-kicker">Prototype theming</div>
          <h3 id="tc-title">Theme Creator</h3>
        </div>
        <button type="button" class="tc-close" data-tc-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="tc-shell">
        <aside class="tc-rail" aria-label="Theme creator steps"></aside>
        <main class="tc-stage"></main>
        <aside class="tc-preview" aria-label="Live theme preview"></aside>
      </div>
      <div class="tc-foot">
        <button type="button" class="tc-btn" data-tc-cancel>Cancel</button>
        <span class="tc-save-note" data-tc-note></span>
        <span class="spacer-fill"></span>
        <button type="button" class="tc-btn" data-tc-prev>Back</button>
        <button type="button" class="tc-btn tc-primary" data-tc-next>Next</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', onOverlayClick);
}

function render() {
  if (!overlay) return;
  const step = STEPS[stepIndex];
  applyModalMaterial();
  overlay.querySelector('.tc-rail').innerHTML = renderRail();
  overlay.querySelector('.tc-stage').innerHTML = renderStage(step);
  overlay.querySelector('.tc-preview').innerHTML = renderPreview();
  overlay.querySelector('[data-tc-prev]').disabled = stepIndex === 0;
  overlay.querySelector('[data-tc-next]').textContent = step.review ? 'Save theme' : 'Next';
  overlay.querySelector('[data-tc-note]').textContent = '';
  wireStage();
  hydrateLivePreview();
  hydrateOptionArt();
}

function renderRail() {
  return STEPS.map((step, index) => {
    const state = index < stepIndex ? 'done' : index === stepIndex ? 'active' : '';
    return `<button type="button" class="tc-step ${state}" data-step="${index}" aria-current="${index === stepIndex ? 'step' : 'false'}">
      <span class="tc-step-dot">${index < stepIndex ? icon('check', 'tc-step-check') : index + 1}</span>
      <span><b>${escapeHtml(step.title)}</b><small>${escapeHtml(step.eyebrow)}</small></span>
    </button>`;
  }).join('');
}

function renderStage(step) {
  if (step.review) return renderReview(step);
  const groups = step.groups.filter(isGroupVisible).map(renderGroup).join('');
  return `
    <section class="tc-intro">
      <span>${escapeHtml(step.eyebrow)}</span>
      <h4>${escapeHtml(step.title)}</h4>
      <p>${escapeHtml(step.copy)}</p>
    </section>
    <div class="tc-lab-strip" aria-hidden="true">
      <span><i></i>Live preview</span>
      <span><i></i>Reversible until save</span>
      <span><i></i>Becomes a preset</span>
    </div>
    <div class="tc-groups">
      ${groups}
    </div>`;
}

function renderGroup(group) {
  if (!isGroupVisible(group)) return '';
  if (group.type === 'range') return renderRange(group);
  if (group.type === 'accent') return renderAccent(group);
  if (group.type === 'vivid-combo') return renderVividCombo(group);
  if (group.type === 'feats') return renderFeats(group);
  const options = group.options.filter(option => isOptionVisible(group, option));
  // Underline / Color tabs paint their active state with --tab-color, so offer a color
  // input (mirroring the Accent picker) right where the style is chosen. Filled keeps its
  // fixed pill, and mono palette has no accent step — so this is the only way to color tabs.
  const colorField = group.key === 'tabs' && (draft.tabs === 'underline' || draft.tabs === 'color')
    ? renderTabColor()
    : '';
  return `<section class="tc-group">
    <div class="tc-group-title">${escapeHtml(group.label)}</div>
    <div class="tc-options ${options.length === 2 ? 'two' : ''}">
      ${options.map(option => renderOption(group, option)).join('')}
    </div>
    ${colorField}
  </section>`;
}

function isGroupVisible(group) {
  if (group.key === 'vividPalette') return draft.palette === 'vivid';
  if (group.key === 'accent') return draft.palette !== 'mono';
  if (group.key === 'shell') return draft.layout === 'default';
  if (group.key === 'chartFill') return draft.charts === 'flat';   // Patterns are a flat-only sub-variant
  if (group.key === 'chartScope') return draft.charts !== 'flat';
  // Inter OpenType features only render on the Sans (Inter) numerals; hide them otherwise.
  if (group.key === 'numFeats') return draft.kpiFont === 'sans';
  return true;
}

function isOptionVisible(group, option) {
  if (group.key === 'tabs' && draft.palette === 'mono' && option.value === 'color') return false;
  return true;
}

function renderOption(group, option) {
  const active = draft[group.key] === option.value;
  return `<button type="button" class="tc-option ${active ? 'active' : ''}" data-key="${group.key}" data-value="${option.value}" aria-pressed="${active ? 'true' : 'false'}">
    ${renderArt(option.art, option.value)}
    <span class="tc-option-copy"><b>${escapeHtml(option.title)}</b><small>${escapeHtml(option.desc)}</small>${option.knobs ? `<span class="tc-knob-tags">${option.knobs.map(k => `<i>${escapeHtml(k)}</i>`).join('')}</span>` : ''}</span>
  </button>`;
}

function renderRange(group) {
  if (group.key === 'glass') return renderGlassRange(group);
  const value = draft[group.key];
  return `<section class="tc-group">
    <div class="tc-group-title">${escapeHtml(group.label)}</div>
    <div class="tc-range-card">
      ${renderArt(group.art, group.key, value)}
      <div class="tc-range-main">
        <div class="tc-range-label"><span>${escapeHtml(group.label)}</span><b>${value}${group.suffix || ''}</b></div>
        <input type="range" min="${group.min}" max="${group.max}" step="${group.step || 1}" value="${value}" data-range="${group.key}" data-suffix="${escapeAttr(group.suffix || '')}">
        <div class="tc-range-scale"><span>${group.min}${group.suffix || ''}</span><span>${group.max}${group.suffix || ''}</span></div>
      </div>
    </div>
  </section>`;
}

function renderGlassRange(group) {
  const simple = clamp(draft.glass, group.min, group.max);
  const op = clamp(draft.glassOp, group.min, group.max);
  const bl = clamp(draft.glassBl, group.min, group.max);
  const advanced = !!draft.glassAdvanced;
  const artOp = advanced ? op : simple;
  const artBl = advanced ? bl : simple;
  const valueLabel = advanced ? `${op}% / ${bl}%` : `${simple}%`;
  return `<section class="tc-group">
    <div class="tc-group-title">${escapeHtml(group.label)}</div>
    <div class="tc-range-card tc-glass-card ${advanced ? 'is-advanced' : ''}">
      ${renderArt(group.art, group.key, { level: simple, op: artOp, bl: artBl })}
      <div class="tc-range-main">
        <div class="tc-range-label tc-glass-label">
          <span>${escapeHtml(group.label)}</span>
          <span class="tc-glass-actions"><b>${valueLabel}</b><button type="button" class="tc-advanced-toggle" data-glass-advanced aria-pressed="${advanced ? 'true' : 'false'}">${advanced ? 'Single' : 'Advanced'}</button></span>
        </div>
        <div class="tc-glass-simple" ${advanced ? 'hidden' : ''}>
          <input type="range" min="${group.min}" max="${group.max}" step="${group.step || 1}" value="${simple}" data-range="glass" data-suffix="${escapeAttr(group.suffix || '')}">
          <div class="tc-range-scale"><span>${group.min}${group.suffix || ''}</span><span>${group.max}${group.suffix || ''}</span></div>
        </div>
        <div class="tc-glass-split" ${advanced ? '' : 'hidden'}>
          ${renderGlassAxis('glassOp', 'Translucency', op)}
          ${renderGlassAxis('glassBl', 'Glassiness', bl)}
        </div>
      </div>
    </div>
  </section>`;
}

function renderGlassAxis(key, label, value) {
  return `<div class="tc-glass-axis">
    <div class="tc-axis-label"><span>${escapeHtml(label)}</span><b data-glass-axis-value="${key}">${value}%</b></div>
    <input type="range" min="0" max="100" step="1" value="${value}" data-range="${key}" data-suffix="%">
  </div>`;
}

function renderAccent(group) {
  return `<section class="tc-group">
    <div class="tc-group-title">${escapeHtml(group.label)}</div>
    <div class="tc-accent-row" role="radiogroup" aria-label="${escapeHtml(group.label)}">
      ${ACCENTS.map(color => `<button type="button" class="tc-accent ${draft.accent === color ? 'active' : ''}" data-accent="${color}" style="--tc-swatch:${color}" aria-label="${color}" aria-pressed="${draft.accent === color ? 'true' : 'false'}"></button>`).join('')}
      <label class="tc-color-field"><input type="color" value="${draft.accent}" data-accent-input><span>Custom</span></label>
    </div>
  </section>`;
}

// Vivid-only sub-picker: the multi-hue chart combo. Buttons carry data-key/data-value so
// they ride the shared wireStage() handler (draft.vividPalette -> applyDraft -> render).
function vividComboGradient(cols) {
  const n = cols.length;
  return 'linear-gradient(135deg,' + cols.map((c, i) => `${c} ${(i / n * 100).toFixed(2)}%, ${c} ${((i + 1) / n * 100).toFixed(2)}%`).join(',') + ')';
}
function renderVividCombo(group) {
  const current = draft.vividPalette && VIVID_COMBO_MAP[draft.vividPalette] ? draft.vividPalette : DEFAULT_VIVID_COMBO;
  return `<section class="tc-group">
    <div class="tc-group-title">${escapeHtml(group.label)} <span class="tc-group-note">Vivid chart hues</span></div>
    <div class="tc-combo-row" role="radiogroup" aria-label="${escapeHtml(group.label)}">
      ${VIVID_COMBOS.map(combo => {
        const active = current === combo.id;
        return `<button type="button" class="tc-combo ${active ? 'active' : ''}" data-key="vividPalette" data-value="${combo.id}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeAttr(combo.label)}">
          <span class="tc-combo-chip" style="background:${vividComboGradient(combo.swatch)}"></span>
          <span class="tc-combo-name">${escapeHtml(combo.label)}</span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}

// Inter OpenType feature toggles (independent on/off, not a radio group). Each glyph previews
// its own feature live. State is the draft.numFeats array, threaded through buildState/draftFromState.
const NUM_FEATS = [
  { value: 'zero', glyph: '0', title: 'Slashed zero' },
  { value: 'ss01', glyph: '1', title: 'Alternate digits' },
  { value: 'ss02', glyph: 'Il', title: 'Disambiguation' },
];

function renderFeats(group) {
  const active = Array.isArray(draft.numFeats) ? draft.numFeats : [];
  return `<section class="tc-group">
    <div class="tc-group-title">${escapeHtml(group.label)} <span class="tc-group-note">Inter “Sans” numerals</span></div>
    <div class="tc-feats" role="group" aria-label="${escapeHtml(group.label)}">
      ${NUM_FEATS.map(f => {
        const on = active.includes(f.value);
        return `<button type="button" class="tc-feat ${on ? 'active' : ''}" data-feat="${f.value}" aria-pressed="${on ? 'true' : 'false'}"><b>${escapeHtml(f.glyph)}</b><span>${escapeHtml(f.title)}</span></button>`;
      }).join('')}
    </div>
  </section>`;
}

// Sub-picker shown under the Tabs options for Underline / Color. Reuses the Accent
// picker's swatch styling. tabColor is null until the user overrides it, in which case
// tabs follow the global accent (see effectiveTabColor / buildState).
function renderTabColor() {
  const current = effectiveTabColor();
  const match = color => current.toLowerCase() === color.toLowerCase();
  return `<div class="tc-subfield">
    <div class="tc-subfield-label">Tab color</div>
    <div class="tc-accent-row" role="radiogroup" aria-label="Tab color">
      ${ACCENTS.map(color => `<button type="button" class="tc-accent ${match(color) ? 'active' : ''}" data-tab-color="${color}" style="--tc-swatch:${color}" aria-label="${color}" aria-pressed="${match(color) ? 'true' : 'false'}"></button>`).join('')}
      <label class="tc-color-field"><input type="color" value="${current}" data-tab-color-input><span>Custom</span></label>
    </div>
  </div>`;
}

function effectiveTabColor() {
  return draft.tabColor || draft.accent;
}

function renderReview(step) {
  return `<section class="tc-intro">
    <span>${escapeHtml(step.eyebrow)}</span>
    <h4>${escapeHtml(step.title)}</h4>
    <p>${escapeHtml(step.copy)}</p>
  </section>
  <section class="tc-review-card">
    <label class="tc-name-label" for="tc-theme-name">Theme name</label>
    <input id="tc-theme-name" class="tc-name-input" maxlength="40" value="${escapeAttr(draft.name)}" placeholder="Theme name" autocomplete="off" spellcheck="false">
    <div class="tc-review-grid">
      ${summaryItems().map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}
    </div>
  </section>`;
}

function renderPreview() {
  return `<div class="tc-preview-sticky">
    <div class="tc-preview-head">
      <span>Live preview</span>
      <b>${escapeHtml(summaryName())}</b>
    </div>
    <div class="tc-real-preview">
      <div class="tc-real-camera" data-tc-camera></div>
    </div>
    <div class="tc-preview-chips">
      ${summaryItems().slice(0, 6).map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join('')}
    </div>
  </div>`;
}

/* The live preview is the real product: clone the active #route-context shell
   (L1 + tabbar + Order Management view), strip ids so live elements stay unique,
   make it inert, and let the genuine prototype CSS (driven by the html data-*
   attributes applyState() sets) render Flowy/Flap/Density/Tabs/Charts 1:1. */
function buildPreviewShell() {
  const route = document.getElementById('route-context');
  if (!route) return null;
  const clone = route.cloneNode(true);
  clone.classList.add('tc-clone-route', 'active');
  clone.classList.remove('mode-overview');
  clone.classList.add('mode-editor');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  const overview = clone.querySelector('.ctx-overview');
  if (overview) overview.remove();
  clone.querySelectorAll('.view').forEach(view => {
    if (view.getAttribute('data-view') === 'order-management') view.classList.add('active');
    else view.remove();
  });
  // Normalise the editor tab bar to match the forced view. The clone inherits whatever tab was
  // focused in the live app when the creator opened, so without this the active-tab treatment
  // (esp. the Flap/Flowy "main layout" fusion) lands on a stale, often off-screen tab while the
  // Order Management content shows with no active tab. Pin the Order Management tab active.
  const editorTabs = clone.querySelectorAll('.tabbar .ia-tab');
  if (editorTabs.length) {
    let matched = false;
    editorTabs.forEach(tab => {
      const isView = tab.getAttribute('data-view') === 'order-management';
      tab.classList.toggle('active', isView);
      if (isView) matched = true;
    });
    if (!matched) editorTabs[0].classList.add('active');
  }
  const keepIds = new Set(['route-context', 'l1', 'main', 'content']);
  clone.querySelectorAll('[id]').forEach(el => { if (!keepIds.has(el.id)) el.removeAttribute('id'); });
  clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
  return clone;
}

function glassValueLabel() {
  if (!draft.glassAdvanced) return `${clamp(draft.glass, 0, 100)}%`;
  return `${clamp(draft.glassOp, 0, 100)}% / ${clamp(draft.glassBl, 0, 100)}%`;
}

function updateGlassArtVars(art) {
  if (!art) return;
  const level = clamp(draft.glass, 0, 100);
  const op = draft.glassAdvanced ? clamp(draft.glassOp, 0, 100) : level;
  const bl = draft.glassAdvanced ? clamp(draft.glassBl, 0, 100) : level;
  art.style.setProperty('--tc-level', level);
  art.style.setProperty('--tc-op', op);
  art.style.setProperty('--tc-bl', bl);
}

function wireStage() {
  overlay.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      stepIndex = Number(btn.dataset.step);
      render();
    });
  });
  overlay.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      draft[key] = btn.dataset.value;
      applyChoiceSideEffects(key, draft[key]);
      applyDraft();
      render();
    });
  });
  overlay.querySelectorAll('[data-glass-advanced]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-pressed') !== 'true';
      draft.glassAdvanced = next;
      if (next) {
        draft.glassOp = clamp(draft.glass, 0, 100);
        draft.glassBl = clamp(draft.glass, 0, 100);
      } else {
        draft.glass = Math.max(clamp(draft.glassOp, 0, 100), clamp(draft.glassBl, 0, 100));
        draft.glassOp = draft.glass;
        draft.glassBl = draft.glass;
      }
      applyDraft();
      render();
    });
  });
  overlay.querySelectorAll('[data-range]').forEach(input => {
    input.addEventListener('input', () => {
      const rangeKey = input.dataset.range;
      draft[rangeKey] = Number(input.value);
      if (rangeKey === 'glass' && !draft.glassAdvanced) {
        draft.glassOp = draft.glass;
        draft.glassBl = draft.glass;
      }
      applyDraft();
      const label = input.closest('.tc-range-card').querySelector('.tc-range-label b');
      if (label) label.textContent = rangeKey === 'glass' || rangeKey === 'glassOp' || rangeKey === 'glassBl'
        ? glassValueLabel()
        : `${input.value}${input.dataset.suffix || ''}`;
      const axisLabel = input.closest('.tc-glass-axis')?.querySelector('[data-glass-axis-value]');
      if (axisLabel) axisLabel.textContent = `${input.value}${input.dataset.suffix || ''}`;
      const art = input.closest('.tc-range-card').querySelector('.tc-art');
      if (art) {
        if (rangeKey === 'glass' || rangeKey === 'glassOp' || rangeKey === 'glassBl') updateGlassArtVars(art);
        else art.style.setProperty('--tc-level', input.value);
      }
      refreshLivePreview();
    });
  });
  overlay.querySelectorAll('[data-accent]').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.accent = btn.dataset.accent;
      applyDraft();
      render();
    });
  });
  overlay.querySelectorAll('[data-feat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const feat = btn.dataset.feat;
      const set = new Set(Array.isArray(draft.numFeats) ? draft.numFeats : []);
      if (set.has(feat)) set.delete(feat); else set.add(feat);
      draft.numFeats = [...set];
      applyDraft();
      render();
    });
  });
  const colorInput = overlay.querySelector('[data-accent-input]');
  if (colorInput) colorInput.addEventListener('input', () => {
    draft.accent = colorInput.value;
    applyDraft();
    refreshLivePreview();
  });
  overlay.querySelectorAll('[data-tab-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.tabColor = btn.dataset.tabColor;
      applyDraft();
      render();
    });
  });
  const tabColorInput = overlay.querySelector('[data-tab-color-input]');
  if (tabColorInput) tabColorInput.addEventListener('input', () => {
    draft.tabColor = tabColorInput.value;
    applyDraft();
    refreshLivePreview();
  });
  const nameInput = overlay.querySelector('#tc-theme-name');
  if (nameInput) {
    nameInput.focus();
    nameInput.select();
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; });
  }
  overlay.querySelector('[data-tc-prev]').onclick = () => {
    stepIndex = Math.max(0, stepIndex - 1);
    render();
  };
  overlay.querySelector('[data-tc-next]').onclick = () => {
    if (STEPS[stepIndex].review) saveTheme();
    else {
      stepIndex = Math.min(STEPS.length - 1, stepIndex + 1);
      render();
    }
  };
  overlay.querySelector('[data-tc-cancel]').onclick = closeAndRestore;
  overlay.querySelector('[data-tc-close]').onclick = closeAndRestore;
}

function onOverlayClick(event) {
  if (event.target === overlay) closeAndRestore();
}

function onKey(event) {
  if (!overlay || !overlay.classList.contains('open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAndRestore();
  }
}

function closeAndRestore() {
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  if (!saved && baseline) applyState(baseline);
}

function saveTheme() {
  const nameInput = overlay.querySelector('#tc-theme-name');
  const name = ((nameInput && nameInput.value) || draft.name || '').trim();
  if (!name) {
    if (nameInput) nameInput.focus();
    overlay.querySelector('[data-tc-note]').textContent = 'Add a name before saving.';
    return;
  }
  draft.name = name;
  const preset = {
    id: uid(),
    name,
    state: buildState(draft),
  };
  saved = true;
  window.dispatchEvent(new CustomEvent('ia:theme-presets-changed', {
    detail: { preset, selected: preset.id },
  }));
  overlay.querySelector('[data-tc-note]').textContent = 'Saved to Presets.';
  setTimeout(() => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }, 220);
}

function captureCurrent() {
  const api = window.IA || {};
  if (typeof api.captureState === 'function') return clone(api.captureState());
  return buildState(DEFAULT_DRAFT);
}

function applyState(state) {
  const api = window.IA || {};
  if (typeof api.applyState === 'function') {
    api.applyState(clone(state));
    syncDormantGlassInputs(state);
  }
}

function applyDraft() {
  applyState(buildState(draft));
}

function refreshLivePreview() {
  applyModalMaterial();
  const preview = overlay && overlay.querySelector('.tc-preview');
  if (preview) preview.innerHTML = renderPreview();
  hydrateLivePreview();
}

function hydrateLivePreview() {
  const camera = overlay && overlay.querySelector('[data-tc-camera]');
  const api = window.IA || {};
  if (!camera) return;
  if (!previewShell) {
    previewShell = buildPreviewShell();
    previewCountersDone = false;
  }
  if (!previewShell) return;
  if (previewShell.parentElement !== camera) camera.appendChild(previewShell);
  const view = previewShell.querySelector('.view[data-view="order-management"]');
  if (!view) return;
  if (typeof api.renderChartsIn === 'function') api.renderChartsIn(view);
  if (!previewCountersDone && typeof api.runCounters === 'function') {
    api.runCounters(view);
    previewCountersDone = true;
  }
}

/* Charts option art uses real .chart-wrap elements. chartMode() honours the global
   data-charts3d, so render each card under a temporarily forced look (full scope) to
   show flat / iso / glass distinctly, then restore the live attributes. */
function hydrateOptionArt() {
  const api = window.IA || {};
  const stage = overlay && overlay.querySelector('.tc-stage');
  if (!stage || typeof api.renderChartsIn !== 'function') return;
  const chartCards = stage.querySelectorAll('.tc-component-art[data-kind^="charts-"]');
  const fillCards = stage.querySelectorAll('.tc-component-art[data-kind^="fill-"]');
  if (!chartCards.length && !fillCards.length) return;
  const rootEl = document.documentElement;
  const prevLook = rootEl.getAttribute('data-charts3d');
  const prevScope = rootEl.getAttribute('data-3dscope');
  const prevFill = rootEl.getAttribute('data-chartfill');
  rootEl.setAttribute('data-3dscope', 'full');
  // 3D-look cards: force each look, never patterns
  chartCards.forEach(card => {
    const mode = (card.getAttribute('data-kind') || '').replace('charts-', '');
    if (mode === 'iso' || mode === 'glass' || mode === 'webgl') rootEl.setAttribute('data-charts3d', mode);
    else rootEl.removeAttribute('data-charts3d');
    rootEl.removeAttribute('data-chartfill');
    api.renderChartsIn(card);
  });
  // Fill-style cards: always flat, force the Classic / Patterns fill so the difference shows
  fillCards.forEach(card => {
    const fill = (card.getAttribute('data-kind') || '').replace('fill-', '');
    rootEl.removeAttribute('data-charts3d');
    if (fill === 'pattern') rootEl.setAttribute('data-chartfill', 'pattern'); else rootEl.removeAttribute('data-chartfill');
    api.renderChartsIn(card);
  });
  if (prevLook) rootEl.setAttribute('data-charts3d', prevLook); else rootEl.removeAttribute('data-charts3d');
  if (prevScope) rootEl.setAttribute('data-3dscope', prevScope); else rootEl.removeAttribute('data-3dscope');
  if (prevFill) rootEl.setAttribute('data-chartfill', prevFill); else rootEl.removeAttribute('data-chartfill');
}

function applyModalMaterial() {
  if (!overlay) return;
  const glass = (draft.glassAdvanced
    ? Math.max(clamp(draft.glassOp, 0, 100), clamp(draft.glassBl, 0, 100))
    : clamp(draft.glass, 0, 100)) / 100;
  overlay.style.setProperty('--tc-modal-glass', glass.toFixed(2));
  overlay.style.setProperty('--tc-modal-glass-pct', `${Math.round(glass * 100)}%`);
  overlay.classList.toggle('tc-dark', draft.appearance !== 'light');
  overlay.classList.toggle('tc-obsidian', draft.appearance === 'obsidian');
}

function draftFromState(state) {
  const next = clone(DEFAULT_DRAFT);
  const has = id => !!(state.buttons || []).includes(id);
  const pick = (ids, fallback) => ids.find(has) || fallback;
  next.appearance = has('mode-dark') ? 'dark' : 'light';
  const palette = pick(['theme-vivid', 'theme-color', 'theme-mono'], 'theme-mono');
  next.palette = palette.replace('theme-', '');
  next.vividPalette = state.vividPalette && VIVID_COMBO_MAP[state.vividPalette] ? state.vividPalette : DEFAULT_VIVID_COMBO;
  next.energy = pick(['color-expressive', 'color-calm', 'color-strategic'], 'color-strategic').replace('color-', '');
  next.layout = pick(['layout-flap', 'layout-flowy', 'layout-default'], 'layout-default').replace('layout-', '');
  const shell = pick(['shell-contrast', 'shell-seamless', 'shell-tinted'], 'shell-tinted');
  next.shell = shell.replace('shell-', '');
  next.finish = has('surf-frost') ? 'frost' : 'flat';
  next.composition = 'bento';
  next.density = pick(['density-dense', 'density-compact', 'density-spacious'], 'density-spacious').replace('density-', '');
  next.densityAdv = !!state.densityAdv;
  next.densityPad = state.densityPad != null ? state.densityPad : null;
  next.densityGap = state.densityGap != null ? state.densityGap : null;
  next.tabs = pick(['tabs-color', 'tabs-underline', 'tabs-filled'], 'tabs-filled').replace('tabs-', '');
  next.tabFx = has('tabfx-slide') ? 'slide' : 'flat';
  next.kpiFont = pick(['kf-serif', 'kf-mono', 'kf-sans'], 'kf-sans').replace('kf-', '');
  next.tables = has('tbl-lined') ? 'lined' : 'plain';
  next.charts = has('c3d-webgl') ? 'webgl' : has('c3d-glass') ? 'glass' : has('c3d-iso') ? 'iso' : 'flat';
  next.chartFill = has('cfill-pattern') ? 'pattern' : 'classic';
  next.chartScope = has('d3-full') ? 'full' : 'accent';
  next.accent = state.brandActive && state.brand ? state.brand : state.hueActive && state.hue ? state.hue : state.tab || next.accent;
  // Pin the tab color only when it diverges from the accent; otherwise leave null so tabs keep following the accent.
  next.tabColor = next.tabs !== 'filled' && state.tab && state.tab.toLowerCase() !== (next.accent || '').toLowerCase() ? state.tab : null;
  next.numFeats = Array.isArray(state.numFeats) ? [...state.numFeats] : [];
  const sliders = state.sliders || {};
  next.surfaceRadius = numberOr(sliders['r-surface'], next.surfaceRadius);
  next.controlRadius = numberOr(sliders['r-interactive'], next.controlRadius);
  next.kpiWeight = numberOr(sliders['kpi-weight'], next.kpiWeight);
  next.glass = numberOr(sliders['r-glass'], next.glass);
  next.glassAdvanced = !!state.glassAdv;
  next.glassOp = state.glassAdv ? numberOr(state.glassOp, next.glass) : next.glass;
  next.glassBl = state.glassAdv ? numberOr(state.glassBl, next.glass) : next.glass;
  const effectiveGlass = next.glassAdvanced ? Math.max(next.glassOp, next.glassBl) : next.glass;
  if (next.appearance === 'dark' && next.shell === 'contrast' && effectiveGlass >= 14) next.appearance = 'obsidian';
  return next;
}

function buildState(src) {
  const glass = clamp(src.glass, 0, 100);
  const glassAdvanced = !!src.glassAdvanced;
  const glassOp = glassAdvanced ? clamp(src.glassOp, 0, 100) : glass;
  const glassBl = glassAdvanced ? clamp(src.glassBl, 0, 100) : glass;
  const shell = src.layout === 'default' ? src.shell : 'tinted';
  const tabs = src.palette === 'mono' && src.tabs === 'color' ? 'filled' : src.tabs;
  const chartScope = src.charts === 'flat' ? 'accent' : src.chartScope;
  const chartFill = src.charts === 'flat' ? src.chartFill : 'classic';   // patterns only exist on the flat look
  const buttons = [
    src.appearance === 'light' ? 'mode-light' : 'mode-dark',
    `theme-${src.palette}`,
    `color-${src.energy}`,
    `shell-${shell}`,
    `layout-${src.layout}`,
    'pkg-l1',
    'l0-hover',
    src.finish === 'frost' ? 'surf-frost' : 'surf-flat',
    'comp-bento',
    `density-${src.density}`,
    `kf-${src.kpiFont}`,
    `tabs-${tabs}`,
    src.tabFx === 'slide' ? 'tabfx-slide' : 'tabfx-flat',
    src.tables === 'lined' ? 'tbl-lined' : 'tbl-comfortable',
    src.charts === 'iso' ? 'c3d-iso' : src.charts === 'glass' ? 'c3d-glass' : src.charts === 'webgl' ? 'c3d-webgl' : 'c3d-default',
    chartFill === 'pattern' ? 'cfill-pattern' : 'cfill-classic',
    chartScope === 'full' ? 'd3-full' : 'd3-accent',
  ];
  return {
    buttons,
    sliders: {
      'r-surface': String(clamp(src.surfaceRadius, 0, 28)),
      'r-interactive': String(clamp(src.controlRadius, 0, 20)),
      'kpi-weight': String(clamp(src.kpiWeight, 100, 800)),
      'r-glass': String(glass),
    },
    hue: src.accent,
    hueActive: src.palette === 'color',
    tab: src.tabs === 'filled' ? '#6366f1' : (src.tabColor || src.accent),
    brand: src.accent,
    brandActive: src.palette !== 'mono',
    vividPalette: (src.vividPalette && VIVID_COMBO_MAP[src.vividPalette]) ? src.vividPalette : DEFAULT_VIVID_COMBO,
    glassAdv: glassAdvanced,
    glassOp: String(glassOp),
    glassBl: String(glassBl),
    densityAdv: !!src.densityAdv,
    densityPad: src.densityAdv ? String(src.densityPad) : null,
    densityGap: src.densityAdv ? String(src.densityGap) : null,
    numFeats: Array.isArray(src.numFeats) ? [...src.numFeats] : [],
  };
}

function applyChoiceSideEffects(key, value) {
  if (key === 'appearance') {
    if (value === 'light') {
      draft.shell = 'tinted';
      draft.finish = 'flat';
      draft.glass = 0;
      draft.glassAdvanced = false;
      draft.glassOp = 0;
      draft.glassBl = 0;
      draft.energy = draft.energy === 'expressive' ? 'strategic' : draft.energy;
    } else if (value === 'dark') {
      draft.shell = 'tinted';
      draft.finish = 'flat';
      draft.glass = 0;
      draft.glassAdvanced = false;
      draft.glassOp = 0;
      draft.glassBl = 0;
      draft.energy = draft.energy === 'calm' ? 'strategic' : draft.energy;
    } else if (value === 'obsidian') {
      draft.shell = 'contrast';
      draft.finish = 'frost';
      draft.glass = 36;
      draft.glassAdvanced = false;
      draft.glassOp = 36;
      draft.glassBl = 36;
      draft.energy = 'expressive';
    }
  }
  if (key === 'palette' && value === 'mono') {
    draft.tabs = draft.tabs === 'color' ? 'filled' : draft.tabs;
  }
  if (key === 'layout' && value !== 'default') {
    draft.shell = 'tinted';
  }
  if (key === 'charts' && value === 'flat') {
    draft.chartScope = 'accent';
  }
  // picking a curated density preset clears any decoupled (advanced) pad/gap carried in
  if (key === 'density') {
    draft.densityAdv = false;
    draft.densityPad = null;
    draft.densityGap = null;
  }
}

function summaryItems() {
  // For Vivid, fold the chosen combo into the Palette chip (e.g. "Vivid · Ocean").
  let paletteLabel = labelFor('palette', draft.palette);
  if (draft.palette === 'vivid') {
    const combo = VIVID_COMBO_MAP[draft.vividPalette] || VIVID_COMBO_MAP[DEFAULT_VIVID_COMBO];
    paletteLabel = `${paletteLabel} \u00B7 ${combo.label}`;
  }
  return [
    ['Appearance', labelFor('appearance', draft.appearance)],
    ['Palette', paletteLabel],
    ['Energy', labelFor('energy', draft.energy)],
    ['Layout', labelFor('layout', draft.layout)],
    ['Shape', `${draft.surfaceRadius}px / ${draft.controlRadius}px`],
    ['Density', labelFor('density', draft.density)],
    ['Charts', draft.charts === 'flat' && draft.chartFill === 'pattern'
      ? `${labelFor('charts', draft.charts)} \u00B7 Patterns`
      : labelFor('charts', draft.charts)],
  ];
}

function summaryName() {
  return `${labelFor('appearance', draft.appearance)} / ${labelFor('palette', draft.palette)} / ${labelFor('layout', draft.layout)}`;
}

function labelFor(key, value) {
  const step = STEPS.find(s => s.groups && s.groups.some(g => g.key === key));
  const group = step && step.groups.find(g => g.key === key);
  const option = group && group.options && group.options.find(o => o.value === value);
  return option ? option.title : String(value).replace(/^\w/, c => c.toUpperCase());
}

// Main-layout options read as plain glyphs (abstract panel art was unclear).
const LAYOUT_ICONS = { 'layout-default': 'workbench', 'layout-flowy': 'layers', 'layout-flap': 'tabFused' };

/* Global-glass control: a REAL proto dropdown (.ctxmenu.glass) floating over two
   colored orbs. It frosts from the same global --glass tokens the slider drives,
   so the card previews the genuine backdrop-filter effect instead of a mock. */
function renderGlassScene(level, op = level, bl = level) {
  return `<span class="tc-art tc-glass-scene" data-art="glass" style="--tc-level:${level};--tc-op:${op};--tc-bl:${bl};--tc-accent:${draft.accent}">
    <i class="tc-glass-orb tc-glass-orb-a" aria-hidden="true"></i>
    <i class="tc-glass-orb tc-glass-orb-b" aria-hidden="true"></i>
    <div class="ctxmenu glass tc-glass-menu open" aria-hidden="true">
      <button class="ctxmenu-item" tabindex="-1">${icon('view')}Overview</button>
      <button class="ctxmenu-item" tabindex="-1">${icon('grid')}All apps</button>
      <button class="ctxmenu-item" tabindex="-1">${icon('star')}Starred</button>
    </div>
  </span>`;
}

function renderArt(art, value, amount = 0) {
  const level = typeof amount === 'number' ? amount : Number(amount && amount.level) || 0;
  if (art === 'glass') {
    const op = amount && typeof amount === 'object' ? Number(amount.op) || 0 : level;
    const bl = amount && typeof amount === 'object' ? Number(amount.bl) || 0 : level;
    return renderGlassScene(level, op, bl);
  }
  if (/^(density|tabs|tables|charts|fill)-/.test(art)) {
    return `<div class="tc-art tc-component-art" data-kind="${escapeAttr(art)}" style="--tc-level:${level};--tc-accent:${draft.accent}">
      ${renderComponentArt(art)}
    </div>`;
  }
  if (LAYOUT_ICONS[art]) {
    return `<span class="tc-art tc-art-icon" data-art="${escapeAttr(art)}" style="--tc-accent:${draft.accent}">
      ${icon(LAYOUT_ICONS[art], 'icon tc-art-glyph')}
    </span>`;
  }
  // The Vivid palette card mirrors the live combo so the choice reads at a glance.
  if (art === 'palette-vivid') {
    const combo = VIVID_COMBO_MAP[draft.vividPalette] || VIVID_COMBO_MAP[DEFAULT_VIVID_COMBO];
    const [c1, c2, c3, c4] = combo.swatch;
    return `<span class="tc-art" data-art="palette-vivid" style="--tc-level:${level};--tc-accent:${draft.accent};--vc1:${c1};--vc2:${c2};--vc3:${c3};--vc4:${c4}">
      <i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i>
    </span>`;
  }
  return `<span class="tc-art" data-art="${escapeAttr(art)}" style="--tc-level:${level};--tc-accent:${draft.accent}">
    <i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i>
  </span>`;
}

/* Option art = the real prototype components, wrapped in the real data-* attribute so
   the genuine CSS styles them. No hand-drawn look-alikes. */
function renderComponentArt(art) {
  if (art.startsWith('density-')) {
    const value = art.replace('density-', '');
    const vars = value === 'compact' ? '--gap:6px;--pad:10px' : value === 'dense' ? '--gap:4px;--pad:8px' : '--gap:12px;--pad:16px';
    return `<div class="tc-frag tc-frag-density" data-density="${escapeAttr(value)}" style="${vars}">
      <div class="bento">
        <div class="card span-12 kpi-strip" data-card>
          <div class="kpi"><div class="k"># Sales Orders</div><div class="v">60.3K</div></div>
          <div class="kpi"><div class="k">Net Value [EUR]</div><div class="v">1.15B</div></div>
        </div>
        <div class="card span-12 table-card" data-card>
          <table class="data-table">
            <thead><tr><th>Order</th><th>Status</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>SO-1042</td><td>Late</td><td>24K</td></tr>
              <tr><td>SO-1087</td><td>Ready</td><td>18K</td></tr>
              <tr><td>SO-1120</td><td>Blocked</td><td>31K</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }
  if (art.startsWith('tabs-')) {
    const value = art.replace('tabs-', '');
    return `<div class="tc-frag tc-frag-tabs" data-tabs="${escapeAttr(value)}">
      <div class="subtabs">
        <div class="subtab on">Operations View</div>
        <div class="subtab">Process Explorer</div>
        <div class="subtab">On-Time Delivery</div>
      </div>
    </div>`;
  }
  if (art.startsWith('tables-')) {
    const value = art.replace('tables-', '');
    return `<div class="tc-frag tc-frag-table" data-tables="${escapeAttr(value)}">
      <div class="card span-12 table-card" data-card>
        <div class="table-head-row"><div class="card-title">Order exceptions</div><span>Updated now</span></div>
        <table class="data-table">
          <thead><tr><th>Order</th><th>Status</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>SO-1042</td><td>Late</td><td>24K</td></tr>
            <tr><td>SO-1087</td><td>Ready</td><td>18K</td></tr>
            <tr><td>SO-1120</td><td>Blocked</td><td>31K</td></tr>
            <tr><td>SO-1143</td><td>Ready</td><td>12K</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }
  // Fill-style art uses a real multi-series grouped bar so Classic (solid hues) vs
  // Patterns (textured series) is obvious. hydrateOptionArt() renders it under flat + the forced fill.
  if (art.startsWith('fill-')) {
    return `<div class="tc-frag tc-frag-chart">
      <div class="card metric" data-card>
        <div class="chart-wrap" data-chart="groupbars" data-ymax="80" data-cats='["Q1","Q2","Q3"]' data-series='[{"c":"--cstop-1a","name":"A","vals":[44,60,66]},{"c":"--cstop-2a","name":"B","vals":[30,38,32]},{"c":"--cstop-3a","name":"C","vals":[18,26,42]}]'></div>
      </div>
    </div>`;
  }
  const value = art.replace('charts-', '');
  return `<div class="tc-frag tc-frag-chart">
    <div class="card metric" data-card>
      <div class="chart-wrap" data-chart="combo" data-key="tc-art-${escapeAttr(value)}" data-n="5" data-rightmax="40" data-leftlabel="50K" data-rightline="light"></div>
    </div>
  </div>`;
}

function nextThemeName() {
  const hour = new Date().getHours();
  const suffix = hour < 12 ? 'Morning' : hour < 18 ? 'Studio' : 'Night';
  return `${suffix} Theme`;
}

function uid() {
  return `tc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function syncDormantGlassInputs(state) {
  if (!state || state.glassAdv) return;
  const fallback = state.sliders && state.sliders['r-glass'] != null ? state.sliders['r-glass'] : '0';
  const op = document.getElementById('r-glass-op');
  const bl = document.getElementById('r-glass-bl');
  if (op) op.value = state.glassOp != null ? state.glassOp : fallback;
  if (bl) bl.value = state.glassBl != null ? state.glassBl : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
