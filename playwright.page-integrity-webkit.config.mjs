import {defineConfig} from "@playwright/test";

// Task 245, pre-release QA: Linux WebKit at mobile width against the already
// deployed public domain; this does not represent a physical iPhone test.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-page-integrity.live.mjs",
  timeout:180000,
  retries:0,
  workers:1,
  reporter:"list",
  use:{
    baseURL:"https://kukureku.com",
    browserName:"webkit",
    headless:true,
    acceptDownloads:true,
    viewport:{width:390,height:844},
    navigationTimeout:45000,
    actionTimeout:20000,
    trace:"retain-on-failure",
  },
});
