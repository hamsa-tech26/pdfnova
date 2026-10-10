import {test,expect} from "@playwright/test";
test("workflow instructions stay in browser state, not URLs or storage, and do not trigger tool execution", async({page})=>{
  await page.goto("/workflow-planner");
  const secretMarker="sensitive-request-fixture-not-a-real-secret";
  const visited=[];
  page.on("request",request=>{if(request.url().includes(secretMarker))visited.push(request.url());});
  await page.getByLabel("What would you like to do?").fill("Merge my PDFs, "+secretMarker+" then protect them.");
  await page.getByRole("button",{name:/Create manual plan/}).click();
  await expect(page.getByRole("heading",{name:"Your proposed steps (2)"})).toBeVisible();
  expect(page.url()).not.toContain(secretMarker);
  expect(visited).toEqual([]);
  const found=await page.evaluate(needle=>{
    const entries=[];
    for(const store of [window.localStorage,window.sessionStorage]){
      for(let i=0;i<store.length;i++){
        const key=store.key(i);
        if(key && (key.includes(needle) || store.getItem(key)?.includes(needle)))entries.push(key);
      }
    }
    return entries;
  },secretMarker);
  expect(found).toEqual([]);
});


test("manual JSON import enforces trusted routes and never follows injected URLs", async({page})=>{
  await page.goto("/workflow-planner");
  const observed = [];
  page.on("request",request=>{if(request.url().includes("untrusted-workflow.invalid")) observed.push(request.url());});
  const input = page.locator("#saved-manual-plan");
  const valid = {
    schema:"kukureku-manual-workflow-v1",
    operations:[{id:"merge",href:"/merge-pdf",title:"Attacker title",note:"Never trust this note"}],
  };
  await input.setInputFiles({name:"manual-plan.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(valid))});
  await expect(page.getByRole("heading",{name:"Your proposed steps (1)"})).toBeVisible();
  await expect(page.getByText("Attacker title")).toHaveCount(0);
  await expect(page.locator("ol a")).toHaveAttribute("href","/merge-pdf");
  const injected = {
    schema:"kukureku-manual-workflow-v1",
    operations:[{id:"merge",href:"https://untrusted-workflow.invalid/leak"}],
  };
  await input.setInputFiles({name:"unsafe.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(injected))});
  await expect(page.getByRole("alert")).toContainText("unsafe tool route");
  await expect(page.locator("ol a")).toHaveAttribute("href","/merge-pdf");
  expect(observed).toEqual([]);
});
