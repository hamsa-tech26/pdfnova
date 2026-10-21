import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:"**/release166_published20.pilot.mjs",
  timeout:210000,fullyParallel:false,workers:1,retries:0,reporter:"line",
  use:{baseURL:"http://127.0.0.1:3000",headless:true,acceptDownloads:true,
    viewport:{width:1440,height:950},trace:"off"},
  webServer:{command:"npm run dev -- --hostname 127.0.0.1",
    url:"http://127.0.0.1:3000",timeout:120000,reuseExistingServer:!process.env.CI}
});
