# Task 252 — Combined QA and Release 216 readiness

Date: 2026-11-15. **DRAFT / NO MERGE / NO DEPLOY.** Production source SHA: `4d41cdf36c2319f59ec8b5c35d4a999799010802`.

## Integration scope
Combines QA-only cases from PRs #207, #212, #213 and #214. No app/library/runtime changes. Inputs are fictional synthetic PDFs/images; assertions parse actual downloaded PDF, DOCX, TXT and JPEG ZIP files independently instead of relying on success messages. Project preview and automatic builds are on hold and this branch is excluded in `vercel.json`.

### Required exact-head workflows
- Validate; Browser Reliability Smoke.
- Production Live PDF-to-Excel Acceptance.
- Production PDF Page Integrity Acceptance: merge, split, extract, delete, rotate, organize.
- Production PDF Content Integrity Acceptance: compress and remove/edit metadata.
- Production Image Conversion Output Acceptance: PNG to PDF, PDF to JPG ZIP.
- Production Watermark PDF Output Acceptance; Production Visual Signature Output Acceptance.
- Production WebKit PDF Visual Outputs Acceptance.
- Production PDF Crop and Resize Output Acceptance.
- Production PDF Page Decorations Output Acceptance.

The source PRs passed their individual CI. **Run all checks again on the combined head**, and block integration if any fails. Do not weaken assertions.

## Unresolved release gates
- **Cost:** Vercel team billing is nonzero. Verified period 2026-11-14T08:00Z to 2026-11-15T08:00Z reported billed US$0.770615664119, including US$0.666666666667 team Pro allocation and US$0.084 build CPU minutes. This does **not** prove a payable invoice or charges solely attributable to Kukureku. Invoice, credits and caps still need review. Skipped builds may count against Vercel quotas.
- **Engine V4:** Formal acceptance remains BLOCKED **0/20** independently reviewed real original PDFs. PRs #199 (public USGS pilot) and #202 (PubTables diagnostic) passed their scoped workflows but source-image geometry and independent cell/page rights evidence are not fully established. Never credit synthetic/developer tests toward the 20.
- **Mobile:** WebKit Chromium test suites are not physical iPhone/Android certification.
- **Privacy/security:** Do not upload customer PDFs to CI; preserve redaction independent-reader checks and browser-local retention disclosure. No forensic/identity claims.
- **Google Search:** Search Console indexing/traffic metrics are unverified, even if sitemap checks pass.
- **Release 216:** Still PAUSED. No merge, resume, production deployment or automatic build reenable until financial review, exact-head CI and explicit release decision.

Production READY deployment `4d41cdf36c2319f59ec8b5c35d4a999799010802` is retained. This branch contains only source tests, CI workflows, configs, `vercel.json` QA branch disablement and this memo.
