// App entry. Vite bundles + hashes the CSS imports; importing them before
// the engine guarantees styles are applied before any layout measurement.
import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/views.css';
import '../styles/charts.css';
import '../styles/knobs.css';
import '../styles/components.css';
import '../styles/effects.css';

import './engine.js';
import './shell.js';
// Registered after shell so dynamically-added tabs get exactly one click handler.
import './views.js';
// Shared glass tooltip (delegated; any [data-tip] element opts in).
import './tooltip.js';

import { initFeedback } from './feedback.js';
initFeedback();
