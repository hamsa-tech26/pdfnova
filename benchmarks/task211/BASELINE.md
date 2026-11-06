# Target 211 — measured growth baseline and crawl readiness

Date: 2026-11-06 (IST). Baseline production release: 210
(`9ba006ba42bb5e9eb6fc41f226cb1aa32568b601`).

## Aggregated Vercel Web Analytics (production only)

An authenticated, read-only Vercel analytics baseline was reviewed with the
site owner on 2026-11-06. **Counts are intentionally not included in this
public repository.** Keep subsequent traffic measurements in a private
owner-controlled report, using fixed and comparable UTC periods.

Neither page views nor reported visitor counts prove that a PDF operation
completed. Analytics filters are not an authoritative Google Search Console
click or indexing report; counts can be affected by client-side blocking.
There is not enough evidence to attribute growth to Release 210.

## Public crawl readiness

- The separate IndexNow route list had omitted the new
  `/guides/merge-pdf-without-uploading` route even though it was already in
  the public sitemap. Target 211 synchronizes these.
- A fresh, public, read-only inspection after that correction tested 45/45
  public HTML routes: each had a descriptive title and description, one H1,
  self-canonical, no `noindex` directive, and a matching sitemap entry.
- Robots, sitemap route parity, 31 homepage tool links and six guides-index
  links passed. The live inspection does not upload any PDFs or track users.
- External search results can serve older cached page descriptions; that alone
  does not prove an indexing fault or a particular Google indexing status.

## Google Search Console: explicitly not verified

We did not access authenticated Google Search Console impressions, clicks,
average position, query/page breakdown or Indexing report. Public site queries
and other search engines are not a substitute. Do not claim "indexed" or "SEO
growth" from these route checks.

For a subsequent measurement phase, compare two non-overlapping seven-day
periods on the same UTC boundaries. If account access is later approved,
capture aggregate Search Console clicks, impressions, query and landing-page
counts to establish search discoverability without collecting PDF content.

## Safety and maintenance

- New weekly GitHub Actions technical-readiness checks use public HTML only.
- They record route names and public metadata, retain seven days of report
  artifacts, fail on detected technical regressions, and do not auto-fix or
  deploy.
- No new tracking events, cookies, third-party APIs, cost-bearing services,
  user file uploads, or payment changes were introduced.
- Engine V4 independent document certification and PDF-to-Excel research remain
  deferred and are not certified by these results.

References:
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://support.google.com/webmasters/answer/7576553/performance-report-search
