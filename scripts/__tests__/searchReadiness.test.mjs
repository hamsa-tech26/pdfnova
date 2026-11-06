import {describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";
import {
  runSearchReadinessAudit,
  summarizeDiscoveryLinks,
  summarizePublicPage,
} from "../auditSearchReadiness.mjs";
import {PUBLIC_ROUTES} from "../indexNowRoutes.mjs";

function html(pathname, {
  canonical = "https://kukureku.com" + (pathname === "/" ? "" : pathname),
  robots = "",
  title = "Kukureku private PDF tools",
  description = "A private browser-based document utility with explicit limitations.",
  body = "",
} = {}) {
  return "<!doctype html><html><head><title>" + title + "</title>" +
    '<meta name="description" content="' + description + '">' +
    '<link rel="canonical" href="' + canonical + '">' +
    (robots ? '<meta name="robots" content="' + robots + '">' : "") +
    "</head><body><h1>Public PDF utility</h1>" + body + "</body></html>";
}

describe("technical search readiness (not indexing evidence)", () => {
  it("includes all seven public guides in the submission route list", () => {
    expect(PUBLIC_ROUTES.filter(route => route.startsWith("/guides/"))).toHaveLength(7);
    expect(PUBLIC_ROUTES).toContain("/guides/merge-pdf-without-uploading");
    expect(PUBLIC_ROUTES).toContain("/guides/pdf-to-word-without-uploading");
    expect(new Set(PUBLIC_ROUTES).size).toBe(PUBLIC_ROUTES.length);
  });

  it("connects high-intent tools to real guides and offers PDF to Word from the homepage", () => {
    const source = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
    const home = source("app/page.tsx");
    const merge = source("app/(workspace)/merge-pdf/page.tsx");
    const compress = source("app/(workspace)/compress-pdf/page.tsx");
    const word = source("app/(workspace)/pdf-to-word/page.tsx");
    const guideIndex = source("app/guides/page.tsx");
    expect(home).toContain('href: "/pdf-to-word"');
    expect(merge).toContain('href: "/guides/merge-pdf-without-uploading"');
    expect(compress).toContain('href: "/guides/compress-pdf-without-uploading"');
    expect(word).toContain('href: "/guides/pdf-to-word-without-uploading"');
    expect(guideIndex).toContain('href: "/guides/pdf-to-word-without-uploading"');
    const guide = source("app/guides/pdf-to-word-without-uploading/page.tsx");
    for (const route of ["/pdf-to-word", "/ocr-pdf", "/word-to-pdf"]) {
      expect(guide).toContain(`href="${route}"`);
    }
    expect(guide).toContain('canonical: guidePath');
  });

  it("keeps the source sitemap list and IndexNow list synchronized", () => {
    const source = readFileSync(new URL("../../app/sitemap.ts", import.meta.url), "utf8");
    const list = source.split("const publicRoutes = [")[1]?.split("];")[0] ?? "";
    const declared = [...list.matchAll(/^\s*"([^"]*)",?\s*$/gm)]
      .map(match => match[1] || "/");
    expect(declared.sort()).toEqual([...PUBLIC_ROUTES].sort());
  });

  it("accepts a descriptive page with matching canonical and sitemap", () => {
    const route = "/merge-pdf";
    const result = summarizePublicPage(route, html(route),
      new Set(["https://kukureku.com" + route]), new Set([route]));
    expect(result.result).toBe("PASS");
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
  });

  it("catches noindex, missing description, a second heading and a wrong canonical", () => {
    const route = "/merge-pdf";
    const result = summarizePublicPage(route,
      html(route, {robots: "noindex", description: "", canonical: "https://other.example/"}) +
      "<h1>Second heading</h1>",
      new Set(), new Set());
    expect(result.result).toBe("REGRESSION");
    expect(result.checks.description).toBe(false);
    expect(result.checks.canonical).toBe(false);
    expect(result.checks.indexable).toBe(false);
    expect(result.checks.sitemap).toBe(false);
    expect(result.checks.routeListed).toBe(false);
    expect(result.checks.singleH1).toBe(false);
  });

  it("catches missing discoverable links in public navigation", () => {
    const links = summarizeDiscoveryLinks(
      '<a href="/merge-pdf">Merge</a>',
      '<a href="/guides/merge-pdf-without-uploading">Guide</a>',
      ["/merge-pdf", "/compress-pdf", "/guides/merge-pdf-without-uploading"],
    );
    expect(links.homepageToolLinks).toEqual({found: 1, expected: 2});
    expect(links.guideIndexLinks).toEqual({found: 1, expected: 1});
  });

  it("makes only read-only requests with no cookies, credentials or query strings", async () => {
    const routes = ["/", "/guides", "/merge-pdf"];
    const sitemap = '<?xml version="1.0" ?><urlset>' + routes.map(
      route => "<url><loc>https://kukureku.com" +
        (route === "/" ? "" : route) + "</loc></url>",
    ).join("") + "</urlset>";
    const bodies = new Map([
      ["/", html("/", {body: '<a href="/merge-pdf">Merge</a>'})],
      ["/guides", html("/guides")],
      ["/merge-pdf", html("/merge-pdf")],
      ["/sitemap.xml", sitemap],
      ["/robots.txt", "User-agent: *\nAllow: /\nSitemap: https://kukureku.com/sitemap.xml"],
    ]);
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({url: String(url), options});
      const route = new URL(url).pathname;
      return new Response(bodies.get(route) ?? "Missing", {
        status: bodies.has(route) ? 200 : 404,
        headers: {"content-type": route === "/sitemap.xml" ? "application/xml" :
          route === "/robots.txt" ? "text/plain" : "text/html"},
      });
    };
    const report = await runSearchReadinessAudit({
      fetchImpl, routes, batchSize: 2, retryDelayMs: 0,
    });
    expect(report.result).toBe("PASS");
    expect(report.counts).toEqual({total: 3, passed: 3, failed: 0});
    expect(requests).toHaveLength(5);
    for (const request of requests) {
      expect(request.options.method).toBe("GET");
      expect(request.options).not.toHaveProperty("body");
      expect(request.options.headers).not.toHaveProperty("cookie");
      expect(new URL(request.url).search).toBe("");
    }
  });
});
