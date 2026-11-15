import {defineConfig} from "@playwright/test";

// Isolated release gate: hit the EXISTING public site with Linux Playwright
// WebKit at iPhone-sized viewport. No local server or production deployment.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-webkit-xlsx.live.mjs",
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
    actionTimeout:20000,
    navigationTimeout:45000,
    trace:"retain-on-failure",
  },
});
