# Task 146 — Fresh Chromium real-PDF review-only XLSX replay

**Date:** 2026-10-27 Asia/Kolkata  
**Decision:** 4/4 **PASS** for the bounded four-source browser regression on the Task 145 patched code. This is **NOT** Engine V4 Stable certification or production release approval.  
**Published source candidate:** Task 145 draft branch `fix/task145-source-review-marker-consistency`, code commit `9869ed716ba775466336ded441934bdd0ae2eed3`, stacked on Task 144 `0f0328348886a5fe485fd58ea1be66583dcd15b8`.

## Reproducible local environment

- Node `v24.22.1`; Next.js `16.4.2`; Playwright `1.56.1`; Chromium Headless Shell `141.0.7390.37` (build `1194`); independent Python `openpyxl` reader.
- A free official Playwright-pinned Chromium headless shell (104.3 MiB) and ffmpeg (2.3 MiB) were downloaded into the task-specific **temporary** directory `/tmp/kukureku-task146-browsers`. The primary CDN response was a truncated ZIP, but the built-in Microsoft mirror fallback completed normally. No paid service or deployment was used.
- The already verified local production build was used. The test runner automatically started `next start` on `127.0.0.1:3000` and shut it down on completion; no public browser preview was created.
- SHA-256 checks confirmed all four small public original PDFs exactly match the official GitHub fixtures pinned in Task 141. PDFs resided only under a separate temporary directory, were passed as local browser file-picker buffers and were **not** committed or sent to Kukureku production.
- Remote GitHub source-file contents at the Task 145 exact code commit matched all three locally tested changed source files byte-for-byte; the Task 141 test and Playwright configuration files also matched the earlier published exact commit.

## Four original-document browser results

| Pinned original document | SHA-256 | Exact selected grid | Browser result |
| --- | --- | --- | --- |
| pdfplumber `issue-140-example.pdf` | `0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b` | 5 × 9 rotated invoice | **PASS** |
| pdfplumber `ag-energy-round-up-2017-02-24.pdf` | `4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb` | 42 × 5 left report table | **PASS** |
| pdfplumber `background-checks.pdf` | `4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407` | 58 × 25 FBI table | **PASS** |
| camelot `foo.pdf` | `7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82` | 7 × 7 NREL table | **PASS** |

Each test used actual PDF file-picker upload, table inspection and explicit selection. It verified **zero premature downloads**, that the reviewed-only export button was disabled before acknowledgement and enabled after it, then received exactly one actual `.xlsx` browser download. The Python openpyxl reader independently checked worksheet dimensions, source-anchored cell values (including leading-zero identifiers, incomplete columns, first/last records), a separate Review Notes sheet and absence of executable formula cells. The known incorrect USDA 1×8 and NREL 6×7 candidates remained disabled.

**Command:** the existing `npx playwright test --config=playwright.task141.config.mjs` with `PLAYWRIGHT_BROWSERS_PATH`, `KUKUREKU_TASK141_REQUIRE_REFERENCES=1` and four task-specific source-path environment variables. These variables are paths to public test fixture copies only; no credential or user data.

**Result:** 4 tests passed, one worker, no retries or skips, total **6.3 seconds**, exit code 0. An openpyxl warning about a workbook lacking a default style appeared, but parser/value/structure checks passed. This warning is not declared fixed.

## Boundaries preserved

- This run is a source-pinned, developer-known four-document regression, **not** independent blind ground truth on unseen PDFs.
- The Task 145 ID-only marker mismatch has separate Vitest regression coverage; these four real PDFs test their expected normal provenance paths and do not prove the mismatch can arise from a malicious arbitrary PDF.
- Full Vitest on the exact local Task 145 code previously passed **734/734** (8 skipped); TypeScript, lint (0 errors, 25 warnings) and production build passed. No code was modified during the browser replay.
- Engine V4 Stable remains **0/20** independently accepted real original PDFs. Nothing was merged, promoted, preview-deployed, paid for or published to the public site.
- Release handoff: code and source-pinned browser behavior now have a fresh local receipt. Exact hosted CI, blind independent references, and owner-approved merge/production gates remain separate decisions.
