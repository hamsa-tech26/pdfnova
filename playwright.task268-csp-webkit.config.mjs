import {defineConfig} from "@playwright/test";

// Linux Playwright WebKit at a mobile viewport; not a physical iPhone test.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-csp-task268-pdf-to-jpg.live.mjs",
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:180000,
  use:{
    baseURL:"https://kukureku.com",
    browserName:"webkit",
    headless:true,
    acceptDownloads:true,
    viewport:{width:390,height:844},
    actionTimeout:20000,
    navigationTimeout:45000,
    trace:"off",
    screenshot:"off",
  },
  reporter:"line",
});
