# Target 210 — public tool discovery and practical guide

Baseline: Release 209 `cac219aadff2110ac2549820329149b222dc7172`.

## Delivered scope

- Homepage all-tool section now has an accessible local text search, five category filters, result counts, a clear action, and honest zero-result messaging. Search terms are evaluated only in browser memory; no search API, analytics events, documents, or persistent query store were added.
- All 31 registered tool links are present in the server-rendered HTML when no filter is applied, preserving ordinary crawlable hyperlinks.
- Added an original guide on merging PDFs without uploading them, with actual intake limits (20 files, 25 MB per file, 100 MB combined), ordering, review and signature warnings, and a direct tool link.
- Added the guide to the guides index and sitemap. No new Search Console indexing, ranking, visits, or revenue are claimed.
- Disabled automatic Vercel deployment for this feature branch. No changes to PDF engines, payments, document uploads, persistence, or V4 certification.

## Local checks (2026-11-06)

| Check | Result |
| --- | --- |
| `npm ci` | PASS, 447 packages |
| New tool finder tests | 7/7 PASS |
| Unit suite | 727/727 PASS (140 files) |
| Explicit OCR suite | 145/145 PASS |
| Full tool registry | 31 registered tools PASS |
| Next.js production build | 68/68 static routes PASS |
| TypeScript | PASS |
| ESLint | 0 errors, 25 existing warnings; no new warnings in changed files |
| Full dependency audit (moderate threshold) | 0 vulnerabilities |
| Generated homepage static markup | 31 tool card links present; finder label present |
| Generated guides index | New merge guide linked |

## Release checks

- New browser tests cover desktop search, category/empty/reset behavior, 320 px mobile search and overflow, and canonical metadata. They must pass in the exact-head GitHub browser workflow before a merge.
- Validate full CI on the exact PR commit; preserve Release 209 READY for rollback.
- After a production deploy, verify new guide, sitemap, finder HTML, existing monitoring and runtime error logs.

## Limits

- Filtering is a tool-navigation aid, not a natural-language AI assistant. It cannot recognize every query. An empty result is not evidence a requested document conversion is supported.
- Server-side rendering and metadata alone do not guarantee search indexing or traffic. Search Console performance needs separate authorized access to report measured growth.
- Engine V4 real-document acceptance and PDF-to-Excel R&D remain unchanged and deferred for a separate review.
