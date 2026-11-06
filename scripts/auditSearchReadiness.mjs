/**
 * Read-only public SEO readiness checks. This is not a Google index report.
 * Do not send user files, cookies, credentials or URLs with query parameters.
 */
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {ORIGIN, PUBLIC_ROUTES, TOOL_ROUTES} from "./indexNowRoutes.mjs";

const MAX_ATTEMPTS = 2;
const MAX_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 15_000;
const BATCH_SIZE = 5;
const REPORT_PATH = path.join(
  process.cwd(), "benchmarks/website/reports/search-readiness.json",
);

function attribute(tag, name) {
  const expression = new RegExp("(?:^|\\s)" + name +
    "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i");
  const match = expression.exec(tag);
  return match?.[1] ?? match?.[2] ?? "";
}

function findHeadTag(head, type, name, value) {
  const tags = head.match(new RegExp("<" + type + "\\b[^>]*>", "gi")) ?? [];
  return tags.find(tag => attribute(tag, name).toLowerCase() === value) ?? "";
}

function checkHref(html, href) {
  const tags = html.match(/<a\b[^>]*>/gi) ?? [];
  return tags.some(tag => attribute(tag, "href") === href);
}

export function summarizePublicPage(pathname, html, sitemapPaths, listedRoutes) {
  const head = html.split(/<\/head\s*>/i)[0] ?? "";
  const title = /<title\b[^>]*>([^<]*)<\/title>/i.exec(head)?.[1]?.trim() ?? "";
  const descriptionTag = findHeadTag(head, "meta", "name", "description");
  const description = attribute(descriptionTag, "content").trim();
  const canonicalTag = findHeadTag(head, "link", "rel", "canonical");
  const canonical = attribute(canonicalTag, "href");
  const robots = attribute(findHeadTag(head, "meta", "name", "robots"), "content");
  const expectedCanonical = ORIGIN + (pathname === "/" ? "" : pathname);
  const checks = {
    title: title.length >= 10,
    description: description.length >= 30,
    canonical: canonical === expectedCanonical,
    singleH1: (html.match(/<h1(?:\s|>)[^>]*>/gi) ?? []).length === 1,
    indexable: !/\bnoindex\b/i.test(robots),
    sitemap: sitemapPaths.has(expectedCanonical),
    routeListed: listedRoutes.has(pathname),
  };
  return {
    path: pathname,
    title: title.slice(0, 160),
    canonical,
    result: Object.values(checks).every(Boolean) ? "PASS" : "REGRESSION",
    checks,
  };
}

export function summarizeDiscoveryLinks(home, guideIndex, paths) {
  const toolPaths = paths.filter(route => TOOL_ROUTES.includes(route));
  const guidePaths = paths.filter(route => route.startsWith("/guides/"));
  return {
    homepageToolLinks: {
      found: toolPaths.filter(route => checkHref(home, route)).length,
      expected: toolPaths.length,
    },
    guideIndexLinks: {
      found: guidePaths.filter(route => checkHref(guideIndex, route)).length,
      expected: guidePaths.length,
    },
  };
}

async function fetchPublic(pathname, fetchImpl, retryDelayMs) {
  const url = new URL(pathname, ORIGIN);
  let lastError = "NETWORK_FAILURE";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          accept: pathname === "/sitemap.xml" ? "application/xml,text/xml" :
            pathname === "/robots.txt" ? "text/plain" : "text/html",
          "user-agent": "Kukureku-Public-Search-Readiness/1.0",
        },
      });
      const type = response.headers.get("content-type") ?? "";
      if (response.status !== 200) {
        await response.body?.cancel();
        lastError = "HTTP_" + response.status;
        if (attempt < MAX_ATTEMPTS &&
          (response.status === 429 || response.status >= 500)) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }
        break;
      }
      const expectedType = pathname === "/robots.txt" ? "text/plain" :
        pathname === "/sitemap.xml" ? "xml" : "text/html";
      if (!type.includes(expectedType)) {
        await response.body?.cancel();
        lastError = "UNEXPECTED_CONTENT_TYPE";
        break;
      }
      if (Number(response.headers.get("content-length")) > MAX_BYTES) {
        await response.body?.cancel();
        lastError = "HTML_SIZE_LIMIT";
        break;
      }
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_BYTES) {
        lastError = "HTML_SIZE_LIMIT";
        break;
      }
      return {ok: true, body};
    } catch {
      lastError = "NETWORK_FAILURE";
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  return {ok: false, error: lastError};
}

