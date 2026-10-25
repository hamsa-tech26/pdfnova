KUKUREKU PDF — development verification, 25 October 2026

Draft: https://github.com/hamsa-tech26/pdfnova/pull/133
Exact tested and pushed commit: `f24bae1e4f8359a02278d17c9adab9de10ceeb22`.
Branch: `fix/task181-redaction-cancellation`, stacked on PR #132
`12a1d03523484eb300b48be303284cc0b4b6674c`, whose parent is PR #130
`f4267570e893092d28e6adf185242bcc60ab3480`.
PR #131 remains unchanged and is not integrated in this draft. This is development
verification, not combined production qualification of all three drafts.

PR #132 was audited against #130: it adds immediate per-page masked-PNG embedding
and an event-loop yield while leaving its temporary canvas allocated. The new
candidate releases renderer canvas storage before its callback and masked canvas
storage after encoding, before yielding/compressing. Lossless PNG, opaque white
compositing, outward-rounded masks, page geometry and new-document rebuilding
remain in force. No original PDF object enters the rebuilt output.

The UI now exposes Cancel redaction. AbortSignal reaches PDF.js loading, active
RenderTask.cancel, image loading and cooperative embedding/save checkpoints.
A yield and cancellation check after serialization, followed by a UI check before
download, prevents queued cancellation from emitting bytes. Cancelled attempts do
not update output history/workspace. After synchronous download initiation, Cancel
cannot recall a download already started. Unmount aborts an in-progress export.

Admission/work limits are 25 MiB input, 100 pages, 3200 maximum raster dimension,
10.24 million pixels per page, 120 million cumulative rendered pixels, 64 MiB
cumulative masked-PNG bytes, 128 MiB final bytes and two minutes. Declared PDF image
streams are checked before preview and export decoding: 16 million pixels per
image and 64 million across all image streams, including masks/unused images.
These are engineering guardrails, not qualified mobile budgets or hard RSS caps.

Final validation on this committed candidate:

| Check | Result |
|---|---|
| Complete unit suite | 142 files, 730/730 PASS; 16 new unit regressions |
| Explicit OCR + Phase 10.14 unit command | 34 files, 145/145 PASS |
| TypeScript | PASS after production build |
| ESLint | 0 errors, 25 existing warnings |
| Local Next.js 16.4.2 production build | PASS; no deployment |
| Complete local production-build Chromium suite | 93/93 PASS, zero retries |
| Dedicated XLSX controls within that suite | 7/7 PASS, including actual workbook downloads and openpyxl checks |
| Four hash-verified real-reference refusal pilots | 4/4 PASS; zero workbook downloads |
| Actual-library stage cancellation harness | rendering, embedding, serialization: 3/3 AbortError, zero returned bytes, zero live canvas pixels |
| External invoice-maintainer assertions | 2/2 PASS; partial header/UPC/final-row evidence only |
| Tool registry | 31/31 synchronized |
| Complete output evidence; synthetic golden checks | PASS |
| Node corpus/reference guardrail entrypoints | 3/3 PASS |
| Supplemental script Vitest regressions | 5 files, 31/31 PASS; also included in full unit run |
| Next/Vite security baselines and vendor glob check | PASS |
| Full + production npm audits | 0 vulnerabilities |
| Independent real-corpus qualification | BLOCKED, 0/20; private-corpus commands report NOT_RUN |

Runtime: Node 24.19.0; Next 16.4.2; Vitest 4.1.12; Node Playwright 1.56.1;
installed Chromium 154.0.8037.57. Manual browser measurements use Python Playwright
1.62.0. Independent readers: PyMuPDF 1.26.6, NumPy 2.3.5, pdfplumber 0.11.9,
openpyxl 3.1.5. The Playwright-pinned browser and physical mobile devices were not
qualified. No hosted CI receipt is claimed for this stacked branch.

An exploratory broad Node test command incorrectly included five Vitest-only
files and failed during runner initialization. It was corrected to Node's
`.nodecheck.mjs` entrypoints plus the Vitest script suite, both passing. That
failed harness invocation is retained separately in the receipts; it is not a
passing product test. Missing independent/private corpus evidence is not called
an accuracy pass.

Initial measurement before the cleanup change observed 34,300,000 bytes of live
canvas backing stores at timer callbacks. Two later isolated serial trials used
PR #132's exact exporter/renderer and the final candidate, holding the final UI,
six-page constructed input and installed browser constant. Fresh browser per run,
local development server, 20 ms aggregate Chromium-process RSS sampling, 10 ms
heartbeat; shared pages are counted per process and transient peaks can be missed.
These are desktop observations, not throughput or mobile acceptance guarantees.

| Trial | Seconds, #132 → final | Longest UI gap ms, #132 → final | Peak aggregate RSS MiB, #132 → final |
|---|---|---|---|
| 1 | 3.146 → 2.308 | 758.6 → 314.9 | 965.9 → 922.2 |
| 2 | 2.992 → 2.590 | 785.6 → 344.0 | 935.8 → 939.2 |

At timer callbacks, live canvas storage changed from 34,300,000 bytes to zero in
both serial trials. All four downloads were 148,671 bytes. Separate MuPDF reads
found identical decoded RGB bytes and geometry across all 25,725,000 six-page
pixels compared with the parent control. The second RSS trial slightly increased;
no universal memory reduction is claimed.

