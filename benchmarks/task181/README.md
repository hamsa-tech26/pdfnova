# Task 181 — scientific split-cell investigation blocked on original sources

Date: 2026-10-25 (Asia/Kolkata). Outcome: **no runtime correction justified**.
This is the explicitly permitted blocker deliverable, not an accuracy release.

## Verified repository state

- Repository: `hamsa-tech26/pdfnova`; working tree initially clean on local `work`.
- Remote `main`: `85880e0181ee1e7f44990225aefe8563a3ece7a7`, matching the supplied production reference. A Git ref does not independently verify what is deployed.
- Remote `refs/pull/128/head` and `research/task178-publisher-table-concordance`: `24c65ddb4e9c54ad9e70976fcb4a36bcae7bfd4d`.
- Fetched that research head; investigated on local `research/task181-source-boundaries`.
- Both `gh pr view 128` (GraphQL) and `gh api repos/hamsa-tech26/pdfnova/pulls/128` (REST) returned `Forbidden`. The public PR HTML subsequently confirmed state `DRAFT` and head SHA `24c65ddb4e9c54ad9e70976fcb4a36bcae7bfd4d`. Public Actions HTML was used for historical CI verification; this is separate from local Task 181 validation.
- Existing PR: https://github.com/hamsa-tech26/pdfnova/pull/128
- CI listing (not verified run evidence): https://github.com/hamsa-tech26/pdfnova/actions
- `vercel.json` explicitly disables deployment for the existing research branch. No deployment command was run; no merge, issue closure or paid service was requested.

Historical CI on exact research head `24c65ddb4e9c54ad9e70976fcb4a36bcae7bfd4d`, verified from each public run page (all **Success**):

- Validate: https://github.com/hamsa-tech26/pdfnova/actions/runs/40149845625
- Release 112 external diagnostic: https://github.com/hamsa-tech26/pdfnova/actions/runs/40149845651
- Browser Reliability Smoke: https://github.com/hamsa-tech26/pdfnova/actions/runs/40149845660

These historical successes are not a fresh real-PDF replay of Task 181.

## What the code establishes

1. `lib/pdf-engine-v4/reader/pageReader.ts` stores each PDF.js text item as a `PdfWord`, with its item bounds and explicit `native-pdf` provenance. An item can contain multiple lexical words; its rectangle does not establish character-level positions. Whitespace is already normalized here.
2. `analysis/analysisTextFragments.ts` splits a line-leading numeric-prefix item into `-serial` and `-content` fragments, estimating their rectangles proportionally to character count. These retain the parent's provenance through object spread, but the fragment geometry is inferred, not independent PDF glyph geometry. This is a second candidate mechanism to inspect, not a proven cause of these six cases.
3. `analysis/stableColumnDetector.ts`, `splitLineIntoSegments`, starts segments at intentional serial boundaries or gaps exceeding `max(2.2 * averageCharacterWidth, 2.4 * previousCharacterWidth, 10)`. `clusterSegmentStarts` collects recurring left starts and distinct line IDs; `assignColumnBoundaries` places generic boundaries at midpoints between accepted starts. Repeated starts are useful evidence, but do not by themselves demonstrate an empty gutter between source cells. Wide text and variable alignment can cross a midpoint.
4. `analysis/adaptiveRowDetector.ts` has scoped physical-row paths, including native scientific caption/header rows. A physical row is not proof of its cell boundaries.
5. `analysis/smartCellBuilder.ts` maps analysis words to columns (`findNearestColumn`, `findCellAssignmentColumn`, `assignWordsToCells`), then joins only the assigned words. Some scoped two-column paths use a separate anchor rule. `pipeline/analyzePdfV4.ts` subsequently applies logical-table repair and conditional OCR repair. The exact branch used by each failing case must be traced before changing a threshold.
6. `lib/converters/pdfToXlsx.ts` serializes supplied row values into worksheet cells. It does not have the original cross-row word geometry needed to adjudicate a merge. Literal string export and safe numeric typing must remain intact; an exporter-only phrase merge would conceal the upstream ambiguity.

