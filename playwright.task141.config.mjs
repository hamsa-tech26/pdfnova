import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"task141-source-bounded-regressions.e2e.mjs",
  timeout:180000,
  expect:{timeout:20000},
  fullyParallel:false,
  workers:1,
  retries:0,
  reporter:"list",
  outputDir:process.env.KUKUREKU_TASK141_OUTPUT_DIR||"test-results/task141",
  use:{baseURL:"http://127.0.0.1:3000",browserName:"chromium",
    headless:true,acceptDownloads:true},
  // Run against an already-built local app: `npm run build -- --webpack`.
  // Offline font mocks can be used only while building, never in production.
  webServer:{command:"npm run start -- --hostname 127.0.0.1",
    url:"http://127.0.0.1:3000",reuseExistingServer:false,timeout:120000},
});
