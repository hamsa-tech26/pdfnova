import {defineConfig} from "@playwright/test";

const browserName=process.env.TASK279_BROWSER==="webkit"?"webkit":"chromium";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"task279-uploaded-image-dataurl.local.mjs",
  timeout:180000,
  retries:0,
  workers:1,
  reporter:"list",
  use:{
    baseURL:"http://127.0.0.1:3000",
    browserName,
    headless:true,
    acceptDownloads:true,
    viewport:{width:390,height:844},
    navigationTimeout:45000,
    actionTimeout:30000,
    trace:"off"
  },
  webServer:{
    command:"npm run start",
    url:"http://127.0.0.1:3000",
    reuseExistingServer:false,
    timeout:120000,
    env:{NEXT_TELEMETRY_DISABLED:"1"}
  }
});
