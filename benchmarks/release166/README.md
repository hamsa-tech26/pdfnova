# Release 166 — 20 independent published-PDF table detection diagnostic

**This is a real-document detection prequalification — not V4 Stable certification.**

Kukureku automatically and deterministically samples up to 90 PMC documents
from the PubTables-1M held-out *Detection Annotations Test* archive
(pinned SHA256) and attempts to source 20 distinct original, unmodified
publisher PDF files from the PMC Open Access public data S3 endpoint.

The PDF bytes, published XML, complete Inspector JSON and OCR text exist
only in an ephemeral CI working directory. CI publishes only per-document
counts, source SHA256 fingerprints, region matching/missing and a numeric
summary. The scoring holds the **IoU >= 0.50** threshold, one-to-one
reference matching, and actual logical table boxes from the Inspector.
No reference boxes are inputs to the PDF detector.

Unlike the two-PDF focused R112 diagnostic, this test samples **20 distinct
original documents**, but the published detection annotation does **not**
amount to an independently human-verified table cell, row, empty-cell or OCR
reference. Rights for each original document and third-party illustrations,
individual blind reviewer agreement, multilingual OCR, full 20–25MB stress,
performance, cancellation and formal accuracy thresholds are **not cleared**.
Accepted formal V4 Stable document count therefore stays **0/20**, even
when this diagnostic completes successfully.

The open issues #38, #55, #70 and #75 remain unresolved until the
specific original-source criteria are independently met. A benchmark that
returns a poor recall is an engineering finding, never grounds to weaken the
acceptance bar.

Source citations: Microsoft Research *PubTables-1M* (CVPR 2022);
PubTables-1M official held-out test annotation files at Hugging Face
(bsmock/pubtables-1m), checksum fixed in source script.
