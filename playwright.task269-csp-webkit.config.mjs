import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-csp-task269-jpg-to-pdf.live.mjs",
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:180000,
  use:{
    baseURL:"https://kukureku.com",
    browserName:"webkit",
    headless:true,
    acceptDownloads:true,
    trace:"off",
    screenshot:"off",
  },
  reporter:"line",
});
