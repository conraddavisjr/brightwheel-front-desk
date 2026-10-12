import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys against a real server and the local Supabase stack,
 * with AI stubbed (AI_STUB=1): no keys, no spend, deterministic.
 * Run: npm run db:reset && npm run seed && npm run e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3300);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", video: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { AI_STUB: "1", EVAL_ENABLED: "true", EVAL_SECRET: "e2e-eval" },
  },
});
