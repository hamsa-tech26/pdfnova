import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-csp-task275-compress-dataurl.live.mjs",
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:240000,
  use:{
    baseURL:"http://127.0.0.1:3000",
    browserName:"webkit",
    headless:true,
    viewport:{width:390,height:844},
    acceptDownloads:true,
    trace:"off",
    screenshot:"off"
  },
  reporter:"line"
});
