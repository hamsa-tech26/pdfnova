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
