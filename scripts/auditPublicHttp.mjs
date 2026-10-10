/**
 * Public HTTP probe from an independent GitHub runner.
 * It intentionally never sends private documents, credentials or cookies.
 * Status is diagnostic; Vercel READY is not evidence that HTTP returns 200.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";

export const PUBLIC_PATHS=["/","/robots.txt","/sitemap.xml"];
const ORIGIN="https://kukureku.com";
export function summarizeHttpProbe(pathname,status,type,redirect) {
  const allowedRedirect=status===301||status===302||status===307||status===308;
  const ok=status===200 && (
    pathname==="/" ? type.includes("text/html") :
    pathname==="/robots.txt" ? type.includes("text/plain") :
    type.includes("xml")
  );
  return {path:pathname,status,contentType:type,redirect:allowedRedirect ? redirect : null,
    result:ok?"PASS":"ACCESS_NOT_VERIFIED"};
}
async function checkPublicPath(pathname){
  const url=new URL(pathname,ORIGIN);
  try {
    const response=await fetch(url,{method:"GET",redirect:"manual",
      signal:AbortSignal.timeout(18000),
      headers:{"user-agent":"Kukureku-Public-Health-Check/1.0","accept":"text/html,application/xml,text/xml,text/plain"}});
    const contentType=response.headers.get("content-type")??"";
    // Never follow unexpected redirects to unreviewed domains.
    const location=response.headers.get("location");
    const redirect=location ? new URL(location,url).origin===url.origin ? "same-origin" : "different-origin" : null;
    await response.body?.cancel();
    return summarizeHttpProbe(pathname,response.status,contentType,redirect);
  } catch(e) {
    return {path:pathname,status:null,contentType:null,redirect:null,
      result:"ACCESS_NOT_VERIFIED",error:e instanceof Error?e.name:"unknown network error"};
  }
}
export async function runPublicSiteAudit(){
  const results=await Promise.all(PUBLIC_PATHS.map(checkPublicPath));
  return {origin:ORIGIN,scope:"INDEPENDENT_HTTP_REQUEST_FROM_CI_NOT_BROWSER_INTERACTION",
    result:results.every(x=>x.result==="PASS")?"PASS":"ACCESS_NOT_VERIFIED",
    probes:results,warning:"Never infer public reachability from Vercel deployment READY alone."};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const report=await runPublicSiteAudit();
  const out="benchmarks/website/reports/public-http.json";
  await mkdir(path.dirname(out),{recursive:true});
  await writeFile(out,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  if(report.result!=="PASS")process.exitCode=2;
}
