# Task 141 — source-pinned browser qualification of four guarded XLSX paths

## Scope and baseline

This is a **review-only, stacked test draft** on Task 140 (`3419b1a26f8b90a9d32084007453022722c373fc`). No conversion logic, detector/OCR thresholds, production dependencies, security headers or permission flows change. The four guarded recoveries remain opt-in and source-review-only. **No merge, preview or production deployment is authorized.**

Task 141 tests real published PDFs through the browser file picker, inspect/selection/acknowledgement UI and an actual XLSX download. The downloaded bytes are opened independently using Python `openpyxl`, with cell-level assertions on source anchors, dimensions, empty positions, review notices and absence of executable formulas.

| Public reference | SHA-256 (locally checked) | Browser result | Workbook-specific assertions |
| --- | --- | --- | --- |
| Invoice, `jsvine/pdfplumber` `tests/pdfs/issue-140-example.pdf` | `0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b` | PASS | 5×9; four zero-prefixed UPCs, header order, unobserved outer slots |
| USDA energy round-up, `jsvine/pdfplumber` `examples/pdfs/ag-energy-round-up-2017-02-24.pdf` | `4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb` | PASS | 42×5; first and last source rows; chart tick not leaked; malformed 1×8 choice disabled |
| FBI NICS, `jsvine/pdfplumber` `examples/pdfs/background-checks.pdf` | `4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407` | PASS | 58×25; Alabama, California, Totals; missing Rentals positions unfilled |
| NREL fuel savings, `camelot-dev/camelot` `tests/files/foo.pdf` | `7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82` | PASS | 7×7; parent heading, paired subheadings, first and last records; malformed 6×7 choice disabled |

Each path confirmed **no download during inspection**, export disabled before explicit source-review acknowledgement, an enabled reviewed candidate, one actual `.xlsx` download, review notes in a separate sheet, and no formula cells. The dedicated runner sets `KUKUREKU_TASK141_REQUIRE_REFERENCES=1`: missing file environment variables fail test collection instead of converting qualification into four skips. The test also validates each original SHA-256 before upload.

## Exact local verification on the Task 140 code baseline plus Task 141 harness

- Next.js **16.4.2** webpack production build: **PASS**, TypeScript included; Next.js staged ten local English OCR runtime assets. During local build only, a test-only Next.js mocked Google Fonts response was used because the execution network could not fetch `fonts.gstatic.com`. The font mock is not imported by app code, and this run does not qualify production font delivery.
- Chromium **141.0.7390.37**, Playwright **1.56.1**, strict real-reference browser suite: **4/4 PASS**, zero retries; real downloaded workbooks parsed by `openpyxl 3.1.5`. One `openpyxl` warning about a workbook without a default style was observed, without parse failure.
- Full Vitest: **733 passed, 8 skipped** across 146 passing files and one skipped file. Reference opt-in tests skipped when their own environment paths were unset in this *separate* unit invocation; do not represent them as an independently passed reference corpus.
- `npx tsc --noEmit`: **PASS**. `npm run lint`: **0 errors / 25 existing warnings**.
- 31/31 live tool registry: **PASS**. Synthetic golden: **3/3 PASS** (no real-world documents evaluated). Tool output evidence: **14 PASS / 17 PASS_WITH_WARNING**.
- Full `npm audit --audit-level=moderate`: **zero reported vulnerabilities** at test time.

## Reproduction

1. Start from the Task 140 draft head and run `npm ci --no-audit --no-fund` and `npm install --no-save @playwright/test@1.56.1`.
2. Download only the four published PDFs at the commits pinned in Tasks 137–140, outside Git. Set `KUKUREKU_INVOICE_REFERENCE_PATH`, `KUKUREKU_USDA_REFERENCE_PATH`, `KUKUREKU_FBI_REFERENCE_PATH`, `KUKUREKU_NREL_REFERENCE_PATH` to their absolute local paths. Verify the four SHA-256 values above.
3. On networks with Google Font access, use `npm run build -- --webpack`. On restricted test machines only, supply `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<absolute path to e2e/task141-offline-fonts.cjs>` to the build. The mock is not part of normal production startup.
4. Set `KUKUREKU_TASK141_REQUIRE_REFERENCES=1`; run `npx playwright test --config=playwright.task141.config.mjs`. This starts **only a local** `next start` process against the built app.

## Remaining independent acceptance gates

- The four checks are **source-specific smoke tests**, not a general-PDF accuracy claim. Source text is cross-checked independently in the opt-in lower-level tests from Tasks 137–140, but this suite does not perform a new blinded, human-created full-grid transcription.
- Historical malformed table candidates remain refused; unattended XLSX for these four published PDFs remains unavailable by design.
- Engine V4 Stable remains **0/20 independently accepted reference documents**; source-specific browser PASS does **not** advance this count.
- Independently agreed reference spreadsheets, blinded reviewer reconciliation, held-out multilingual/scanned/OCR tests, mobile physical devices, CDN/font delivery and production release acceptance remain **NOT VERIFIED**.
- The branch is excluded from automatic Vercel deployment in the same initial candidate tree. No repository merge, Vercel quota, billing or historical PR cleanup was performed.
