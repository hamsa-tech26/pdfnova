import {test,expect} from "@playwright/test";

// This test collects no document text, request bodies, user paths, or query
// strings. It is diagnostics only: report-only policies do NOT block egress.
for (const path of ["/", "/pdf-to-excel", "/redact-pdf"]) {
  test("diagnostic CSP is observable on " + path, async ({page}) => {
    await page.addInitScript(() => {
      window.__cspAudit = [];
      document.addEventListener("securitypolicyviolation", event => {
        const blocked = String(event.blockedURI || "");
        let scheme = "unknown";
        try { scheme = new URL(blocked).protocol.replace(":", ""); } catch {}
        window.__cspAudit.push({
          directive: event.effectiveDirective,
          scheme,
          disposition: event.disposition,
        });
      });
    });
    const response = await page.goto(path, {waitUntil: "networkidle"});
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy-report-only"] || "")
      .toContain("connect-src 'self'");
    await expect(page.locator("main h1").first()).toBeVisible();
    const audit = await page.evaluate(() => window.__cspAudit || []);
    expect(audit.every(item => item.disposition === "report")).toBe(true);
    const counts = audit.reduce((result, item) => {
      const key = item.directive + ":" + item.scheme;
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    console.log(JSON.stringify({
      check: "CSP_REPORT_ONLY_DIAGNOSTIC",
      path, counts, documentDataLogged: false,
      outcome: "OBSERVED_NOT_ENFORCED",
    }));
  });
}
