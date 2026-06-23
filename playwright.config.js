import { defineConfig, devices } from '@playwright/test';

// E2E harness for the side-by-side split feature. Boots the Vite dev server
// (served under the /Advanced-mock-styles/ base) and drives a real Chromium so
// the split's DOM moves, divider drag, chart reflow and teardown are exercised
// exactly as a user would. Dev-only — never part of the shipped bundle.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/Advanced-mock-styles/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
