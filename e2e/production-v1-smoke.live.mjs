import {test,expect} from "@playwright/test";
import {TOOL_ROUTES} from "../scripts/indexNowRoutes.mjs";

// V1 audit only: the browser/test runner points at already-deployed kukureku.com.
// Never send real user PDFs, credentials, form values or personal data to CI.
test("live homepage serves protective headers and public crawl endpoints",async({request})=>{
  test.setTimeout(90000);
  const response=await request.get("/",{timeout:30000});
  expect(response.status(),"Public homepage should load").toBe(200);
  const headers=response.headers();
  expect(headers["content-type"]||"").toMatch(/text\/html/i);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]||"").toContain("frame-ancestors 'none'");
  // No security/accreditation claim is made from checking header presence alone.
  for(const path of ["/robots.txt","/sitemap.xml","/privacy"]){
    const result=await request.get(path,{timeout:30000});
    expect(result.status(),`${path} must be accessible`).toBe(200);
  }
  console.log(JSON.stringify({check:"LIVE_V1_HEADERS_CRAWL",result:"PASS",bodyLogged:false}));
});

test("all 31 registered public PDF tools return an HTML page on live production",async({request})=>{
  test.setTimeout(180000);
  expect(TOOL_ROUTES).toHaveLength(31);
  const outcomes=[];
  // Bounded concurrency avoids making an excessive number of simultaneous requests.
  for(let index=0;index<TOOL_ROUTES.length;index+=4){
    const batch=TOOL_ROUTES.slice(index,index+4);
    const checked=await Promise.all(batch.map(async path=>{
      try{
        const response=await request.get(path,{timeout:30000});
        return {route:path,status:response.status(),html:/text\/html/i.test(response.headers()["content-type"]||"")};
      }catch(error){
        return {route:path,status:"REQUEST_ERROR",html:false,reason:error instanceof Error?error.name:"error"};
      }
    }));
    outcomes.push(...checked);
  }
  const failures=outcomes.filter(item=>item.status!==200||!item.html);
  // Print only route/status metadata, never file or response contents.
  console.log(JSON.stringify({check:"LIVE_V1_31_ROUTE_HTTP",checked:outcomes.length,failed:failures}));
  expect(failures,"Every advertised tool must resolve to HTML").toEqual([]);
});

test("live privacy policy clearly discloses local persistence and unencrypted backups",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/privacy",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Privacy Policy",exact:true})).toBeVisible();
  await expect(page.getByText(/It is not encrypted\./)).toBeVisible();
  await expect(page.getByText(/Workspace features can save complete PDF files/)).toBeVisible();
  await expect(page.getByText(/Vercel Web Analytics/)).toBeVisible();
  console.log(JSON.stringify({check:"LIVE_V1_PRIVACY_DISCLOSURE",result:"PASS",documentContentsLogged:false}));
});
