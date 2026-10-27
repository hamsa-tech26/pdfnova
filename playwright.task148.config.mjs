import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"task148-page-selection.e2e.mjs",
  timeout:90000,
  expect:{timeout:20000},
  fullyParallel:false,
  workers:1,
  retries:0,
  reporter:"list",
  outputDir:"test-results/task148",
  use:{baseURL:"http://127.0.0.1:3000",browserName:"chromium",
    headless:true,acceptDownloads:false},
  webServer:{command:"npm run start -- --hostname 127.0.0.1",
    url:"http://127.0.0.1:3000",reuseExistingServer:false,timeout:120000},
});
