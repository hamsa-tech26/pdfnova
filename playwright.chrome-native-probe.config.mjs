import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["release195-chrome-native-viewer.probe.mjs", "release196-chrome-form-clipping.probe.mjs"],
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
});