export async function runSearchReadinessAudit({
  fetchImpl = fetch,
  routes = PUBLIC_ROUTES,
  batchSize = BATCH_SIZE,
  retryDelayMs = 350,
} = {}) {
  const paths = [...new Set(routes)];
  const allPaths = [...new Set([...paths, "/robots.txt", "/sitemap.xml"])];
  const responses = new Map();
  for (let i = 0; i < allPaths.length; i += batchSize) {
    const batch = allPaths.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(route =>
      fetchPublic(route, fetchImpl, retryDelayMs)));
    batch.forEach((route, index) => responses.set(route, results[index]));
  }

  const sitemap = responses.get("/sitemap.xml");
  const robots = responses.get("/robots.txt");
  const sitemapPaths = new Set(
    sitemap?.ok ?
      [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]) : [],
  );
  const listedRoutes = new Set(PUBLIC_ROUTES);
  const pages = paths.map(route => {
    const response = responses.get(route);
    if (!response?.ok) {
      return {path: route, result: "NOT_VERIFIED",
        reason: response?.error ?? "NOT_FETCHED"};
    }
    return summarizePublicPage(route, response.body, sitemapPaths, listedRoutes);
  });
  const homepage = responses.get("/");
  const guides = responses.get("/guides");
  const links = summarizeDiscoveryLinks(
    homepage?.ok ? homepage.body : "",
    guides?.ok ? guides.body : "",
    paths,
  );
  const discovery = {
    robots: Boolean(robots?.ok &&
      /^sitemap:\s*https:\/\/kukureku\.com\/sitemap\.xml\s*$/im.test(robots.body) &&
      !/^disallow:\s*\/\s*$/im.test(robots.body)),
    sitemapCoverage: paths.every(route =>
      sitemapPaths.has(ORIGIN + (route === "/" ? "" : route))),
    sitemapNoExtraneousUrls: sitemapPaths.size === paths.length,
    routeListCoverage: paths.every(route => listedRoutes.has(route)),
    homepageToolLinks: links.homepageToolLinks.found === links.homepageToolLinks.expected,
    guideIndexLinks: links.guideIndexLinks.found === links.guideIndexLinks.expected,
  };
  const passed = pages.filter(page => page.result === "PASS").length;
  const result = passed === paths.length &&
    Object.values(discovery).every(Boolean) ? "PASS" : "READINESS_NOT_VERIFIED";
  return {
    version: 1,
    checkedAt: new Date().toISOString(),
    origin: ORIGIN,
    scope: "PUBLIC_HTML_METADATA_ONLY_NO_USER_DOCUMENTS",
    result,
    counts: {total: paths.length, passed, failed: paths.length - passed},
    discovery,
    links,
    pages,
    warning: "Technical crawl readiness does not prove Google indexing, search impressions, traffic quality or completed PDF workflows.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runSearchReadinessAudit();
    await mkdir(path.dirname(REPORT_PATH), {recursive: true});
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({
      result: report.result,
      counts: report.counts,
      discovery: report.discovery,
      report: "benchmarks/website/reports/search-readiness.json",
    }));
    if (report.result !== "PASS") process.exitCode = 2;
  } catch (error) {
    console.error("Search readiness audit failed safely:", String(error));
    process.exitCode = 2;
  }
}
