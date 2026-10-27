# Mobile entry to PDF tools

Base: main / production revision `85880e0181ee1e7f44990225aefe8563a3ece7a7`.
This draft is independent of the redaction and Excel drafts.

The audited mobile pages put file selection below the first screen. At 390x844,
Merge's picker began at y=1189, Compress/JPG at y=1161. The first direct Merge
link on the home page began at y=1905; the prominent action led to the dashboard.
These are local production-build browser measurements, not field analytics.

The home page now offers direct Merge, Compress and JPG-to-PDF links ahead of the
secondary dashboard/catalog actions. The shared tool header uses a compact
privacy statement below the xl breakpoint; larger desktop trust cards remain.
Decorative uploader icon/divider spacing is reduced below xl. Tool descriptions
are shorter; existing format/size/count limits, non-form merge requirements,
compression qualifications and all functional handlers remain in place.

No converter, cancellation, validation, download, storage, analytics, metadata,
robots, sitemap, dependency or security-header code is changed. Private traffic
analytics are not included in this repository. There is no paid tracking service,
new account, experiment service or conversion-uplift claim.

The new browser regressions check the user requirement independently of CSS
classes: first-screen bounds, hit-testable centers, >=44px action heights, correct
destinations and no horizontal overflow at 320x680, 390x844, 768x1024 and 1440x900.
Keyboard Enter must navigate directly to each tool and open a working file picker
with the original single/multiple selection behavior. Existing all-tool mobile,
menu/focus, theme, privacy, safety and downloaded-document checks must still pass.

Verification includes actual synthetic Merge, Low compression and JPG-to-PDF
browser downloads, independently opened with MuPDF to verify page order, native
text and embedded images respectively. A valid small PDF download does not
qualify every source document or real-device performance. Browser emulation is
not a physical iOS Safari / Android Chrome or field Core Web Vitals result.
Search Console access and a genuinely free outcome-measurement choice remain
separate work; this change does not claim a measured traffic/conversion increase.

Reproduce using the pinned package lock, unit/OCR/TypeScript/lint/build and
registry/output checks, then the complete Playwright suite. Run
`e2e/mobile-tool-entry.e2e.mjs` for the seven specific viewport/keyboard cases.
Final exact-commit receipts and screenshots are linked from the draft PR.

The branch's first pushed commit already disables its Vercel deployment in
vercel.json. No merge, preview/production deployment, paid service, Android or
Smart Scanner engineering, historical PR closure or weakening of Engine V4's
independent qualification gate is authorized by this draft.
