import {defineConfig} from "@playwright/test";

// No server launch; uses the existing public deployment and synthetic documents.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-page-decorations.live.mjs",
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
    navigationTimeout:45000,
    actionTimeout:20000,
    trace:"retain-on-failure",
  },
});
