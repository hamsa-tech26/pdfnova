import {defineConfig} from "@playwright/test";

// Synthetic live artifact fidelity. No local service or Vercel deployment.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-image-conversions.live.mjs",
  timeout:180000,
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
