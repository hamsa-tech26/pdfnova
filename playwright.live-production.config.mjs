import {defineConfig} from "@playwright/test";

// RELEASE 142: deliberately test the ALREADY DEPLOYED public Kukureku domain.
// Never start a local development server or make a Vercel deployment here.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-live-acceptance.live.mjs",
  timeout:180000,
  retries:0,
  workers:1,
  reporter:"list",
  use:{
    baseURL:"https://kukureku.com",
    headless:true,
    acceptDownloads:true,
    viewport:{width:1280,height:800},
    actionTimeout:20000,
    navigationTimeout:45000,
    trace:"retain-on-failure",
  },
});
