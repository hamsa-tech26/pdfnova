# Target 212 — Organic search discovery (2026-11-06)

## Observed baseline, not an API export

Evidence: owner-supplied Google Search Console screenshots on 2026-11-06.

- Property: `https://kukureku.com` (do not combine with MakerQuote's separate search property).
- Page indexing report last updated **2026-10-23**: **9 indexed**, **44 not indexed**, of which **34** are *Discovered – currently not indexed*.
- All 34 example URLs in that discovery category displayed **Last crawled: N/A**. They include `/merge-pdf`, `/compress-pdf`, and `/pdf-to-word`.
- `https://kukureku.com/merge-pdf` was not indexed in the cached URL Inspection report; the 2026-11-06 live test said **URL is available to Google**, indexable, with one valid Breadcrumb item. The owner submitted a single indexing request, which was accepted into Google's queue.
- `https://kukureku.com/sitemap.xml` was submitted 2026-10-04, last read 2026-11-05, processed successfully, with 44 discovered pages at the time. **Do not resubmit the unchanged sitemap repeatedly.**
- The other two exclusion categories shown were `noindex` and redirect. Their exact URLs and whether the exclusions are intentional were not visible; do not assume all 44 are errors.

These figures are historical GSC snapshots, not a live crawl or guarantee of present indexing. One Google indexing request is **not** confirmation of Google indexing.

## Focused changes in this release

1. Expose the high-intent **PDF to Word** workflow directly on the public homepage, and explain in the hero that it works with text-based PDFs.
2. Create a genuinely helpful **PDF to Word** guide: how to check selectable text, why scans need OCR first, conversion limitations, result verification, and how local processing works. Include links to the real tool, OCR tool, and Word to PDF.
3. Link **Merge PDF** to its existing practical guide from the live tool route, matching the Compress PDF tool-to-guide navigation.
4. Publish the guide from the public guide index, sitemap, and canonical public-route list; test that pages and links stay aligned.
5. Preserve privacy-first processing, no new analytics, no paid traffic, no synthetic backlink campaign, no indexing promises, and no changes to V4 certification evidence.

## Measurement and next decisions

| Window after production release | Check in Google Search Console | Decision |
| --- | --- | --- |
| First 7 days | Inspect `/merge-pdf`, `/compress-pdf`, `/pdf-to-word` for last crawl, live vs indexed URL status, and referring sitemap | Allow time; verify problems reported by the live test before changes |
| At 14 days | Compare discovered-not-indexed counts and exact priority-route statuses with **2026-10-23** baseline | If priority pages are still never crawled, investigate verified Googlebot access and crawl statistics; do not change metadata blindly |
| At 30 days | Compare Search performance impressions, clicks, queries, and indexed pages, **with date ranges noted** | Prioritize URLs with actual useful search exposure; identify thin/duplicated pages by evidence |

Success is an increase in independently observed **Google crawls, indexed priority URLs, relevant impressions, and useful visits**, not a code test result. Technical readiness is necessary but insufficient. Keep the original READY Vercel deployment available for rollback.

Google's published guidance: sitemaps and crawl requests help discovery but never guarantee indexing. See [Crawling/indexing FAQ](https://developers.google.com/search/help/crawling-index-faq) and [troubleshoot crawling](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors).
