# Kukureku — PDF Engine V4 formal qualification (development only)

**Current state: NOT VERIFIED. This work does not certify V4 Stable or fix OCR recognition.**

This directory contains a fail-closed, independent assessment foundation recovered from draft PR #39 onto current production `main`. It does not change the existing OCR, PDF-to-Excel, parsing, or PDF processing paths.

## Why this is separate from the existing Golden Document suite

The current Golden Document workflow remains the release-level, privacy-preserving real-document regression suite. Formal V4 Phases 10.15–10.20 additionally require broad, independently reviewed table geometry, multilingual, performance, cancellation, and stress evidence across **at least 20 distinct real PDFs**. Passing a synthetic benchmark or an individual physical test is not enough.

The public OCR PDF tool is currently **English-only**. Hindi/Bengali recognition and reference datasets are future work; the formal gate correctly remains blocked until those are implemented, evaluated and approved. Do **not** change product claims to V4 Stable merely because unit tests pass.

## Public USGS processing pilot (metadata-only, not a corpus document)

A separate GitHub Actions workflow, `.github/workflows/release37-public-pilot.yml`, runs on changes to this pilot. It fetches three independently sourced USGS publications from the [USGS Publications Warehouse](https://pubs.usgs.gov/), creates bounded diagnostic excerpts in an ephemeral runner, analyzes those pages using the current browser V4 Inspector, and uploads only page-count, hash, routing, and timing metadata.

- `scripts/downloadRelease37PublicPilot.mjs` refuses non-USGS redirects, non-PDF responses and inputs over 25 MB. The input/derivative PDF and complete Inspector JSON are **not uploaded** to GitHub Actions artifacts.
- `e2e/release37_public.pilot.mjs` validates actual Inspector execution, **not** reference-correct OCR or table extraction. It does **not** expect the old PR #39 `release37Audit` engine field, which was intentionally not migrated into production.
- `benchmarks/release37/candidates.json` is a source-discovery tracker, not approved rights or reviewed reference data.
- The USGS generally treats its authored reports as U.S. public-domain works, but third-party photos, graphics, and other inclusions may have separate rights. The pilot does not grant itself rights approval; report-specific human review is still mandatory before formally accepting or redistributing materials.
- This three-page excerpt provides **zero credit toward the 20 distinct, independently annotated real-document requirement**. It has no independent reference annotations, tested accuracy percentages, or multilingual evidence.
- The formal `npm run qualify:v4:stable` command is expected to exit nonzero with `BLOCKED`; the pilot workflow confirms that expectation on the no-evidence baseline.

You can reproduce the non-qualifying diagnostic with `node scripts/downloadRelease37PublicPilot.mjs` and `npx playwright test --config=playwright.pilot.config.mjs` after installing the browser runner and Chromium. This is not required for the user to run on their laptop; CI executes it on an ephemeral machine.

## Current three-document diagnostic queue (15 October 2026)

The public pilot now downloads **three distinct published USGS source PDFs** to ephemeral GitHub CI, rather than assuming the first document's first pages adequately test tables:

| Source | Original publisher PDF | Original pages selected for diagnostic | Review target |
| --- | --- | --- | --- |
| USGS SIR 2024-5103 | `https://pubs.usgs.gov/sir/2024/5103/sir20245103.pdf` | 1–3 | Native and introductory layouts |
| USGS FS 2024-3013 | `https://pubs.usgs.gov/fs/2024/3013/fs20243013.pdf` | 1–2 | Two-page factsheet with graphics and multiple reading areas |
| USGS OFR 2024-1025 | `https://pubs.usgs.gov/of/2024/1025/ofr20241025.pdf` | 14, 19, 20 | A simple deployment table, a grouped detection table and a hierarchical travel-time table |

The original OFR report's table of contents identifies **five tables** on PDF pages **14, 17, 18, 19 and 20**. They are inventoried, but not annotated, in `benchmarks/release37/public-table-inventory.json`. The reviewer must independently confirm all five, their geometry, and any additional content in the original 30-page PDF. `scripts/checkRelease37PublicTableInventory.mjs` binds this **zero-credit** inventory to the original source SHA-256 and current public pilot metadata; it cannot make the annotations approved.

Sources are declared in `benchmarks/release37/pilot-sources.json`. `scripts/downloadRelease37PublicPilot.mjs` verifies HTTPS USGS-only sources, actual PDF signatures, original SHA-256, unique source bytes, bounded sizes, and selected page validity. `e2e/release37_public.pilot.mjs` independently processes each excerpt in browser and saves **numbers/statuses only**; no PDF or raw Inspector JSON is an uploaded artifact.

The pilot's metadata report now also includes **numeric V4 table-region rejection counters and enumerated outcomes by original PDF page**. These diagnose why published tables were not returned as logical tables, without exporting source text, block IDs, coordinates or extracted cell contents. A zero table count on a page containing published tables is an **investigation signal, not an accuracy score**; see [Issue #70](https://github.com/hamsa-tech26/pdfnova/issues/70).

`scripts/createRelease37ReviewQueue.mjs` reads the metadata and generates `benchmarks/release37/reports/review-queue.json`. Its `rightsConfirmed` and `independentReferenceReview` remain **false**. The queue is a list of tasks for a genuinely independent reviewer, **not** an automatically approved annotation. The workflow asserts all three pilots have **zero acceptance credit**.

The **full original PDF** (not a three-page derivative excerpt) must be independently annotated and rights-reviewed before being entered into `benchmark:v4:corpus`; subset hashes never count as independent additional documents. Actual English OCR errors, scanned documents, rotated pages, complex tables, Hindi/Bengali recognition and full-document performance are separate pending objectives. The product's OCR is still English-only.

This diagnostic can be repeated via GitHub CI without Vercel deployments or a user's local laptop. Artifacts contain only the bounded diagnostic JSON, publisher metadata, and unapproved reviewer queue. The three source documents must not be reported as `3/20` approved until the independent review and ground-truth requirements pass.

## Phase 10.20 — Blind original-PDF table-reference intake (Release 69)

The live Engine V4 Inspector output **must never be used to generate expected cell contents or to decide the true reference table geometry**. A reviewer should examine an authorized **original full PDF** separately, identify its actual tables, and manually annotate all cells, including empty cells. This new tooling only prepares an EMPTY, unapproved draft and structurally checks a finished reference.

1. Obtain a legally usable full real-world original PDF and verify that all third-party content rights are suitable. Place it privately at `benchmarks/release37/private/<id>.pdf` (replace `<id>` with a safe unique document ID). Do not use the derivative three-page pilot excerpts to claim another independent source document.
2. Independently inspect the original PDF WITHOUT reading the V4 Inspector's table predictions. Prepare `benchmarks/release37/private/<id>-layout.json` with only the human-observed table layouts. Example:

```json
{
  "tables": [
    { "pageNumber": 14, "rowCount": 4, "columnCount": 3 }
  ]
}
```

3. Execute `npm run v4:blind-reference -- <id>` **locally**. The script validates the source signature, actual PDF page count, privacy path/symlinks and input bounds, hashes original PDF bytes, then creates `<id>-reference.draft.json` with every cell `"text": null`. It never opens a previous Inspector result. It refuses to overwrite an existing draft or run in CI.
4. A first human annotator uses the source PDF to fill every `text` value. Even truly empty cells require `"text": ""`. For source-visible merged cells, put `rowSpan` / `columnSpan` on the anchor cell and remove all corresponding covered slots. Do not copy text, rows, cell order or merge spans from V4.
5. A **different** reviewer cross-checks *all source tables and their cells against the original source PDF*, corrects errors, and approves the reference. Update `provenance` to `INDEPENDENT_REFERENCE_REVIEW` and set the `review` fields: distinct `annotatorId` / `reviewerId`, ISO `reviewedAt` date, `sourceInspected: true`, `reviewerApproved: true`, `allSourceTablesReviewed: true`, `method: "SOURCE_PDF_BLIND_TO_ENGINE_OUTPUT"`. Rename the finished reference to `<id>-reference.json` (keep all bytes private).
6. Export actual Inspector JSON from the SAME original source PDF into the private directory. Prepare the existing `private/manifest.json`, making `id`, source SHA-256, `reviewedBy`, `reviewedAt` and original file locations match the completed reviewed reference.
7. Run `npm run benchmark:v4:corpus` locally. A reference now **fails closed** if draft/null, lacks independent review, has duplicated or missing cell slots, mismatches the original source hash or original PDF's independently parsed page count, or disagrees with the manifest reviewer/date. A structurally valid attestation enables **scoring**, not automatic V4 Stable certification. It is still incumbent on the human reviewer to confirm the truth of the attestation.
8. Finally check `npm run qualify:v4:stable`; the formal 20-document, language, error, performance and cancellation gate remains BLOCKED until independently measured full evidence exists.

**Privacy:** only the local `benchmarks/release37/private/` folder contains original PDFs, raw engine outputs, private annotation text, or reviewer identities. This folder and score-report folder are gitignored; do not upload them to GitHub artifacts. The public 3-document USGS CI pilot remains diagnostic and contributes **0/20** to formal quality evidence.

## Local-only usage

1. Work with licensed, public-domain, properly consented or safely de-identified PDFs. Obtain human-confirmed usage rights and separately reviewed reference annotations. Never add document bytes or identifiable text to GitHub, commit messages, CI artifacts, or issue comments.
2. Keep every source PDF and its human-reviewed reference JSON and captured V4 Inspector JSON **only** inside `benchmarks/release37/private/`. This directory, along with generated score reports, is gitignored.
3. Create `benchmarks/release37/private/manifest.json`, with a `documents` array of entries like:

```json
{
  "documents": [
    {
      "id": "reviewed-example-001",
      "origin": "real-world",
      "usageRights": "public-domain",
      "rightsUrl": "https://example.org/rights",
      "sourceUrl": "https://example.org/example.pdf",
      "rightsConfirmed": true,
      "categories": ["native", "complex"],
      "sha256": "<actual 64-character PDF SHA-256>",
      "independentReferenceReview": true,
      "reviewedBy": "Independent reviewer",
      "reviewedAt": "2026-10-15",
      "localPdf": "benchmarks/release37/private/source.pdf",
      "referenceJson": "benchmarks/release37/private/gold.json",
      "inspectorJson": "benchmarks/release37/private/actual.json"
    }
  ]
}
```

4. Run `npm run benchmark:v4:corpus` **locally only**. It validates source hashes and path containment, scores actual V4 output independently against reviewed table labels, and writes an aggregate-only report to `benchmarks/release37/reports/real-corpus.json`.
5. Inspect limitations; then add independently documented phase, actual-2026 Phase 10.14 OCR, critical regression and measured performance evidence to a **private local copy** of the score report. Never claim a metric was measured unless backed by reproducible execution and review.
6. Run `node scripts/checkRelease37Gate.mjs benchmarks/release37/reports/real-corpus.json` on the completed local evidence report. For a repo-only no-evidence baseline run `npm run qualify:v4:stable`; it is **expected to exit nonzero and print BLOCKED** against `benchmarks/release37/report.json`.

## Acceptance thresholds

- At least **20 distinct real PDF SHA-256 hashes**; at least **2 independent documents** in each of native, scanned, hybrid, complex, multi-page, rotated, Hindi and Bengali categories.
- Independently measured exact cell accuracy **>=95%**, row accuracy **>=75%** and structure accuracy **>=90%** per category. Inference from synthetics and unreviewed ground truths is disallowed.
- Completed and source-linked evidence for Phases **10.15–10.19**; no critical regressions; actual Phase 10.14 OCR gate PASS.
- Measured **20–25 MB** stress coverage, peak heap <=512 MiB, main-thread blocking <=200 ms, verified page batching and cancellation.

Unit tests for `checkRelease37Gate` use explicitly **mocked records** to test fail-closed decision logic; a mock PASS is *never* production evidence. Only a fully inspected corpus and real measurements can clear the formal gate.

## Status of original draft PRs

- PRs **#56 / #63**: most OCR review-safety notes, checkbox clues and the metadata fix are already in deployed main. They must **not** overwrite later OCR repairs.
- PR **#59**: PDF-to-Excel is already released through PR #65; experimental geometry and OCR heuristics need independent qualification and remain **off**.
- PR **#39**: outdated integrated branch must not be merged wholesale; this branch selectively recovers the independent scoring and formal gate infrastructure.
- The old PRs are intentionally kept open until the user authorizes their closure; do not merge or deploy them as a batch.

Any future feature migration must start from current production `main`, be tested on a new development branch, and receive independent release approval.
