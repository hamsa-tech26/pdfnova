# Task 261 — mobile-width WebKit page-output acceptance

**DRAFT / NO MERGE / NO DEPLOY**. This is an additional independent test in already consolidated QA PR #215, not a product feature or automatic release.

The independent Task 245 source PR #208 has one passing exact-head Linux WebKit downloaded-PDF test. Its source workflow originally targeted only the older integration PR #207 branch, not `main`. This integration copies its exact Playwright WebKit/mobile-width config (390×844) and updates the workflow target to `main` so the suite is exercised by future review PRs.

Run same existing independent-PyMuPDF source-output fixture over **Merge, Split, Extract, Delete, Rotate, Organize** in Linux Playwright WebKit. No customer PDFs uploaded; all fixtures synthetic, downloaded bytes inspected using independent reader. This is simulated iOS-like WebKit at mobile width, **not a physical iPhone/iOS acceptance test**.

Require **all 14 substantive exact-head workflows** (13 prior QA/security and the new WebKit page-integrity workflow) before calling the combined draft verified. The runtime remains unchanged and source PDFs never leave the browser outside synthetic test runners. Do not merge, deploy, change paid plans or resume Release 216; formal Engine V4 Stable remains 0/20.
