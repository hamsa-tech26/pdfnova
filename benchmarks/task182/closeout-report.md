PR #141 final review and release preparation — 27 October 2026

Reviewed code: b70fb04d1b214d9002185350d9463b5edc32dca6.
Original UI candidate: 1bfd592617424a037d2629fe68c456efbd00c2c4.
Main/production baseline: 85880e0181ee1e7f44990225aefe8563a3ece7a7.

Completed:
- Self-review of direct tool navigation, small-screen placement, keyboard/native
  picker behavior, file-limit visibility and unchanged conversion handlers.
- Closed the confirmed readability issue: light-theme file-limit text measured
  4.44:1 and the smaller browse hint 2.39:1 against the uploader background.
  Both now measure about 6.94:1 on the default light surface. Dark-theme text
  is lighter and the decorative light hover wash is hidden in dark mode.
- Two new screenshot-based tests assert >=4.5:1 for limits/hints across the three
  tools, in light/dark themes and normal/hover states. They also assert that
  the file limits and hints remain within the 320x680 initial viewport.
  This is bounded label testing, not whole-site WCAG certification.
- The earlier seven entry/keyboard regressions remain passing. At 390x844,
  all three pickers remain at y=479; direct home Merge remains at y=371.5.
  All target actions fit initial 320, 390, 768 and 1440px viewports.
- Hosted Validate and Browser Reliability logs were checked against the new
  exact head. The optional dependency probe is skipped, not counted as a pass.
- Three independent manual synthetic downloads still pass MuPDF checks for
  merge order, native text under Low compression and image/page counts.
- The existing three-tool traffic baseline was frozen privately with native
  Vercel query-window rounding and missing custom-event data explicitly marked.
  No private account traffic numbers are included in this public evidence.
- A concrete release, post-release smoke, measurement and rollback checklist
  is supplied alongside this report. No release operation has been performed.

Final validation:
- 714 unit tests / 139 files PASS.
- 145 explicit OCR/Phase 10.14 tests / 34 files PASS.
- TypeScript, Next.js 16.4.2 production build PASS; lint 0 errors / 25 existing
  warnings. Registry 31/31, complete output evidence and synthetic golden PASS.
- Complete local production-build browser suite: 99/99 PASS, zero retries.
- Hosted exact-head Validate: https://github.com/hamsa-tech26/pdfnova/actions/runs/40445347713
- Hosted exact-head Browser Reliability: https://github.com/hamsa-tech26/pdfnova/actions/runs/40445347785
- CI logs contain the exact candidate checkout and final counts; the hosted
  suite uses the installed Playwright-pinned Chromium. Physical-phone testing
  and field Core Web Vitals remain outside this evidence.

Earlier review-harness failures are retained in the archive: the PNG decoder's
CommonJS default export initially needed correction, and the Next development
launcher overlapped a screenshot corner on one light-theme route. The screenshot
sampler now hides only Next's test-environment portal during capture. Application
labels/backgrounds and all contrast thresholds remain unchanged by that test
style; the final suite also runs on a production build without that launcher.

Release status and limitations:
- PR remains a draft; no external review submission/approval is implied by the
  self-review. No unresolved review comments were present at inspection.
- The initial no-merge/no-deployment restriction remains active. Explicit owner
  release authorization is still required; general task completion is not a
  reason to trigger main's Git deployment integration.
- Search Console is not connected. Search queries, impressions and indexing
  cannot be certified from Vercel referral counts or search-result snippets.
  An owner-authorized read-only connection or Performance export is required.
- Post-release measurements have not started because no release occurred.
  No traffic, ranking or conversion uplift is claimed. A free, privacy-reviewed
  outcome collector remains a separate decision; no paid tracking was enabled.
- The four real PDF-to-Excel refusals and independently reviewed complete-cell
  qualification remain unresolved, separate from this UI review. Engine V4
  Stable remains unverified; no safety/detection gates were weakened.
- Both code/evidence branches remain deployment-disabled. No merge, preview or
  production deployment, paid service, Android/Smart Scanner engineering or
  historical PR closure was performed.

See release-checklist.md for the remaining owner/account-dependent steps.
