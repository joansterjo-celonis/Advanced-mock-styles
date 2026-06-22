import { defineConfig } from 'vite';

// GitHub Pages serves this project under /<repo-name>/, so assets must be
// resolved against that sub-path. Override with VITE_BASE for other hosts
// (e.g. a custom domain at the root would use VITE_BASE=/).
const base = process.env.VITE_BASE ?? '/Advanced-mock-styles/';

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
