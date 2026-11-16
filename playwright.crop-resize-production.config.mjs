import {defineConfig} from "@playwright/test";

// Synthetic QA only; currently deployed domain, not a local or preview build.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-crop-resize.live.mjs",
  timeout:120000,
  retries:0,
  workers:1,
  reporter:"list",
  use:{
    baseURL:"https://kukureku.com",
    browserName:"chromium",
    headless:true,
    acceptDownloads:true,
    viewport:{width:390,height:844},
    actionTimeout:20000,
    navigationTimeout:45000,
    trace:"retain-on-failure",
  },
});