These are reproducible code-path observations, **not a confirmed root cause for the six reported source cells**. No actual source coordinates were obtained in this session.

## Why the six-count diagnostic is insufficient

`scripts/checkPublisherTableConcordance.py::compare` counts a distinctive compacted publisher string when it occurs within a concatenated output row but not within any single output cell. That count does not enumerate six visually adjudicated source cells. It may span more than two cells, strips punctuation/spacing for comparison, and searches sets across tables. The adjacent-pair proposal similarly compares text; the close-pair variant measures output cell rectangles, not necessarily the original ink gap. Neither requires all participating source words to have confirmed native provenance or an independently paired publisher/PDF cell location.

Consequently, finding a recognizable phrase or a small output rectangle gap is insufficient authorization for an automatic merge. The existing diagnostic explicitly reports `sourceVersionAligned: false` and `cellStructureIndependentlyAdjudicated: false`. Its source hash protects identity, not semantic page/cell alignment.

## Precise blocker

Neither original PMC PDF, the pinned publisher XML, the detection archive, nor USGS original regression inputs were present locally. The configured restricted network does not list their source hosts. Actual proxy CONNECT attempts returned HTTP 403 for:

- `pmc-oa-opendata.s3.amazonaws.com` (original PMC1064098 PDF);
- `www.ebi.ac.uk` (Europe PMC publisher JATS);
- `pubs.usgs.gov` (OFR 2024-1025 original PDF).

No alternate hosts, proxy bypass, unpinned copies or fabricated reference data were used. Available local PDFs were synthetic Phase 10.14 fixtures. The source downloads must become accessible through the supported environment configuration, or be supplied as authorized local inputs. GitHub API access is separately needed to verify CI and PR metadata.

## Before/after real-document measurements

| Metric | Recorded baseline supplied by task | Task 181 fresh before | Task 181 fresh after |
|---|---:|---|---|
| Published regions at IoU 0.50 | 3/6 | Blocked: original PDFs/references unavailable | Not measured; runtime unchanged |
| Distinctive exact reconstructed-cell strings | 2/37 | Blocked: pinned PDF/JATS unavailable | Not measured; runtime unchanged |
| Split-string diagnostic | 6 | Blocked: raw Inspector result unavailable | Not measured; runtime unchanged |
| Embedded-in-larger-cell diagnostic | 11 | Blocked | Not measured; runtime unchanged |
| Engine V4 Stable | 0/20 | Local existing gate BLOCKED, documentCount 0 | No certification credit |

No improvement, preserved real-document accuracy, or absence of false merges is claimed from unexecuted real-document tests. No algorithm was changed, so there is no candidate repair to certify.

## Secondary detection question

The existing `e2e/release112_pubtables.pilot.mjs` documents different source regimes among missed regions: PMC1064098 page 6 asserts zero confirmed native words inside its published box and the presence of image paints; PMC1064082 page 1 tests paired-native continuity into surrounding prose; page 4 exposes painted-image review. These existing assertions suggest that a native cell-boundary merge cannot explain every missed region. They were not replayed here and do not establish new measurements. A cell correction applied after region detection cannot recover an undetected region by itself. Source review is required before attributing the three misses to one cause.

## Smallest next reproducible experiment

1. In an authorized environment, use existing `scripts/downloadRelease112TablePilot.mjs` and `scripts/checkPublisherTableConcordance.py fetch benchmarks/release112/private/PMC1064098.publisher.xml`. Preserve existing PDF, archive and XML SHA checks; keep originals and Inspector JSON in gitignored private storage. Run `npx playwright test --config=playwright.release112.config.mjs` unchanged to recover the same-condition baseline.
2. Locally enumerate the six compact-string occurrences from that Inspector result; map each to page/table/row/cell IDs and original page word IDs. Independently inspect the rendered PDF and paired JATS cell location. Record whether each is actually one source cell, and whether the count includes duplicates or spans more than two output cells.
3. Trace the actual column candidates, row reason and assignment path. Compare original item rectangles against `-serial`/`-content` inferred fragments. For every proposed boundary, measure left ink end, right ink start, vertical overlap, and supporting/conflicting neighboring data rows. Keep missing/unknown/OCR provenance ineligible for native repair.
4. Start with one confirmed native false split and one nearby genuine column boundary, including short-gap numeric columns and multi-line headers. Require a repeated empty source gutter for a genuine boundary; test whether the false split lacks that gutter. Refuse ambiguous cases. Do not select thresholds using publisher strings or merge based on phrase recognition.
5. Only if source geometry separates them, implement the smallest correction at the responsible column/assignment stage. Assert exact source word ID coverage and unchanged text/numbers/provenance; include negative controls for genuine columns, sparse columns, OCR/mixed/unknown provenance and ambiguous gutters. Replay both original PMC PDFs, the unchanged six-box benchmark, and USGS's five-table/147-cell independent XLSX reader check before crediting any improvement.

