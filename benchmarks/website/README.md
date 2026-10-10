# Website Quality V2: evidence, not assumptions

The existing GitHub checks validate the Next.js application and full browser PDF-tool workflows.

- **Independent public reachability:** \`scripts/auditPublicHttp.mjs\` requests the canonical homepage, robots.txt, and sitemap.xml with no credentials, screenshots, or document data. A 402 is **ACCESS_NOT_VERIFIED**, even if Vercel reports READY. Run via \`node scripts/auditPublicHttp.mjs\`. The workflow is intentionally advisory so platform billing failures do not misrepresent source-code quality.
- **All 30 tool-route mobile coverage:** \`e2e/website-quality.e2e.mjs\` opens every registry tool route at a 375px mobile viewport and asserts a successful HTTP response, heading, and accessible workspace menu. These are smoke checks, **not PDF conversion accuracy tests**.
- **Mobile loading baseline:** same suite records five-page DOMContentLoaded, First Contentful Paint, loaded script bytes, and scroll width. GitHub CI runs a Next.js **development server**. These timings must not be represented as real-user Core Web Vitals, production Lighthouse results, or proof of no layout shift.
- **Privacy:** Generated diagnostic metadata contains no PDFs, uploaded document content, account credentials or user-specific activity; it is stored under the ignored \`benchmarks/website/reports/\` directory.

The current domain reportedly returns HTTP 402 to independent external requests despite being READY in Vercel and DNS correctly configured. Treat that as an external-access blocker until independently confirmed otherwise. Do not spend limited deployment quota attempting to fix HTTP 402 with unrelated UI code.

## Release boundaries

This batch originates from live Release 38 and does not merge or certify the separate Release 37 PDF Engine V4 Stable qualification. Do not deploy this branch until all hard CI checks pass, and until external availability has been diagnosed.

## Follow-up: real production lab and selected upload/error/download interactions

- `lighthouse-production.yml` runs **Lighthouse 13.5.0** in GitHub-hosted Chromium against the currently deployed public `kukureku.com` pages, without creating a Vercel deployment. It records mobile-mode lab scores for performance, accessibility, best practices and SEO for homepage and Merge PDF. It does not claim CrUX field Core Web Vitals, nor does it test candidate branch code.
- `e2e/upload-recovery.e2e.mjs` checks six key PDF workflows, including a shared component handling several tools, for initial invalid-file alert visibility and valid-PDF recovery. This is a **sample** of interaction paths, not 30/30 complete conversion certifications.
- `lib/downloadFile.ts` now keeps generated Blob object URLs alive for 15 seconds so browsers that defer transfer initiation can read the data before cleanup; file content remains browser-local and each URL is revoked once after the short delay. Unit tests verify no premature revocation.
