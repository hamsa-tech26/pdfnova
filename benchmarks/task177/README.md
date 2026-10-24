# Task 177 — Compact scientific table source-provenance integrity

Baseline production: a51e130589e2a03556ade618cbd3144a6e3481aa.

### Reproduced defect
In `nativeCompactScientificGrid.ts`, the specialist for scientific
three/four-column table rows excluded explicit `ocr-tesseract` but
*implicitly accepted missing `extractionProvenance`*. This allowed
unknown-origin values to inherit native-PDF confidence and be promoted
to user-review table candidates.

### Scoped correction
Require *every* source word to positively assert
`extractionProvenance.source === "native-pdf"` before assigning a
native scientific row signature. Retain all column-geometry, numeric,
row-count, OCR planner and global thresholds. Never reinterpret unknown
sources as OCR or guess missing source words. Add one regression covering
confirmed input (still accepted), entirely unknown input (refused),
one unknown cell among source-native lines (refused), and unchanged
word identity/input.

### Required verification
Fresh exact-head Validate: unit/OCR/TS/lint/build/audits; browser reliability
including redaction privacy; 20-case original-publication pilot (USGS 147/147
XLSX cells via independent reader); real OCR; six-box external-table
diagnostic at unchanged IoU 0.5. Do not accept weakened scores.

### Evidence limitations
This closes a provenance ambiguity, NOT automatic recovery of the three
external published table boxes missed by the source-first benchmark.
The PubTables benchmark 20-source image-alignment caveat remains.
No new 20-document independently reviewed certification: V4 Stable 0/20.
ICDAR original-document rights/coordinate alignment still unverified.

### Deployment boundary
No preview or production deployment, merges, source PR closures or payment
without separately explicit approval. This branch is deployment-disabled
from its very first Git tree.
