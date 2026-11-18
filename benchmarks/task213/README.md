# Target 213 — Google Search Console read-only evidence collector

**Date:** 2026-11-06. **Status: NOT_CONNECTED.** No Google OAuth token, private Search Console metrics, or owner account authorization is available in this build. No live private Google API calls were made. This is a prepared, testable owner-side workflow, **not** a claim of successful integration.

## Why this target follows Release 212

The owner's 2026-11-06 screenshots of the Google Search Console report updated on October 23 showed 9 indexed and 44 non-indexed pages; 34 were *Discovered – currently not indexed*. The November 5 sitemap read was successful and discovered 44 pages. The November 6 `/merge-pdf` live test showed the URL could be indexed, and Google accepted a crawl request. **Crawl requested**, **live URL indexable**, and **Google-indexed** are different states. Details and dates remain in [Target 212 baseline](../task212/search-discovery-plan.md).

Repeated SEO code edits without fresh observation could consume time without helping discovery. This target implements a small **private, read-only** measurement command without modifying public website code, changing sitemaps, or making indexing requests.

## Exactly what is collected

- Official [Search Console Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) daily web-search totals for the property and the three high-intent URLs, for a conservative finalized 28-day date window (Google uses Pacific Time). Metrics: clicks, impressions, computed CTR, impression-weighted average position.
- Official [URL Inspection indexed-version API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect) verdict, coverage state, last crawl timestamp (if provided), fetch state, and indexing state for `/merge-pdf`, `/compress-pdf`, `/pdf-to-word`.
- Comparison between two owner-side snapshots with equal day counts and the same property/routes. Date windows should ideally be consecutive and non-overlapping for meaningful performance comparisons; rolling windows have shared days and may dampen changes.

The collector does **not** retrieve the entire Page Indexing report, all 44 discovered sitemap URLs, every search query, Google's live URL test, indexing requests, or the owner's documents. Missing rows do **not** imply zero traffic or zero indexed URLs. Data may be delayed or incomplete. The original 9/44/34 screenshot baseline cannot be numerically compared to API results as though identical measures.

## Owner-only setup, once Google authorization is available

1. The Google Search Console property owner must authorize the narrow `https://www.googleapis.com/auth/webmasters.readonly` OAuth scope through the official Google OAuth process. The project must have the Search Console API enabled in Google Cloud if a new OAuth client is used. [Google authorization reference](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).
2. Keep the short-lived OAuth access token **on the owner's computer or an approved private automation environment**. Never send it in a chat, commit it, place it in a URL or HTML bundle, or save it in Vercel's public deployment.
3. Run `node scripts/gscReadOnlySnapshot.mjs` without a token to confirm the expected `NOT_CONNECTED` response and zero Google API calls.
4. After Google OAuth setup, supply the token only through the temporary local environment variable `GSC_ACCESS_TOKEN`. Run `node scripts/gscReadOnlySnapshot.mjs`. The script writes a JSON snapshot under `.local/gsc/` with restricted permissions and the directory is ignored by Git. It does not save the access token.
5. At a future comparable measurement date, run `node scripts/gscReadOnlySnapshot.mjs --compare .local/gsc/<previous-snapshot>.json` with a fresh valid token. Review comparisons separately from the older screenshot baseline and always inspect Google Search Console directly when findings conflict.

> **Security note:** The access token may expire; account owner authentication and any OAuth consent must happen outside this collector. Do not request or paste the token into ChatGPT. The program has no OAuth login flow and does not automatically schedule authenticated jobs. Any future scheduled run requires a separately approved secure credential lifecycle.

## Decision gates

| Evidence | Next action |
| --- | --- |
| No authorized token | `NOT_CONNECTED`; do not invent metrics, contact Google, or change SEO metadata |
| Authorized API result but no Search Analytics rows | Record `NO_ROWS_RETURNED`; check date range and Search Console manually before interpreting |
| Google inspected-version verdict still not indexed | Read exact coverage state and last crawl date; cross-check manual URL Inspection and server logs before remediation |
| Priority URL indexed and receiving relevant impressions | Keep monitoring clicks and users' real search intent; optimize content only against observed need |
| Repeated 401 / 403 / 429 | Stop; resolve the access permission or quota through Google, without retry storms |

No production deployment, costs, new analytics beacon, customer-file processing, or Engine V4 certification changes are required for this target.
