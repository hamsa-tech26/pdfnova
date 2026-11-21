# Task 275 — Remove internal data-URL fetch from image-only PDF compression

**DRAFT / NO MERGE / NO DEPLOY.** This is a narrowly scoped runtime remediation based on Task 271's report-only CSP evidence.

## Finding and fix
- Task 271 showed Chromium (2) and Linux WebKit (1) `connect-src data:` report-only events during the image-only compression path.
- Root cause: `lib/pdf/compress.ts` used `fetch(renderedPage.dataUrl)` to convert a locally rendered JPEG data URL into bytes. This was an internal browser-local data URL, not a remote upload, but it conflicts with a strict `connect-src 'self'` candidate.
- Replace the fetch with a small local `dataUrlToBytes` decoder supporting base64 and percent-encoded payloads. No URL request is made. Add focused unit tests for valid JPEG/base64, percent-encoded payloads, and malformed inputs.

## Acceptance
- Re-run both Task 271 cases against the live site with candidate CSP Report-Only: text PDF compression remains unchanged; image-only compression still downloads a smaller PDF and displays the rasterization warning.
- Require **zero `connect-src data:` violations** in both Chromium and Linux WebKit. Existing inline-script events are tracked separately and are not silently waived.
- Unit-test the decoder in CI. Keep all output and privacy checks from Task 271.

## Boundaries
- One runtime helper and one call-site replacement only; no production CSP enforcement, no third-party reporting endpoint, no user-document upload, no Vercel deployment.
- Direct source-byte/base64 checks do not exclude transformed or encrypted egress; Linux WebKit is not physical iPhone certification.

**DRAFT / NO MERGE / NO DEPLOY.** Release 216 remains paused; Engine V4 Stable remains 0/20. Branch `fix/task275-local-dataurl-decode` is explicitly excluded from Vercel automatic deployment.
