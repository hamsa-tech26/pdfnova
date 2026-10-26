# Task 137 — Guarded recovery of public rotated invoice (draft, undeployed)

## Pinned source

- Upstream: jsvine/pdfplumber, tests/pdfs/issue-140-example.pdf, commit 4c64b92d5caccd71c645e98e0fabb0c4dba7ff45, upstream [issue #140](https://github.com/jsvine/pdfplumber/issues/140).
- SHA-256: 0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b.
- One page with 90-degree rotation; PDF.js exposes vertical word columns in unrotated coordinates. Existing generic detector did not reconstruct this table.
- Task 137 is stacked on draft Task 136. The branch's first commit includes an explicit Vercel auto-deployment disable rule.

## Observed recovery

| Check | Result |
| --- | --- |
| Table structure | 9 headers + 4 original physical rows, 9 logical columns |
| Original source cells | 37/37 preserved: 9 header, 28 body |
| Unobserved positions | 8 (outer body columns); these are NOT confirmed blank PDF cells |
| Source provenance | Original native PDF word positions retained |
| Data values | Four 13-digit UPCs with leading zero, four item descriptions, four accrued amounts |
| Excluded sections | Associated claims, Supporting documents, Approval history |
| Automatic conversion | Withheld; source-position recovery requires explicit source review |
| Reviewed workbook | Generated; independent openpyxl reader confirmed 5 x 9, UPCs, amounts, eight unobserved positions, literal cells, review notes and no Excel formulas |

The new detector only accepts an exact nine-header 90-degree rotated native-source grid, four unambiguous seven-cell rows, and validated coordinates/provenance. Synthetic negative tests refuse wrong rotation, missing/extra/duplicate cells, shifted fields, OCR data, duplicate headers and unexpected field contents. No generic table score threshold was relaxed. This is one source-guarded case, not a general invoice parser.

## Verification

- Full Vitest: **726 passed / 5 skipped**; targeted real-source test **3/3 passed** with independent openpyxl reading afterward.
- TypeScript: pass. ESLint: zero errors, **25 existing warnings**.
- Production Next.js build: pass. Registry: **31/31**.
- Golden synthetic checks: **3/3 passed**; no independently accepted real gold document.
- Output evidence: **14 PASS / 17 PASS_WITH_WARNING / 0 FAILED**.
- Production npm dependency audit: **0 vulnerabilities**.
- Browser: **NOT VERIFIED**. The isolated environment lacked a matching Chromium binary, and multiple downloads produced truncated ZIP archives. The source-pinned browser test is present but must pass later; do not count it as passed.

The generic original candidate remains pending; overall analysisOutcome is **incomplete-analysis** even when this source-guarded table is reconstructed. Three other historical real-table export failures remain unresolved. The public source was known during development and is **not** independent blind adjudication. Engine V4 Stable remains **0/20**.

**Decision:** draft only. No merge, no Vercel preview/production deployment, no paid service, no Android or Smart Scanner change. Gate release on a real Chromium upload-review-download pass, accepted independent references, and review of pending detector diagnostics.
