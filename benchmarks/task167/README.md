# Task 167: remaining paired-PDF failures

Development base: production `main` / merged PR #115,
`9954e9ad193acd7b3375482bbd149004fedf13db`, confirmed through GitHub on
October 23, 2026. Fresh branch: `research/task167-source-diagnostics`.
No merge or deployment is authorized. Branch deployment is disabled in its
first published commit, before creating the remote ref.

## Recovered evidence, not a new source replay

The previous validated feature commit `d8c5b96` passed nine applicable workflows
(dependency probe skipped). However, the **post-merge main Validate run
39876999182 fails**: its build, 703 unit tests and 145 OCR-subset tests pass,
but npm audit reports critical Next.js advisories on 16.3.8, with 16.4.2
suggested. Do not describe production CI as currently all green. Vercel's
combined commit status reports success; that is not independent live source
attestation. No deployment was triggered by this task.

Numeric results retrieved from existing paired run
[39811320105](https://github.com/hamsa-tech26/pdfnova/actions/runs/39811320105),
job 119938021911, corrected detector:

| Sample | TP / references | Misses | Unmatched predictions | Reference best IoU |
| --- | --- | --- | --- | --- |
| 1 | 1/1 | 0 | 0 | .8152 |
| 2 | 2/2 | 0 | 0 | .8878, .8860 |
| 3 | 3/3 | 0 | 0 | .9054, .9492, .7637 |
| 4 | 2/2 | 0 | 0 | .6104, .6509 |
| 5 | 1/1 | 0 | 1 | .7420 |
| 6 | 2/2 | 0 | 0 | .8406, .8989 |
| 7 | 1/1 | 0 | 0 | .6699 |
| 8 | 0/1 | 1 | 0 | 0 |
| 9 | 0/1 | 1 | 0 | 0 |

Samples 8 and 9 reference page 2. Sample 8 has 90 native extraction items,
58 lines, one image paint and zero legacy numeric-eligible lines on that
page. Candidate outcomes: one below threshold, one insufficient columns.
Sample 9 has 28 native items, 14 lines, one image paint and zero eligible
lines; both candidates are below threshold. These are **page** totals;
they do not prove that either actual reference table is image-only.
Sample 5 has two predictions for one matched reference. The extra
prediction cannot be labeled false positive without source adjudication.

## Implemented diagnostic

`scripts/icdarRegionEvidence.mjs` is evaluation-only and is imported solely
by the browser benchmark. It reports reference-local native/OCR/unknown
item counts, image overlap, every prediction's reference IoUs, row/column
counts, match-count effect of removing a prediction, and allowlisted candidate
score components. It never exports source text, word IDs, filenames or raw
Inspector objects. Tests check redaction, reference locality, unknown
provenance, duplicate predictions, read-only behavior and input bounds.

The existing bounded paired workflow runs this guardrail and emits region
evidence for already-exposed Samples 5, 8 and 9. Subsequent runs label
the six former reserved documents as regression examples, not unseen data.
The old baseline comparison remains an explicitly historical comparison;
it is not an evaluation of a new detector. Production detector, scorer,
backup/privacy code, OCR, export and resource limits are unchanged.

## Access and qualification boundaries

Local git fetch fails: `Failed to connect to proxy port 8080`.
`python scripts/prepareIcdarPilot.py --heldout` exits 1 with sanitized
`URLError`; original paired PDFs are not installed locally. No proxy bypass,
source redistribution or speculative detector adjustment was attempted.
GitHub connector reads/writes remain usable and can run the existing bounded
PR workflow on an ephemeral GitHub runner.

Filename/hash/MediaBox compatibility is not image-version equivalence.
Original document rights and source-image identity remain unverified.
Former reserved documents are now development diagnostics. No fresh
authorized untouched set has been obtained, and no held-out improvement or
independent cell accuracy is claimed. Formal V4 Stable remains **0/20**.

## Validation and next gate

Local production baseline: 139 Vitest files / 703 tests pass. Six Python
corpus/comparator tests pass. Node diagnostic and existing scorer controls
pass; diff whitespace check passes. Hosted replay results will be appended
after completion, with failures kept visible.

Next PDF gate: inspect exact source regions and original image correspondence
using authorized originals before designing a correction. Separately,
production's critical Next.js audit failure needs a focused patched-version
upgrade and full regression validation; this diagnostic does not fix it.


## Continuation: private visual source adjudication

The earlier critical Next.js audit failure discussed above is historical.
Production now uses Next.js 16.4.2 at c55ea065; maintenance PR #119 remains separate.

The new scripts/reviewIcdarReferenceOverlay.py is a private offline review
tool for already-exposed Samples 5, 8 and 9. It checks the prepared original
PDF's SHA256 and page geometry, rejects tampered and rotated/cropped originals,
and renders both possible XML Y-axis interpretations side by side. Image
overlays are written only to gitignored benchmarks/icdar/private/review/.
No original PDF, XML, reference text or preview is uploaded to GitHub.

After preparing the source bundle with prepareIcdarPilot.py --heldout
in an environment legitimately permitted to use the original documents,
run: python scripts/reviewIcdarReferenceOverlay.py --sample-index 8
(or use --sample-index 9 or 5). Dependencies are PyMuPDF and Pillow.
Five synthetic-only Python tests cover tamper refusal, malformed coordinates,
certification safeguards, bounded samples, and both rendered orientations.

The benchmark mirror describes CDLA-Permissive-2.0, but its dataset card
states that the underlying original ICDAR documents have no known license.
Original-document rights, source-image identity, visual coordinate mapping,
independent cell accuracy and real-document generalization remain unverified.
The tool produces a review aid, not a detector correction or certification.
Formal Engine V4 Stable remains 0/20.
