import {defineConfig} from "@playwright/test";

// Linux Playwright WebKit, 390x844 viewport. This is not a physical iPhone test.
// Reuses the privacy-safe report-only suite; it never uploads a customer PDF.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-csp-reportonly.live.mjs",
  timeout:360000,
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
    trace:"off",
    screenshot:"off",
  },
});
