# Task 219 — Local English OCR provenance and bandwidth release review

**Status: engineering evidence; NOT legal sign-off, NOT production authorization.**
Source candidate: PR #181, \`14d70d568b6bc651b8cc7e3fea8455588581f711\`.

## Exact source trace
- English trained-data package \`@tesseract.js-data/eng@1.0.0\` metadata says MIT; its default English model is byte-matched to \`naptha/tessdata\`, branch \`gh-pages\`, \`4.0.0_best_int/eng.traineddata.gz\`.
- Upstream model Git blob: \`730a6a59010b9440e38dd85f9fe6b6bf0637e6eb\`.
- Model SHA-256: \`45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91\` (already checked before build).
- Upstream \`naptha/tessdata\` repository root \`LICENSE\`: Apache License 2.0, Git blob \`261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64\`. No root \`NOTICE\` file was found in the audited \`gh-pages\` snapshot. A new build-time Git-blob SHA-1 check rejects changed vendored license text.
- Upstream \`README.md\` expressly describes self-hosting the language data. This does not solve every licensing question: npm package metadata and upstream content licensing remain inconsistent.

## Release checklist (all mandatory)
1. Validate model and license byte provenance and include Apache-2.0 license alongside trained data. Review any notices accompanying the particular Tesseract packages and their dependencies.
2. Review the MIT/npm versus Apache/upstream discrepancy as a human licensing decision. No automatic claim of legal clearance.
3. Confirm all eleven assets resolve on the same origin; no user document leaves the browser during optional OCR; refuse unknown external fetches.
4. Keep selectable OCR suggestions tentative/editable with explicit review before XLSX export.
5. Run exact-commit full Unit, browser, XLSX, OCR, build, TypeScript, audit and asset tests on the final integration tree.
6. Review actual project usage/billing plan and resource caps before release. Do not buy/upgrade services silently. The 25 MiB build guard is NOT a monthly CDN quota.
7. Preserve production rollback and record exact deployed SHA. Do not treat Engine V4 as Stable while 0/20 independently reviewed originals are accepted.

## Bounded transfer projection (not live usage)
Eleven locally staged OCR worker, WASM and English language/notice files total **22.29 MiB** in the documented candidate. A *worst-case complete transfer per first-time visitor* gives approximately 4,593 full-bundle deliveries for 100 GiB transfer, or about 4,486 if the platform counts 100 decimal GB. Actual transfer can be much lower (browser chooses just one WASM variant, conditional OCR, caching) or include other website traffic. No claim about the actual plan or current quota utilization.

## Public-source references
- https://github.com/naptha/tessdata/blob/gh-pages/README.md
- https://github.com/naptha/tessdata/blob/gh-pages/LICENSE
- https://apache.org/licenses/LICENSE-2.0.html
- https://vercel.com/docs/manage-cdn-usage
- https://vercel.com/docs/plans/hobby

**Disposition:** Keep PR #181 in draft until the discrepancy, current plan/usage, and final exact-commit technical acceptance have been reviewed. No new third-party services, production changes, billing, or user-data uploads.
