import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-csp-task272-protect-unlock.live.mjs",
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:240000,
  use:{
    baseURL:"https://kukureku.com",
    browserName:"chromium",
    headless:true,
    viewport:{width:390,height:844},
    acceptDownloads:true,
    trace:"off",
    screenshot:"off"
  },
  reporter:"line"
});
