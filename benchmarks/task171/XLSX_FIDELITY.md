# Mission 171: preserve workbook source text

The XLSX serializer changed CR and CRLF source text to LF when a separate
XML reader opened the workbook. It also silently removed XML-incompatible
control characters. Reproduction used constructed cells, not private PDFs.

## Correction

`lib/converters/pdfToXlsx.ts` emits carriage returns as XML character
references, preserving CR and CRLF independently from tabs and LF. It
withholds export with a content-free error for unsupported XML code points
or unpaired UTF-16 surrogates instead of deleting them. Ordinary Unicode,
XML-looking literal text and spreadsheet formula-like strings are retained.
Existing limits, numeric opt-in rules and source table selection are unchanged.

## Measured evidence

| Case | Before | After |
| --- | --- | --- |
| `before` + CR + `after` | Reader returns LF; exact comparison fails | Exact CR preserved |
| `before` + CRLF + `after` | Reader returns LF; exact comparison fails | Exact CRLF preserved |
| `AB` + U+0001 + `CD` | Silent `ABCD` output | Explicit export refusal |

Two unit tests cover newline fidelity and refusal of eight invalid code
points plus an invalid review note. The independent openpyxl integration in
`e2e/pdf_to_excel.e2e.mjs` compares complete constructed grids: cell positions,
typed integers, leading-zero IDs, long integers, Unicode, whitespace, blanks,
three native grouped-header merges, frozen panes and exact review-note text.
It asserts that no cell contains an executable formula.

## Verification boundary

Local tests: 139 files / 705 unit tests, 34 files / 145 explicit OCR tests,
TypeScript, ESLint (0 errors / 25 existing warnings), tool registry,
output-evidence completeness, synthetic golden invariants and six Python
corpus guardrails pass. The independent reader assertions also pass when
executed directly against the generated workbook.

The managed environment cannot reach its network proxy. Its package cache
contains an older test runtime, so these local test results are supplemental,
not exact patched-dependency build/browser/audit evidence. A local Node
subprocess limitation also prevents treating the integration preparation
harness as an actual Playwright run. Hosted CI on the exact branch must
confirm all those checks; no success is implied before its receipts exist.

The three existing workflow PR branch filters also accept the maintenance
base branch so this stacked draft receives Validate, Browser Reliability and
XLSX roundtrip checks without merging it into the maintenance candidate.
No test assertions, retries, thresholds or dependency pins are weakened.
This branch is disabled in Vercel before remote creation.

These are serializer regressions using constructed cells, not PDF-localization
or independently annotated real-document accuracy measurements. No source
PDF was acquired or distributed. Table detection and the separate research
draft remain unchanged. Engine V4 Stable remains 0/20. No merge or deployment.

## Authorized publication follow-up

The owner explicitly authorized separate draft publication on 24 October 2026.
The draft is based on the patched maintenance candidate, with the branch
deployment guard included before branch creation. Validate, Browser Reliability
and XLSX jobs explicitly check out the published head SHA. Validate also runs
a standalone TypeScript check after its production build.

The actual browser-download XLSX test now independently compares every row,
column and value of the constructed five-column source PDF, rather than only
first/last records. The separate serializer check covers exact CR/CRLF,
Unicode, numbers, blanks, merged headers and formula-like literals. Hosted
results will be recorded in the draft description after those jobs complete.

A further independent-reader check exposed nonempty tab-only parent-header
children being merged away because the heading guide normalized them to empty.
The guide now requires exactly empty destination values before enabling merges.
Whitespace, CR/LF, NBSP and DEL children remain at their original unmerged
coordinates; explicit forced merges are refused. The existing truly empty
grouped-header positive remains merged and the independent reader checks both.
