import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

// Passive candidate CSP: browser REPORT-ONLY, never enforce.
// No report-uri/report-to endpoint, so no violation reports leave the browser.
const policy=[
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

test("passive CSP violation inventory on synthetic PDF-to-Excel flow",async({page})=>{
  test.setTimeout(180000);
  let injected=false;
  await page.addInitScript(()=>{
    window.__kukurekuSyntheticCspViolations=[];
    document.addEventListener("securitypolicyviolation",event=>{
      let host="inline-or-unknown";
      try {
        const url=new URL(event.blockedURI);
        host=url.origin;
      } catch {
        if(event.blockedURI==="inline"||event.blockedURI==="eval"||event.blockedURI==="data") host=event.blockedURI;
      }
      // Record bounded, non-personal script location category. URLs/query
      // strings and document names must never enter CI output.
      let category="unknown";
      try{
        const source=new URL(event.sourceFile);
        if(source.protocol==="blob:") category="blob-worker-or-script";
        else if(source.hostname===window.location.hostname){
          if(source.pathname.startsWith("/_next/static/")) category="next-static";
          else if(source.pathname==="/pdf-to-excel") category="page-inline";
          else if(source.pathname.startsWith("/_next/")) category="next-runtime";
          else category="other-same-origin";
        } else category="external-script";
      }catch{}
      window.__kukurekuSyntheticCspViolations.push({
        directive:event.effectiveDirective,
        origin:host,
        disposition:event.disposition,
        sourceCategory:category,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });
  await page.route("https://kukureku.com/pdf-to-excel",async route=>{
    const response=await route.fetch();
    const headers={...response.headers(),"content-security-policy-report-only":policy};
    await route.fulfill({response,headers});
    injected=true;
  });
  await page.goto("/pdf-to-excel",{waitUntil:"networkidle"});
  expect(injected).toBe(true);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const sheet=pdf.addPage([550,760]);
  sheet.drawText("SYNTHETIC_CSP_TASK257",{x:30,y:700,size:12,font});
  sheet.drawText("Value 123",{x:60,y:650,size:12,font});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"synthetic_csp_test.pdf",
    mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  await expect(page.getByRole("button",{name:/Convert to Excel/i})).toBeVisible({timeout:30000});
  // No output download is needed; selecting a synthetic PDF exercises the
  // client-side PDF initialization and worker asset path.
  await page.waitForTimeout(1500);
  const events=await page.evaluate(()=>window.__kukurekuSyntheticCspViolations||[]);
  const counts=new Map();
  for(const item of events){
    const key=item.directive+"|"+item.origin+"|"+item.disposition+"|"+item.sourceCategory+"|line:"+item.sourceLine;
    counts.set(key,(counts.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:257,
    result:"PASSIVE_OBSERVATION_ONLY",
    policyMode:"report-only",
    route:"/pdf-to-excel",
    syntheticPdf:true,
    customerPdfCount:0,
    observedViolationSummary:[...counts].map(([key,count])=>({key,count})).slice(0,40),
    totalEvents:events.length,
    limitations:"A single synthetic Chromium flow does not cover every route, all worker paths or production CSP enforcement"
  }));
});