The actual derived 600-dpi FBI control is 8400×5100 pixels in a 1,486,128-byte PDF.
Before the new source-image guard, it downloaded at 1,248.6 MiB peak aggregate RSS.
The guard now refuses it before preview/decoding: zero preview images, zero
downloads, about 0.355 seconds and 626.6 MiB sampled aggregate RSS. Those two
observations cover different operations (export versus admission refusal), not an
equivalent-work speedup. The derived 300-dpi 4200×2550 control remains admitted.

Actual final-commit downloads were compared with an independent lossless PDF.js
reference render using MuPDF/NumPy. Four cases (six-page native constructed,
unaltered FBI, unaltered USDA and derived 300-dpi FBI) cover 9 pages,
30,987,894 pixels and 384,331 selected pixels: zero selected nonblack pixels and
zero changed unselected pixels. They contain no selectable text, fonts, links,
fields, annotations, attachments, forms or extra image objects. Together with the
existing six-page CropBox/UserUnit/quarter-turn download regression: 15 pages,
32,104,994 checked pixels and 412,414 selected pixels, zero mismatches. These
bounded checks do not establish arbitrary-document forensic acceptance or safe
user mask placement. The raster preserves the configured PDF.js render, not
original vector objects or original scan resolution. Full-page text and
interactivity are intentionally removed. Source/output hashes are in receipts.

The four real-reference XLSX refusals are reproduced on actual downloaded PDFs:

| Reference | Precise default stop | Targeted non-shipped possible-table experiment |
|---|---|---|
| FBI November 2015 | Candidate score 47.88, isTable=false; structure analysis skipped; no-table quality refusal | 1×23 after all native lines merge as wrapped/continuation content; structure refusal |
| USDA weekly energy | Confirmed region includes adjacent chart content; 17 physical lines collapse to 1×8; structure quality refusal | Still 1×8 and refused |
| Public invoice | Candidate score 49.65, isTable=false; structure skipped; no-table quality refusal | Incorrect 2×5 region passes export planning; unsafe to enable |
| NREL fuel-savings excerpt | Candidate score 54.39, isTable=false; structure skipped; no-table quality refusal | Whole-page prose-contaminated 6×9; overlap quality refusal |

Default candidate diagnostics remain `pending` for the skipped possible regions;
this diagnostic limitation is recorded, not misreported as a column or OCR
failure. OCR is disabled on this native-text automatic route. All four default
attempts stop before workbook generation. Workbook-generation failures: zero;
real-table export coverage failures: four before and four after. No workbook was
emitted from the diagnostic-only experiment either; the invoice result means the
planner would admit a wrong region if that option were enabled. It was not enabled
in the app. No global threshold, row gate, OCR policy or cell content was changed.
No cells were invented. Real-workbook exact cell/row accuracy for these four is
N/A because no default workbook was emitted; refusal is not successful conversion.

Separate pdfplumber region/grid extraction and MuPDF page inspection confirm the
visible source layouts. FBI text-strategy extraction is not a complete trustworthy
blank-column grid. USDA contains a left report table plus three right charts;
NREL's actual seven-column table occupies a small area below prose. The invoice's
first table has 5 rows × 9 columns; external maintainer tests independently assert
its header, UPC column and last row. A neighbouring Camelot `foo.csv` contains
unrelated 2×2 test data and was explicitly excluded as an NREL reference.

FBI/USDA/invoice provenance: jsvine/pdfplumber
`4c64b92d5caccd71c645e98e0fabb0c4dba7ff45`.
NREL: camelot-dev/camelot `92777b852e00933a5c4b9ba642601784604356cd`,
`tests/files/foo.pdf`. Exact hashes and test paths are committed in
`benchmarks/task181/real-reference-diagnostics.json` and the refusal pilot.
Fresh publisher authentication is not claimed for these public mirrors.

Remaining blockers: complete independently blind-reviewed references for all
four PDFs; trustworthy region isolation and native physical-row recovery;
combined integration with PR #131; hard resource isolation for inline images and
codec allocations; worst-case synchronous cancellation latency; pinned-browser
and low-memory physical-device qualification; broader forensic redaction evidence.
Declared image dimensions and work budgets cannot cap all browser decoder memory.
A two-minute cooperative deadline cannot preempt synchronous JavaScript.

**Missing independent review evidence remains a certification blocker. Engine V4
Stable remains unverified, formally BLOCKED at 0/20.** No production-readiness or
real-document accuracy certification is claimed.

Deployment safety: the new branch's first pushed commit already contains
`git.deploymentEnabled["fix/task181-redaction-cancellation"] = false`; remote
blob `74b61935eb62f167ee5a2d6156d968761f2041f6` was independently fetched and
checked. No merge, preview/production deployment, deployment-quota use, paid
service, Android/Smart Scanner work or historical PR closure was initiated.
PRs #130/#131/#132 remain unchanged drafts. Repository source is clean at the
reported commit. The receipt archive contains logs, counts, hashes, metadata and
reproduction scripts, excluding raw PDFs, raster references and workbooks.
