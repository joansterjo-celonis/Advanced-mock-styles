// App entry. Vite bundles + hashes the CSS imports; importing them before
// the engine guarantees styles are applied before any layout measurement.
import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/views.css';
import '../styles/charts.css';
import '../styles/knobs.css';
import '../styles/components.css';
import '../styles/effects.css';
// Side-by-side asset split — isolated, removable layer (after components/effects
// so its tie-breaking selectors, e.g. .ctx-canvas.sv-host overflow, win the cascade).
import '../styles/split-view.css';
// Feedback feature is a separate layer on top of the proto (does not touch its logic).
import '../styles/feedback.css';
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
// Shared glass tooltip (delegated; any [data-tip] element opts in).
import './tooltip.js';
// Functional chart tooltips (delegated; charts tag data slots with [data-ctip]).
import './chart-tips.js';

import { initFeedback } from './feedback.js';
initFeedback();
