# Task 232 — current-production original-source PubTables replay

## Scope and provenance

Re-run the current `Release 112 External Table-Box Diagnostic` workflow on production source `5668cae7ae0c1f8360ef4896d8eb83ff775be04e`. This is a **test-only, no-deploy diagnostic**, not a change to table detection.

Source collection remains strictly bounded to two original PMC PDF sources and the small, SHA-256-pinned PubTables detection test annotation archive declared in `benchmarks/release112/sources.json`. The existing fetcher checks origin allowlists, size ceilings, source hashes, and matching XML filenames. Only numerical metadata goes to CI artifacts.

## Required results

- Preserve independent published reference boxes, count and input PDF hashes.
- Score actual detector **table-specific** regions against published boxes at unchanged IoU `>=0.50`. Report individual `referenceBestIoU`, matching count, missed boxes and unmatched predictions without advertising a general accuracy percentage.
- Compare original-PDF page and detection-annotation pixel/rotation/crop identity **only when independently evidenced**. This workflow does not prove image-source equivalence merely because PDF and XML filenames match.
- Replay uncaptioned prose anti-false-positive checks and the V4 formal qualification gate. **0/20** accepted real documents is the only supported V4 Stable count until independent full-document reviews exist.
- If source access, licensing, coordinate matching, or CI breaks, keep the issue open and record the blocker rather than substituting synthetic or unverifiable source files.

## Outcome ledger

| Item | Status before run |
| --- | --- |
| External published boxes | 6 expected; current source verification pending |
| Current production detection match count | NOT_REMEASURED |
| Source-image to original PDF pixel pairing | NOT_VERIFIED |
| Source cell truth | NOT_ANNOTATED |
| Independent V4 Stable credit | 0/20 |

**No merge, Vercel preview, deployment, broadened data downloads, paid service, user uploads, or Release 216 change.** The tested branch is purely evidential; source compatibility needs a verified technical decision before further detector changes.
