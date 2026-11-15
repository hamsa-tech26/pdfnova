import {defineConfig} from "@playwright/test";

// Test-only; this does not deploy or run a local app.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-watermark-visual.live.mjs",
  timeout:180000,
  retries:0,
  workers:1,
  reporter:"list",
  use:{
    baseURL:"https://kukureku.com",
    browserName:"chromium",
    headless:true,
    acceptDownloads:true,
    viewport:{width:390,height:844},
    navigationTimeout:45000,
    actionTimeout:20000,
    trace:"retain-on-failure",
  },
});
