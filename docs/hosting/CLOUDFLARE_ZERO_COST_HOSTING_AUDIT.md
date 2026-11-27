# Zero-Cost Hosting Assessment — Cloudflare

**Status:** Read-only audit complete; compatibility experiment not yet run.  
**Audited production baseline:** `main` at `4d41cdf36c2319f59ec8b5c35d4a999799010802`  
**Scope:** Hosting feasibility only. No production, DNS, Vercel, billing, privacy, PDF-engine, or application behaviour changes.

## Executive assessment

Cloudflare is a credible $0/month hosting candidate for a controlled staging deployment. It is not yet approved as a production replacement.

The repository has a large Next.js App Router surface (including the homepage, workspace tools, guides, trust and legal pages), but the audited tree contains no `app/api` route handlers, middleware, proxy, dynamic route segments, or obvious server-action directory. The root and workspace layouts are React server components. The README states that supported document processing is intended to happen locally in the browser.

This architecture may be compatible with a static export, but the audit does not prove it. If static export is not compatible, Cloudflare Workers with the OpenNext adapter is the conservative first experiment. Cloudflare currently recommends vinext for new Next.js-on-Workers applications, but its documentation describes vinext as beta; it should not be adopted for production without compatibility testing.

## Repository evidence

- `package.json`: Next.js `16.4.2`; React `19.2.4`; client-side PDF-related dependencies include `pdf-lib`, `pdfjs-dist`, `tesseract.js`, and `qpdf-run`.
- `next.config.ts`: security response headers are configured through `headers()`; no custom runtime configuration was found in this file.
- `app/layout.tsx`: uses Next metadata, `next/font/google`, theme provider, toaster, and Vercel Analytics.
- `app/page.tsx`: homepage is a server component with static metadata and structured data.
- `app/(workspace)/layout.tsx`: workspace shell is a server component.
- `vercel.json`: contains branch deployment holds; this file is Vercel-specific and must not be copied as Cloudflare configuration.
- Static PDF assets include `public/qpdf/qpdf.js`, `public/qpdf/qpdf.wasm`, and `public/qpdf/worker.js`. Their MIME type, path resolution, caching, worker loading, and size limits must be tested on the candidate host.
- Repository tree audit: 877 entries; 179 under `app/`; no `app/api/` route handlers; no `middleware.ts`, `proxy.ts`, `instrumentation.ts`, dynamic route segments, or route-handler files were found.
- README describes 30 public PDF tools and browser-local document processing; this is product documentation, not independent runtime verification.

## Hosting paths

### Option A — Next.js static export to Cloudflare Pages

Potentially the lowest-complexity, $0/month route if every page can be prerendered and no runtime server features are required. Do not enable `output: "export"` until a CI experiment proves that the complete app builds and every route is emitted. Static export may expose hidden dynamic dependencies or assumptions.

### Option B — Cloudflare Workers with OpenNext

Preferred fallback if static export is not possible. Cloudflare documents support for Next.js 16, App Router, React Server Components, SSG, SSR, route handlers, Server Actions, middleware and streaming through OpenNext. Node.js in Middleware is not supported; the current tree audit did not find middleware.

### Option C — vinext

Cloudflare's current recommended default for new Next.js-on-Workers projects, but Cloudflare labels it beta. Defer until compatibility testing shows a concrete advantage over OpenNext for this existing app.

## Cost and quota notes

Cloudflare Workers Free is listed at $0/month with 100,000 requests/day and 10 ms CPU per request, plus static asset hosting. These are account/plan limits, not a promise of unlimited compute. Dynamic page requests and server work consume Worker capacity; static assets have separate limits. A free-tier deployment must be monitored for quota exhaustion and failed requests.

## Risks to test before any production cutover

1. Every route builds and resolves correctly, including all workspace tools, guides, trust pages, sitemap, robots, manifest, and not-found page.
2. PDF.js, qpdf WASM, Tesseract workers and all other worker assets load correctly from production-like paths and MIME types.
3. Upload, processing, download, print, drag/drop, workspace persistence, backup/restore, Magic Drop and cross-tool handoff remain browser-local and functional.
4. Large PDFs do not trigger host request-body or CPU constraints because document bytes should not be sent to the host.
5. Security headers from `next.config.ts` are reproduced on the candidate platform.
6. Canonical URLs, metadata, structured data, sitemap, robots, redirects and 404 behaviour remain correct.
7. Analytics is intentionally handled; `@vercel/analytics/next` must not be assumed to provide useful telemetry on Cloudflare without verification.
8. No new paid resources, Workers Paid plan, Cloudflare Images, R2, D1, or other billable services are introduced.

## Staged plan

- [x] Read-only audit of production baseline and repository tree.
- [x] Create an isolated hosting-audit branch and record findings.
- [ ] Add a CI-only static-export compatibility experiment (no production config change).
- [ ] If static export fails, test OpenNext on a separate branch with a disposable `workers.dev` preview only.
- [ ] Run full route, browser, privacy/network, PDF worker and mobile acceptance checks.
- [ ] Compare actual free-tier limits and operating behaviour.
- [ ] Present evidence and a cutover/rollback plan for explicit approval.

## Release safety

This branch must not be merged automatically. No Vercel deployment, Cloudflare deployment, DNS update, domain transfer, billing change, or production cutover is authorized by this assessment. Keep the existing production deployment and Vercel project untouched until a candidate passes acceptance and a separate cutover is approved.

## Official references

- Cloudflare Next.js on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare OpenNext adapter: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare static Next.js on Pages: https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
