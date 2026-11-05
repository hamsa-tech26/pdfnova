/**
 * Independent, read-only production monitoring from GitHub Actions.
 *
 * Never sends user PDFs, cookies, passwords, query strings or request bodies.
 * A public 200 response proves route availability, not functional PDF output.
 */
import {mkdir, writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import {TOOL_ROUTES} from "./indexNowRoutes.mjs";

export const ORIGIN = "https://kukureku.com";
export const PUBLIC_PATHS = ["/", "/robots.txt", "/sitemap.xml"];
export const MONITORED_PATHS = [
  ...new Set([
    ...PUBLIC_PATHS,
    ...TOOL_ROUTES,
    "/privacy",
    "/trust/verification",
    "/guides/choose-pdf-tool",
  ]),
];

const MAX_ATTEMPTS = 2;
const BATCH_SIZE = 6;
const REQUEST_TIMEOUT_MS = 12000;

export function summarizeHttpProbe(pathname, status, type, redirect) {
  const allowedRedirect = [301, 302, 307, 308].includes(status);
  const ok = status === 200 && (
    pathname === "/robots.txt" ? type.includes("text/plain") :
    pathname === "/sitemap.xml" ? type.includes("xml") :
    type.includes("text/html")
  );
  return {
    path: pathname,
    status,
    contentType: type,
    redirect: allowedRedirect ? redirect : null,
    result: ok ? "PASS" : "ACCESS_NOT_VERIFIED",
  };
}

export function summarizeSecurityHeaders(headers) {
  const hsts = headers.get("strict-transport-security") ?? "";
  const maxAge = Number(/(?:^|;)\s*max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
  const csp = headers.get("content-security-policy") ?? "";
  const checks = {
    "strict-transport-security": maxAge >= 31536000,
    "x-content-type-options":
      (headers.get("x-content-type-options") ?? "").toLowerCase() === "nosniff",
    "x-frame-options":
      (headers.get("x-frame-options") ?? "").toUpperCase() === "DENY",
    "content-security-policy": csp.includes("frame-ancestors 'none'") &&
      csp.includes("object-src 'none'"),
    "referrer-policy": ["no-referrer", "same-origin", "strict-origin",
      "strict-origin-when-cross-origin"].includes(
      (headers.get("referrer-policy") ?? "").toLowerCase()),
  };
  return {
    result: Object.values(checks).every(Boolean) ? "PASS" : "REGRESSION",
    checks: Object.entries(checks).map(([header, passed]) => ({
      header, result: passed ? "PASS" : "REGRESSION",
    })),
  };
}

async function checkPublicPath(pathname, fetchImpl, retryDelayMs) {
  const url = new URL(pathname, ORIGIN);
  const method = PUBLIC_PATHS.includes(pathname) ? "GET" : "HEAD";
  let lastResult;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "user-agent": "Kukureku-Public-Health-Check/2.0",
          accept: "text/html,application/xml,text/xml,text/plain",
        },
      });
      const contentType = response.headers.get("content-type") ?? "";
      const location = response.headers.get("location");
      const redirect = location ?
        new URL(location, url).origin === url.origin ?
          "same-origin" : "different-origin" : null;
      const result = summarizeHttpProbe(
        pathname, response.status, contentType, redirect);
      const securityHeaders = pathname === "/" ?
        summarizeSecurityHeaders(response.headers) : undefined;
      await response.body?.cancel();
      lastResult = {...result, attempts: attempt, ...(securityHeaders ?
        {securityHeaders} : {})};
      // Retry transient HTTP failures only; a missing or redirected route is
      // a definite mismatch and should remain visible immediately.
      if (result.result === "PASS" ||
        ![429, 500, 502, 503, 504].includes(response.status) ||
        attempt === MAX_ATTEMPTS) return lastResult;
    } catch (e) {
      lastResult = {
        path: pathname, status: null, contentType: null, redirect: null,
        attempts: attempt, result: "ACCESS_NOT_VERIFIED",
        error: e instanceof Error ? e.name : "UnknownError",
      };
      if (attempt === MAX_ATTEMPTS) return lastResult;
    }
    if (retryDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  return lastResult;
}

export async function runPublicSiteAudit({
  fetchImpl = fetch,
  paths = MONITORED_PATHS,
  retryDelayMs = 800,
} = {}) {
  const probes = [];
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    probes.push(...await Promise.all(paths.slice(i, i + BATCH_SIZE)
      .map(pathname => checkPublicPath(pathname, fetchImpl, retryDelayMs))));
  }
  const root = probes.find(probe => probe.path === "/");
  const securityHeaders = root?.securityHeaders ?? {
    result: "NOT_VERIFIED", checks: [],
  };
  const sanitizedProbes = probes.map(({securityHeaders, ...probe}) => {
    // Security headers are summarized once, not repeated for every route.
    void securityHeaders;
    return probe;
  });
  const passed = sanitizedProbes.filter(x => x.result === "PASS").length;
  const result = passed === sanitizedProbes.length &&
    securityHeaders.result === "PASS" ? "PASS" : "ACCESS_NOT_VERIFIED";
  return {
    version: 2,
    checkedAt: new Date().toISOString(),
    origin: ORIGIN,
    scope: "READ_ONLY_PUBLIC_HTTP_NO_USER_DOCUMENTS",
    result,
    counts: {total: sanitizedProbes.length, passed,
      failed: sanitizedProbes.length - passed},
    securityHeaders,
    probes: sanitizedProbes,
    warning: "Route reachability and security headers do not verify PDF processing.",
  };
}

if (process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await runPublicSiteAudit();
  const out = "benchmarks/website/reports/public-http.json";
  await mkdir(path.dirname(out), {recursive: true});
  await writeFile(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== "PASS") process.exitCode = 2;
}
