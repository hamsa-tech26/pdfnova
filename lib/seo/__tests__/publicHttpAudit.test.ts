import {describe,it,expect} from "vitest";
import {PUBLIC_PATHS,summarizeHttpProbe} from "../../../scripts/auditPublicHttp.mjs";
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
});
