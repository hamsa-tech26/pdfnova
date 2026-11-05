import {describe,it,expect} from "vitest";
import {PUBLIC_PATHS,MONITORED_PATHS,summarizeHttpProbe,
  summarizeSecurityHeaders,runPublicSiteAudit} from "../../../scripts/auditPublicHttp.mjs";
import {TOOL_ROUTES} from "../../../scripts/indexNowRoutes.mjs";
describe("independent public reachability audit",()=>{
  it("checks HTML, robots and XML endpoints",()=>{
    expect(PUBLIC_PATHS).toEqual(["/","/robots.txt","/sitemap.xml"]);
    expect(summarizeHttpProbe("/",200,"text/html; charset=utf-8",null).result).toBe("PASS");
    expect(summarizeHttpProbe("/robots.txt",200,"text/plain",null).result).toBe("PASS");
    expect(summarizeHttpProbe("/sitemap.xml",200,"application/xml",null).result).toBe("PASS");
  });
  it("refuses to report a 402 billing gate as a publicly accessible website",()=>{
    expect(summarizeHttpProbe("/",402,"text/html",null).result).toBe("ACCESS_NOT_VERIFIED");
  });
  it("flags a redirect or an error page rather than silently claiming access",()=>{
    expect(summarizeHttpProbe("/",308,"text/html","same-origin").result).toBe("ACCESS_NOT_VERIFIED");
    expect(summarizeHttpProbe("/robots.txt",200,"text/html",null).result).toBe("ACCESS_NOT_VERIFIED");
    expect(summarizeHttpProbe("/sitemap.xml",404,"text/html",null).result).toBe("ACCESS_NOT_VERIFIED");
  });
  it("monitors all 31 tools and critical trust pages without duplicates",()=>{
    expect(TOOL_ROUTES).toHaveLength(31);
    expect(MONITORED_PATHS).toHaveLength(37);
    expect(new Set(MONITORED_PATHS).size).toBe(MONITORED_PATHS.length);
    for(const route of TOOL_ROUTES)expect(MONITORED_PATHS).toContain(route);
    expect(MONITORED_PATHS).toContain("/privacy");
    expect(MONITORED_PATHS).toContain("/trust/verification");
    expect(MONITORED_PATHS).toContain("/guides/choose-pdf-tool");
  });
  it("requires five baseline public HTTP security controls",()=>{
    const headers=new Headers({
      "strict-transport-security":"max-age=63072000",
      "x-content-type-options":"nosniff",
      "x-frame-options":"DENY",
      "content-security-policy":"frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
      "referrer-policy":"strict-origin-when-cross-origin",
    });
    expect(summarizeSecurityHeaders(headers).result).toBe("PASS");
    headers.delete("x-content-type-options");
    expect(summarizeSecurityHeaders(headers).result).toBe("REGRESSION");
    headers.set("x-content-type-options","nosniff");
    headers.set("strict-transport-security","max-age=300");
    expect(summarizeSecurityHeaders(headers).result).toBe("REGRESSION");
  });
  it("passes a complete synthetic public-route audit with security headers",async()=>{
    const fetchImpl:typeof fetch=async(input,options)=>{
      const pathname=new URL(input.toString()).pathname;
      const headers=new Headers({
        "content-type":pathname==="/robots.txt"?"text/plain":
          pathname==="/sitemap.xml"?"application/xml":"text/html",
      });
      if(pathname==="/"){
        headers.set("strict-transport-security","max-age=63072000");
        headers.set("x-content-type-options","nosniff");
        headers.set("x-frame-options","DENY");
        headers.set("content-security-policy",
          "frame-ancestors 'none'; object-src 'none'");
        headers.set("referrer-policy","strict-origin-when-cross-origin");
      }
      expect(["GET","HEAD"]).toContain(options?.method);
      return new Response(null,{status:200,headers});
    };
    const report=await runPublicSiteAudit({fetchImpl,
      paths:["/","/robots.txt","/sitemap.xml","/merge-pdf"],retryDelayMs:0});
    expect(report.result).toBe("PASS");
    expect(report.counts).toEqual({total:4,passed:4,failed:0});
    expect(report.securityHeaders.checks).toHaveLength(5);
  });
  it("uses read-only HTTP, retries one transient failure, and hides private data",async()=>{
    const requests:{url:string,method:string,body?:unknown}[]=[];
    const fetchImpl:typeof fetch=async(input,options)=>{
      expect(options?.body).toBeUndefined();
      expect(new Headers(options?.headers).has("cookie")).toBe(false);
      expect(new Headers(options?.headers).has("authorization")).toBe(false);
      requests.push({url:input.toString(),method:options?.method??"GET"});
      return new Response(null,{
        status:requests.length===1?503:200,
        headers:{"content-type":"text/html; charset=utf-8"},
      });
    };
    const result=await runPublicSiteAudit({fetchImpl,
      paths:["/merge-pdf"],retryDelayMs:0});
    expect(requests).toHaveLength(2);
    expect(requests.every(x=>x.method==="HEAD")).toBe(true);
    expect(requests.every(x=>!x.url.includes("?"))).toBe(true);
    expect(result.probes[0].attempts).toBe(2);
    expect(result.counts).toEqual({total:1,passed:1,failed:0});
    // No root security result is available when a test probes only a tool page.
    expect(result.result).toBe("ACCESS_NOT_VERIFIED");
  });
  it("fails a hard 404 without retrying",async()=>{
    let calls=0;
    const result=await runPublicSiteAudit({paths:["/merge-pdf"],
      fetchImpl:async()=>{
        calls++;
        return new Response(null,{status:404,
          headers:{"content-type":"text/html"}});
      },retryDelayMs:0});
    expect(calls).toBe(1);
    expect(result.probes[0].result).toBe("ACCESS_NOT_VERIFIED");
  });
});
