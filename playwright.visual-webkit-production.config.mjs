import {defineConfig} from "@playwright/test";

// Test only: Linux WebKit at mobile width against already deployed kukureku.com.
// Not a physical iPhone, no local server, no Vercel deployment.
export default defineConfig({
  testDir:"./e2e",
  testMatch:[
    "production-watermark-visual.live.mjs",
    "production-visual-signature.live.mjs",
  ],
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
