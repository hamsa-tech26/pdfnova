import {test,expect} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import {TOOL_ROUTES} from "../scripts/indexNowRoutes.mjs";

test("mobile browser opens every registered tool route and provides a visible tool heading", async ({page})=>{
  test.setTimeout(480_000);
  await page.setViewportSize({width:375,height:812});
  expect(TOOL_ROUTES.length).toBeGreaterThan(0);
  for(const route of TOOL_ROUTES){
    const response=await page.goto(route,{waitUntil:"domcontentloaded",timeout:45000});
    expect(response?.status(),route+" HTTP result").toBe(200);
    await expect(page.locator("main h1").first(),route+" heading").toBeVisible({timeout:15000});
    await expect(page.getByRole("button",{name:"Open workspace menu"}),route+" mobile navigation").toBeVisible();
  }
});
test("record explicit mobile first-paint and layout diagnostic without performance claims", async ({page})=>{
  const measurements=[];
  for(const route of ["/","/dashboard","/merge-pdf","/pdf-to-word","/ocr-pdf"]){
    await page.setViewportSize({width:375,height:812});
    const response=await page.goto(route,{waitUntil:"load"});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const measurement=await page.evaluate(()=>{
      const nav=performance.getEntriesByType("navigation")[0];
      const paint=performance.getEntriesByType("paint");
      const scripts=performance.getEntriesByType("resource").filter(item=>item.initiatorType==="script");
      return {
        domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd??0),
        firstContentfulPaintMs:Math.round(paint.find(p=>p.name==="first-contentful-paint")?.startTime??0),
        scriptCount:scripts.length,
        scriptTransferBytes:scripts.reduce((total,s)=>total+(s.transferSize||0),0),
        pageScrollWidth:document.documentElement.scrollWidth,
        viewportWidth:document.documentElement.clientWidth
      };
    });
    measurements.push({route,status:response?.status()??null,...measurement});
  }
  const report={status:"LOCAL_DEV_SERVER_DIAGNOSTIC_NOT_PRODUCTION_WEB_VITALS",
    environment:"GitHub Actions Playwright Next.js dev server (not production)",
    evidence:measurements,notes:"Only a benchmark baseline, not field Core Web Vitals. Page-level horizontal overflow is diagnostic."};
  await mkdir("benchmarks/website/reports",{recursive:true});
  await writeFile("benchmarks/website/reports/mobile-browser-baseline.json",JSON.stringify(report,null,2)+"\n");
  expect(measurements.every(m=>m.status===200)).toBe(true);
});

test("theme toggle preserves readable dashboard sidebar and consistent tool counts", async ({page}) => {
  await page.goto("/dashboard");
  const countLabel = `Browse all ${TOOL_ROUTES.length} tools`;
  await expect(page.getByRole("link", {name: countLabel})).toBeVisible();
  await expect(page.getByText("Working tools", {exact: true}).locator("..")).toContainText(String(TOOL_ROUTES.length));

  const toggle = page.getByRole("button", {name: "Toggle theme"});
  const html = page.locator("html");
  const brand = page.locator("aside").last().getByText("Kukureku PDF Workspace", {exact: true});
  await expect(brand).toBeVisible();

  if(await html.evaluate(element => element.classList.contains("dark"))) {
    await toggle.click();
  }
  await expect(html).not.toHaveClass(/dark/);
  const light = await brand.evaluate(element => ({
    title: getComputedStyle(element).color,
    card: getComputedStyle(element.parentElement.parentElement.parentElement).backgroundImage,
  }));

  await toggle.click();
  await expect(html).toHaveClass(/dark/);
  const dark = await brand.evaluate(element => ({
    title: getComputedStyle(element).color,
    card: getComputedStyle(element.parentElement.parentElement.parentElement).backgroundImage,
  }));
  expect(light.title).not.toBe(dark.title);
  expect(light.card).not.toBe(dark.card);

  await page.goto("/merge-pdf");
  await expect(page.getByRole("link", {name: countLabel})).toHaveCount(2);
});
