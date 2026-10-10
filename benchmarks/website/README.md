# Website Quality V2: evidence, not assumptions

The existing GitHub checks validate the Next.js application and full browser PDF-tool workflows.

- **Independent public reachability:** \`scripts/auditPublicHttp.mjs\` requests the canonical homepage, robots.txt, and sitemap.xml with no credentials, screenshots, or document data. A 402 is **ACCESS_NOT_VERIFIED**, even if Vercel reports READY. Run via \`node scripts/auditPublicHttp.mjs\`. The workflow is intentionally advisory so platform billing failures do not misrepresent source-code quality.
- **All 30 tool-route mobile coverage:** \`e2e/website-quality.e2e.mjs\` opens every registry tool route at a 375px mobile viewport and asserts a successful HTTP response, heading, and accessible workspace menu. These are smoke checks, **not PDF conversion accuracy tests**.
- **Mobile loading baseline:** same suite records five-page DOMContentLoaded, First Contentful Paint, loaded script bytes, and scroll width. GitHub CI runs a Next.js **development server**. These timings must not be represented as real-user Core Web Vitals, production Lighthouse results, or proof of no layout shift.
- **Privacy:** Generated diagnostic metadata contains no PDFs, uploaded document content, account credentials or user-specific activity; it is stored under the ignored \`benchmarks/website/reports/\` directory.

The current domain reportedly returns HTTP 402 to independent external requests despite being READY in Vercel and DNS correctly configured. Treat that as an external-access blocker until independently confirmed otherwise. Do not spend limited deployment quota attempting to fix HTTP 402 with unrelated UI code.

## Release boundaries

This batch originates from live Release 38 and does not merge or certify the separate Release 37 PDF Engine V4 Stable qualification. Do not deploy this branch until all hard CI checks pass, and until external availability has been diagnosed.
