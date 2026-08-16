import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * On NixOS-based hosts (e.g. Replit) the downloaded Playwright browsers can't
 * load system libraries; fall back to a Nix-provided Chromium when available.
 * Override with PW_CHROMIUM_PATH, or leave both unset to use the default
 * `playwright install chromium` browser.
 */
const nixChromium = process.env.PW_CHROMIUM_PATH;
const chromiumPath =
  nixChromium && existsSync(nixChromium) ? nixChromium : undefined;

/**
 * Browser E2E suite. Expects the dev servers to be running:
 *  - web UI on PW_BASE_URL (default http://localhost:21026, proxying /api)
 *  - API on :3001 with DATABASE_URL configured
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:21026",
    trace: "retain-on-failure",
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
});
