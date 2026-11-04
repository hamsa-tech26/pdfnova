import {defineConfig} from "@playwright/test";

// Developer preflight only. A pass here must never be reported as proof of the
// deployed kukureku.com domain; hosted live CI is the production gate.
export default defineConfig({
  testDir:"./e2e",
  testMatch:"production-document-network-privacy.live.mjs",
  timeout:240000,
  expect:{timeout:20000},
  workers:1,
  retries:0,
  reporter:"list",
  use:{
    baseURL:"http://127.0.0.1:3000",
    headless:true,
    acceptDownloads:true,
    viewport:{width:1280,height:800},
    trace:"retain-on-failure",
  },
  webServer:{
    command:"npm run dev -- --hostname 127.0.0.1",
    url:"http://127.0.0.1:3000",
    timeout:180000,
    reuseExistingServer:false,
  },
});
