# Task 206 — ten-priority user-journey improvement batch

Base: Release 195 `1b25dc6fe74c9ba0bac1b337e0e46b9254aba241`.

This is a **deploy-disabled draft**. It does not modify PDF engines,
algorithmic thresholds, user-file storage, encryption, billing, or the separate
PDF-to-Excel research branch. Real-document qualification is deferred.

## Prioritized delivery and evidence boundaries

| Priority | User-facing goal | Exact scope in this draft | Status before exact-head CI |
| --- | --- | --- | --- |
| 1 | First-use clarity | Six task-first choices, direct routes, clear guidance link | Implemented; browser pending |
| 2 | Mobile usability | Preserve three above-the-fold buttons; responsive chooser; accessible file-input descriptions | Implemented; browser pending |
| 3 | Responsiveness | Remove large non-live AI marketing section from homepage; keep new chooser server-rendered, no client JS | Implemented; INP/LCP impact **NOT MEASURED** |
| 4 | Download confidence | Completion card reminds users to inspect output; offers next tool | Implemented; browser pending |
| 5 | Multi-step workflows | Link directly to the already-existing guided workflow recipes | Implemented; no new processing engine |
| 6 | Failure recovery | Explain format, size and password checks with help-guide link | Implemented; browser pending |
| 7 | Accessibility | Skip link, reduced-motion styles, file-input aria descriptions, keyboard regression | Implemented; physical screen-reader **NOT_RUN** |
| 8 | Security and privacy | Retain the existing live HTTP header / document-network checks and source privacy guards | Existing safeguards retained; no new certification |
| 9 | Useful search content | Original tool-choice guide, canonical URL, sitemap and IndexNow route registry | Implemented; indexing/ranking **NOT_VERIFIED** |
| 10 | Growth measurement | Reuse already-disclosed Vercel Analytics page views, define next metrics; **no new tracking** | Baseline plan only; dashboard metrics not accessible here |

## Readiness tests

- `node scripts/checkToolRegistry.mjs` checks all **31 registered tools**.
- Full unit test baseline: **715 tests PASS**; TypeScript and ESLint
  `--quiet` PASS (0 lint errors).
- OCR/Phase 10.14 regressions: **145/145 PASS** (34 test files).
- Next.js 16.4.2 production build: **PASS**, 67/67 static routes generated,
  including `/guides/choose-pdf-tool`.
- Added eight synthetic browser checks: responsive 320/390/768/1440 px,
  keyboard skip link, mobile navigation/guide, actual merge-and-download of two
  in-memory synthetic PDFs, and upload input descriptions.
- Local browser execution is **BLOCKED** because the executor has no Chromium
  binary. Only the exact-head GitHub Browser Reliability workflow may qualify
  these tests as passing; a failure to launch is not a pass.

## Next measurements without tracking document contents

1. Inspect aggregated page views of homepage, task-choice routes, and existing
   guides using already-disclosed Vercel Analytics. No filenames, PDF bytes,
   extracted text, passwords, or per-user document details should enter metrics.
2. Use Google Search Console to record impressions, clicks and indexed status
   for the new helpful guide after deployment. Sitemap inclusion is only a
   discovery hint, not proof of indexing.
3. Measure mobile field performance using PageSpeed Insights / CrUX where data
   exists. Until observed, do not claim an INP or LCP improvement.
4. If funnel-level conversion counts are later desired, design and privacy-
   review aggregate event collection separately before writing telemetry.

**Not accepted by this batch:** original-file per-tool accuracy, 0/20 Engine V4
Stable gate, real-device/screen-reader results, external security accreditation,
SEO ranking, and uncertain PDF-to-Excel R&D. PR #168/#169 and research #152 are
independent; do not merge them as a side effect.
