// App entry. Vite bundles + hashes the CSS imports; importing them before
// the engine guarantees styles are applied before any layout measurement.
// Self-hosted Inter @font-face first so the 'Inter' family (declared across every stack) resolves
// to the real font — required for the Typography OpenType features (zero / ss01 / ss02) to render.
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/views.css';
import '../styles/charts.css';
import '../styles/knobs.css';
import '../styles/components.css';
import '../styles/effects.css';
// WebGL 3D charts — isolated, removable layer (canvas fill rules for the
// three.js renderer; the engine lazy-imports the JS only when "webgl" is selected).
import '../styles/webgl-charts.css';
// Side-by-side asset split — isolated, removable layer (after components/effects
// so its tie-breaking selectors, e.g. .ctx-canvas.sv-host overflow, win the cascade).
import '../styles/split-view.css';
// Slide-over drawer — isolated, removable layer (master→detail reveal as a side modal).
import '../styles/slide-over.css';
// Theme Creator is an isolated layer over the prototype controls.
import '../styles/theme-creator.css';
// Feedback feature is a separate layer on top of the proto (does not touch its logic).
import '../styles/feedback.css';
// Chart Playground — isolated, removable sandbox layer (Build-a-chart sub-tab).
import '../styles/chart-playground.css';
// Access gate is a separate layer on top of the proto (does not touch its logic).
import '../styles/auth-gate.css';
import { initAuthGate } from './auth-gate.js';
initAuthGate();

import './engine.js';
import './shell.js';
// Registered after shell so dynamically-added tabs get exactly one click handler.
import './views.js';
// Side-by-side split: wired after shell/views so its tab listeners coexist with
// the source<->asset bridge (and capture-phase exit runs before shell's handler).
import { initSplitView } from './split-view.js';
initSplitView();
// Slide-over drawer: master→detail reveal (Incident List row → Incident Details).
import { initSlideOver } from './slide-over.js';
initSlideOver();
// Shared glass tooltip (delegated; any [data-tip] element opts in).
import './tooltip.js';
// Functional chart tooltips (delegated; charts tag data slots with [data-ctip]).
import './chart-tips.js';

import { initThemeCreator } from './theme-creator.js';
initThemeCreator();

import { initFeedback } from './feedback.js';
initFeedback();

// Chart Playground sandbox: wires the "Build a chart" sub-tab's live controls
// (loaded after engine/views so window.IA + the view's edit panel already exist).
import { initChartPlayground } from './chart-playground.js';
initChartPlayground();
