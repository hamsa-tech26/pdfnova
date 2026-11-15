#!/usr/bin/env node
/**
 * Task 253. No private content or documents are used.
 * This verifies the existing security-header baseline, not total CSP hardening.
 */
import assert from "node:assert/strict";

const origin = new URL("https://kukureku.com");
const paths = ["/", "/redact-pdf", "/pdf-to-excel", "/workspace-health"];
const requirements = new Map([
  ["frame-ancestors", "'none'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["form-action", "'self'"],
]);

function parseCsp(value) {
  const directives = new Map();
  for (const raw of value.split(";")) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const key = tokens.shift().toLowerCase();
    assert(!directives.has(key), "Duplicate CSP directive: " + key);
    directives.set(key, tokens);
  }
  return directives;
}
for (const path of paths) {
  const res = await fetch(new URL(path, origin), {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    headers: { "User-Agent": "KukurekuSyntheticHeaderAudit/1.0", "Accept": "text/html" },
  });
  assert.equal(res.status, 200, "Unexpected public route status at " + path);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff", "MIME protection missing at " + path);
  assert.equal(res.headers.get("x-frame-options"), "DENY", "Framing protection missing at " + path);
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin", "Referrer policy mismatch at " + path);
  const permissions = res.headers.get("permissions-policy") || "";
  for (const disabled of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
    assert(permissions.includes(disabled), "Permission guard missing at " + path + ": " + disabled);
  }
  const raw = res.headers.get("content-security-policy");
  assert(raw, "CSP missing at " + path);
  const directives = parseCsp(raw);
  for (const [key, expected] of requirements) {
    assert.deepEqual(directives.get(key), [expected], "Expected CSP directive missing at " + path + ": " + key);
  }
  const missing = ["script-src", "connect-src", "worker-src"].filter(key => !directives.has(key));
  console.log(JSON.stringify({
    test: "LIVE_SECURITY_HEADER_BASELINE",
    path,
    result: "PASS",
    reviewPending: missing,
    limitations: "Header presence only; not a full CSP, data exfiltration or penetration audit",
  }));
  await res.body?.cancel();
}
console.log(JSON.stringify({ task: 253, testedRoutes: paths.length, customerPdfInputs: 0, result: "PASS" }));
