import {defineConfig} from "@playwright/test";
import path from "node:path";
if(process.env.CI)throw Error("Private real-world PDF test cannot run on GitHub CI.");
const folder=path.resolve("benchmarks/golden/private");
export default defineConfig({
 testDir:"./e2e",testMatch:"**/private-golden.bench.mjs",
 fullyParallel:false,workers:1,retries:0,timeout:360000,reporter:"line",
 outputDir:path.join(folder,"runner-output"),
 use:{baseURL:"http://127.0.0.1:3000",headless:true,acceptDownloads:true,
   trace:"off",screenshot:"off",video:"off"},
 webServer:{command:"npm run dev -- --hostname 127.0.0.1",url:"http://127.0.0.1:3000",
   timeout:120000,reuseExistingServer:false}
});
