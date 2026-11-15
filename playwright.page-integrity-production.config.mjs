import {defineConfig} from "@playwright/test";

// QA only. Target already-deployed kukureku.com, never a preview or local server.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-page-integrity.live.mjs",
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
