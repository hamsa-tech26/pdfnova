# Task 260 — independent source-PDF page geometry

**DRAFT / NO MERGE / NO DEPLOY.** This is a read-only numerical source diagnostic in the existing Task 254 source-evidence branch, after its five-page published-annotation aspect preflight passed.

The existing source downloader SHA-256-checks two original public PMC PDFs and the PubTables archive on an ephemeral CI runner. Task 260 independently uses pinned PyMuPDF 1.26.6 to revalidate the PDF signatures, source hashes, page counts and page rectangles for the same 5 annotated pages. It records the original PDF media/crop boxes and rotations alongside published annotation dimensions, per-axis scale and aspect ratio. The CI artifact consists only of numeric metadata. No original PDF bytes, publisher image pixels or text are published.

This independent reader can identify page cropping/rotation/proportion discrepancies. **It cannot prove that the separate published PubTables raster and the PDF-rendered page are the same pixels.** Do not award any formal V4 Stable certification credit. The current source-box baseline is 3/6 at IoU >=0.50 (3 misses, one unmatched prediction); runtime detector and data threshold remain unchanged. Pages PMC1064082 p1/p4 and PMC1064098 p6 require further source-first study.

Require fresh exact-head Release 112 External Table-Box Diagnostic, Validate and Browser Reliability Smoke after this modification. Billing and Release 216 remain paused; no preview, user uploads, paid jobs, deploy, merges, or licensing claims.
