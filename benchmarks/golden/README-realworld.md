# Release 52 — Real-world Golden Document Qualification

**Current status: NOT_RUN for real-world PDFs.** No private, approved corpus has been provided. The deployed feature is a *measurement framework*, not a completed real-world accuracy result.

## Internal acceptance policy

All real PDF files must have documented testing rights and two distinct human reviewers. Original PDFs stay local and are never added to GitHub or a deployment. Independent expected answers must be written before inspecting model output. The scorer checks an original PDF hash, reviewer approval, trusted basename and bounded document size (25 MB).

| Category | Actual user workflow | Fixed pass condition | Minimum real documents |
| --- | --- | --- | --- |
| ocr-text | OCR PDF → TXT | Normalized character error rate <= 5% | 2 |
| table | Engine Inspector V4 → downloaded JSON | >= 95% exact cells, >= 75% exact rows, identical row count | 2 |
| form | Flatten PDF → downloaded PDF | All independently approved visible phrases preserved, zero editable fields | 2 |
| layout | Reverse PDF → downloaded PDF | Source annotation verified; output pages reversed with same text, geometry and rotations | 2 |

The final local gate requires *all eight or more* reviewed files to pass. A missing corpus, missing measurement, failed case, unreviewed annotation, stale PDF SHA or changed ground truth cannot generate a passing report. These thresholds constitute scoped internal functional qualification, not external accreditation.

## Preparation and privacy

Inside the Kukureku project root (which may differ from your separate PDFNova directory), create the local folder:

    benchmarks\golden\private

Put real approved PDFs directly inside this folder using names such as case-approved-scan-01.pdf, and create a private manifest.json alongside them. Refer to benchmarks/golden/private-manifest.example.json for the shape. The sample has deliberate placeholder fields and is **not** a real validated result.

Use SHA-256 of each file (Windows PowerShell: Get-FileHash -Algorithm SHA256 '<path>') and independently transcribe/annotate the text, table cells, form values or source page text/geometry. The annotator and reviewer IDs must be different. A government form may contain hidden personal data even after editing visible text—manually verify consent and proper sanitization before testing. Do not upload sensitive PDFs to a public GitHub PR or issue.

## Local Windows Command Prompt workflow

Run from the Kukureku repository directory:

    npm ci
    npm install --no-save @playwright/test@1.56.1
    npx playwright install chromium
    node scripts/privateGoldenLocal.mjs
    npx playwright test --config=playwright.private-golden.config.mjs
    node scripts/privateGoldenLocal.mjs --require-complete

The fourth command reports NOT_RUN if no corpus exists. The fifth runs the real browser tools on original PDFs in your local dev server; it is **forbidden in CI**. The last command returns failure until every required category is sufficiently represented and passes. The browser may download OCR language model assets; this is separate from document upload and should be vetted for confidential workflows.

## Evidence and privacy controls

Private PDFs, answers and output reports stay under benchmarks/golden/private, which is gitignored. Browser traces, screenshots, videos and retries are disabled. The generated results contain only category metrics and hashed source/annotation references. The approved table index must be chosen before reading the V4 results, preventing gold-answer-driven table selection. Symlinks and directory traversal are refused for inputs.

## Non-goals

The Release 51 synthetic fixtures remain a CI regression baseline; they are not real-world data. The separate Phase 10.14 Engine V4 freeze gate remains blocked until that measured gate passes. No promise is made about arbitrary PDFs, visually exact renderings, languages unsupported by browser OCR or independent security accreditation.

## Release 53 — local intake preflight and evidence integrity

Before measured browser tests, run:

    npm run check:golden:preflight

This checks physical PDF bytes against SHA-256, opens the PDF, verifies layout source page counts, requires AcroForm fields for form cases, and rejects selectable-text or imageless files as raster-only OCR samples. The report contains only aggregate counts and reason codes, no PDF text.

To require a complete local corpus before measuring:

    node scripts/privateGoldenPreflight.mjs --require-ready

A READY_FOR_LOCAL_MEASUREMENT result is **not** OCR or table accuracy. After private browser tests:

    node scripts/privateGoldenLocal.mjs --require-complete

The final gate now hashes every original PDF again before trusting a saved PASS and invalidates older runner versions. Duplicate PDF SHA-256 hashes cannot count as separate cases. The private browser runner blocks network writes and unapproved outbound hosts, allowing only local app assets and the documented OCR asset CDNs. This does not replace independent privacy or security auditing.

**Real-world qualification remains NOT_RUN without independently reviewed, consented PDFs.** Reviewer identities are attested in the manifest, not independently authenticated.

## Release 54 — first measured real-document qualification intake

**Real-world accuracy status: NOT_RUN until you supply eight distinct approved PDFs with independently verified annotations.** Releases 51–53 established synthetic controls, scoring and privacy checks; none of those are substitutes for real-document measurements.

From the **Kukureku repository root** on Windows Command Prompt, run:

    npm ci
    npm run golden:intake-plan
    npm run golden:scaffold

The scaffold creates an eight-case template at:
`benchmarks/golden/private/manifest.draft.json`.
It deliberately **does not** fill in consent, reviewer approval, SHA-256 or expected answers. It does **not** create a valid real-world manifest. The tool will **not overwrite** a previous draft.

Collect **two distinct, genuinely approved PDF samples for each** of OCR scans, tables, forms and layouts. Put the PDF files under `benchmarks/golden/private` with the matching `case-*.pdf` names. Manually write their exact independent ground-truth expected fields in the draft and obtain a second person's review. Check source hashes using Windows PowerShell:

    Get-FileHash -Algorithm SHA256 'benchmarks/golden/private/case-ocr-scan-one.pdf'

Set valid `rights`, `annotation` and `expected` fields only after permission and human review. Change `provenance` to `REAL_WORLD_HUMAN_REVIEWED` after *actual* independent review. Save a copy as `benchmarks/golden/private/manifest.json`. All of these private files are intentionally gitignored. Do not upload originals, annotations or transcripts to GitHub or Vercel.

Next, execute:

    npm run check:golden:preflight
    node scripts/privateGoldenPreflight.mjs --require-ready
    npm install --no-save @playwright/test@1.56.1
    npx playwright install chromium
    npx playwright test --config=playwright.private-golden.config.mjs
    npm run golden:remediation
    node scripts/privateGoldenReport.mjs --require-complete

**Important:** A successful preflight means source data is ready, not that any OCR/table extraction succeeded. The private browser run inspects actual downloads, including OCR text, Engine V4 JSON, flattened forms and reversed layouts. Release 54 first verifies that each uploaded local source meets its own preflight eligibility, then checks output against independently reviewed ground truth.

The remediation report stays at
`benchmarks/golden/private/remediation-report.json`.
It contains case outcome codes, bounded numeric metrics, prioritized categories and suggested next repairs. Original PDF bytes, OCR transcriptions, table cell values and reviewer annotations are excluded from its content.

**Acceptance policy:** Two valid, distinct PDFs per category, all passing the existing fixed metrics, no stale/hash-mismatched results, and no missing or failed cases. Otherwise the release-54 real-world certification gate **remains BLOCKED**; the CLI exits unsuccessfully when `--require-complete` is used. Synthetic evidence, placeholder drafts or fabricated ground truth never qualify.

Known limitations: Only an internal, consent-based functional assessment; reviewer identity is an operator attestation, not independently authenticated. Browser OCR may download public language-model files; verify the trusted environment before processing confidential material. The existing separate Phase 10.14 V4 production freeze/accuracy gate is unchanged.
