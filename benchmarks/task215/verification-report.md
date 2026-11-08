# Release 215 — Search crawler directive and sitemap integrity guard

Date: 2026-11-08 (IST). Audited production baseline: Release 214,
`82e3c54664fc448acf8bc38ff1fff2bd91dae57d`.

## Verified public baseline

An authenticated Vercel read-only fetch checked all 46 production sitemap
URLs at `https://kukureku.com` after Release 214. **46/46 passed** the
public HTML checks: HTTP 200, expected Release 214 deployment, self-canonical
URL, descriptive title and meta description, one H1, and no generic HTML
`noindex` directive. The root sitemap and robots endpoints also returned 200.

This is technical crawl *readiness*, **not proof of Google indexing**. Google
Search Console's authenticated indexing and performance reports were not
available during this check. Do not infer indexed pages, rankings, clicks,
impressions, or traffic growth from a public HTML fetch.

## Guard improvements

- Read-only search audit now checks both `robots` and `googlebot` meta tags,
  including tags placed outside `<head>`.
- Checks `X-Robots-Tag` response headers for `noindex` restrictions.
- Fails readiness if the XML sitemap repeats any `<loc>` URL, even when all
  expected unique routes are still present.
- Added three regression tests that prove these cases fail the audit.

All checks continue to use public route URLs only. No customer documents,
cookies, credentials, query parameters, third-party tracking, or paid API
services are introduced. The existing scheduled GitHub Actions search-readiness
watch will use the strengthened audit after merge.

## Local verification

- Targeted search-readiness tests: 10/10 PASS.
- Full unit suite: 142 files, **740/740 PASS**.
- `npm run check:tools`: 31 synchronized tool routes PASS.
- Next.js 16.4.2 production build: PASS, TypeScript PASS, 69 static routes.
- ESLint on changed scripts: PASS; repository lint: 0 errors, 25 existing
  warnings in unrelated files.
- `git diff --check`: PASS.

## Outstanding prerequisite

Authenticated Google Search Console OAuth approval and retrieval of actual
indexing/performance data remain blocked until the owner resumes the browser
authorization workflow on a laptop. Do not mark this phase complete on the
basis of public HTML evidence alone.

References:

- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
