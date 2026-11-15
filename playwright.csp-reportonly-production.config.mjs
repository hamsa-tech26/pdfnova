import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-csp-reportonly.live.mjs",
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:180000,
  use:{
    baseURL:"https://kukureku.com",
    browserName:"chromium",
    headless:true,
    acceptDownloads:false,
    trace:"off",
    screenshot:"off",
  },
  reporter:"line",
});
