# Task 217 — redaction safety integration and existing privacy verification

**Status:** Draft candidate; no production deployment, no Engine V4 certification.

## Exact integration boundary

- Baseline: Release 215 `522c75b6e74aec6ac1a82e900c49652aba442b34`.
- Forward-ported scoped lossless redaction, memory/admission budgets, cancellation, raster/object checks, and CI pilot routing from draft PR #176, originally based on Release 212.
- Added two automated mobile redaction download journeys at 320 and 390 CSS pixels.
- Disabled Vercel deployments for `integration/task217-redaction-review` pending a reviewed release decision.
- Did **not** integrate paused Release 216 Google Search Console OAuth or the separate PDF-to-Excel research stack.

## Evidence on this local integration tree

| Check | Result | Scope |
| --- | --- | --- |
| Vitest | **756/756 PASS** across 145 files | Synthetic/unit |
| TypeScript | **PASS** | `tsc --noEmit` |
| Production build | **PASS** | Next.js 16.4.2; 69 statically generated routes |
| ESLint | **PASS** | Zero errors, 25 pre-existing warnings |
| Tool registry | **PASS** | 31 live tools synchronized |
| Output evidence audit | **PASS / scoped** | 14 PASS, 17 PASS_WITH_WARNING, zero FAILED |
| Synthetic golden sources | **3/3 PASS** | Real-world OCR unmeasured |
| Redaction and saved-file deletion Playwright | **8/8 PASS** | Two mobile sizes; actual downloaded PDFs; synthetic sources |
| Mobile entry and independent retention surfaces Playwright | **10/10 PASS** | 320, 390, 768, 1440px; synthetic sources |
| Independent raster reader | **PASS** | 1,117,100 compared pixels, zero mismatches on six synthetic pages; zero non-black pixels inside chosen masks |

The redaction checks inspect downloaded output, not just UI success. They include removed source text/object/attachment markers, cancellation withholding a download, source-image size refusal, fractional black-mask boundaries, crop/rotation/UserUnit handling and preservation of untouched raster pixels. The saved-PDF deletion check confirms cancel, permanent local removal after reload and explicit backup restore. These checks cover only the tested fixtures, not arbitrary sensitive PDFs.

## Deliberate unresolved gates

1. **Hosted exact-commit CI** must be green before any merge decision. Earlier checks on PR #176 and its ancestors cannot validate this integration commit.
2. **Public original-PDF pilot** is not credited locally because the source-pinned USGS subset and metadata are absent. It must run against the approved exact-hash source in a controlled CI environment and include independent pixel/object checks.
3. **Device/privacy assurance** is limited to headless Chromium and synthetic input. No independent forensic/security review or physical phone/screen-reader certification is claimed; test the lossless PNG memory limits on bounded mobile devices before deployment.
4. **PDF-to-Excel** research PR #152 remains separate and held at its existing fail-closed review gates. No general automatic real-table accuracy is certified; earlier published-source diagnostics found four unresolved export refusals.
5. **Engine V4 Stable** is **BLOCKED**. `npm run qualify:v4:stable` reports 0/20 independently accepted distinct PDF hashes and missing accuracy, OCR, blind-review and stress evidence. Synthetic tests do not count toward this gate.
6. **Release 216** remains paused. No OAuth scopes, credentials, billing, or production resources were changed by this task.

## Release disposition

**DRAFT / NO DEPLOY** until an exact-tree hosted CI receipt, source-pinned public pilot, production dependency/security review, current production/rollback verification, and explicit single-commit release decision are recorded. Preserve the current Release 215 READY deployment and separate Release 214 rollback.