The recommended next task is this one-case source-coordinate experiment, with source access restored, rather than another benchmark framework or a global gap relaxation.

## Validation

All runtime, parser, exporter, safeguard, test and dependency-manifest files remain unchanged. The only intended tracked Task 181 change is this report.

The preinstalled dependency tree was stale (Next 16.3.8 and Vitest 4.1.11). Its preliminary runs are not the final validation evidence. Ran `npm ci --no-audit --no-fund` successfully, then repeated validation with Next 16.4.2, Vitest 4.1.12 and Vite 8.2.4, on Node 24.19.0. A later `npm install --no-save --package-lock=false @playwright/test@1.56.1` installed the existing browser runner without changing manifests.

| Check | Actual result |
|---|---|
| `npm test` after locked install | 139 files, 714 tests passed; includes OCR, native geometry, cell building, converter and security regressions |
| Publisher parser/diagnostic Python unittest | 9 passed |
| Existing detection and native-prose-continuity Node checks | 2 passed |
| `npm run check:golden` | Passed; 3 synthetic golden cases |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed; 0 errors, 25 existing warnings |
| `npm run build` with permitted network access | Passed, including static page generation |
| Full `npm audit --json` | 0 advisories at all severities |
| Production `npm audit --omit=dev --json` | 0 advisories at all severities |
| Existing Next/Vite manifest security-baseline scripts | Passed |
| Existing browser OCR/reliability/XLSX suites (six files) | 23 passed, 3.6 minutes, no retries |
| Existing Stable gate | BLOCKED as expected, documentCount 0; not a certification pass |
| PMC/publisher-reference real-document replay | Blocked by missing inputs and source-host HTTP 403 |
| USGS real-PDF/five-table/147-cell XLSX regression | Blocked by missing original inputs and source-host HTTP 403 |

Existing synthetic boundary coverage passed with the unit suite: split multi-word header phrases do not become columns; sparse internal and trailing source-supported columns survive; wrapped physical lines join into logical cells. The Python negative control keeps split output cells out of exact-cell accuracy even when their concatenation matches publisher text. These controls do not prove that any of the six real cases is repaired.

The initial sandboxed build failed fetching Google Fonts; the locked-dependency build with permitted network access passed without modifying font configuration. `next dev` automatically rewrote its AGENTS.md generated block during browser validation; that unrelated generated change is excluded from the deliverable.

Browser invocation (existing test files unchanged; temporary configuration in untracked `work/task181/`):

```sh
NEXT_TELEMETRY_DISABLED=1 npx playwright test \
  --config=work/task181/playwright.config.mjs \
  e2e/reliability-smoke.e2e.mjs e2e/pdf_to_excel.e2e.mjs \
  e2e/ocr-multiline-heading-regression.e2e.mjs \
  e2e/ocr-low-resolution-safety.e2e.mjs \
  e2e/ocr-embedded-text-columns.e2e.mjs \
  e2e/release61-ocr-heading.e2e.mjs
```

The temporary configuration imports the repository's browser config, selects local `/usr/bin/chromium`, and preserves test assertions. Browser version: Chromium 154.0.8037.57. This is local Chromium evidence, not qualification on Google Chrome Stable or the CI-pinned browser binary. Independent XLSX reader: openpyxl 3.1.5. All seven tests in `pdf_to_excel.e2e.mjs` are included; real USGS checks remain separately blocked.
