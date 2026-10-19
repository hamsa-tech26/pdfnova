# Kukureku Release 107 — real-world failure inventory and release boundary

Status: diagnostic baseline only; this does not fix OCR/table-detection defects or certify Engine V4.

## Open, source-grounded issues and acceptance requirements

| Issue | Known failure / evidence | What would actually close it |
|---|---|---|
| [#37](https://github.com/hamsa-tech26/pdfnova/issues/37) | Synthetic perspective-distortion rows still have an exact-cell mismatch in earlier reports | Measured original 10.14d OCR rows/cells, source-token preservation, no merged identities |
| [#38](https://github.com/hamsa-tech26/pdfnova/issues/38) | Independent hybrid, rotated, multilingual and performance acceptance absent | Independently reviewed, authorized 20-document corpus meeting the unchanged formal gate |
| [#55](https://github.com/hamsa-tech26/pdfnova/issues/55) | Real manual OCR issues: identifier transcription, checklist X alignment, missing headings, sidebars | Compare each original and recognized output; no inferred correction or silent status assignment |
| [#57](https://github.com/hamsa-tech26/pdfnova/issues/57) | Cross-tool physical document acceptance remains open | Real downloadable operation-specific proof and explicit supported-scope limits |
| [#58](https://github.com/hamsa-tech26/pdfnova/issues/58) | Original release planning for restricted PDF-to-Excel | Reconcile past MVP issue with shipped selective, native-only converter; never claim scan-to-XLSX |
| [#70](https://github.com/hamsa-tech26/pdfnova/issues/70) | USGS table-page recall diagnosed before newer releases | Re-run exact full original source against current head and score independently reviewed table boxes |
| [#75](https://github.com/hamsa-tech26/pdfnova/issues/75) | PubTables-1M boxes poorly matched earlier V4 paragraph-block proxies | Full-paper true table-specific detection box IoU and false-positive comparison; not proxy boxes |

## Production safety boundary

- Releases 107–111 are narrowly scoped quality/regression work; no unverified automatic OCR substitutions and no scanned/mixed PDF-to-XLSX export.
- Preserve published original-source browser pilot, full XLSX roundtrip, Validate and browser reliability workflows on the exact branch head.
- The public 20/20 pilot is **not** the private independently annotated 20-document Engine V4 Stable acceptance.
- The committed synthetic golden manifest records zero evaluated real-world cases. Do not use a green CI badge to change that claim.
- Source clinical data, private PDFs, and extracted document contents must not be committed or logged.
- Preview deployments are disabled for the consolidated branch; only ship one production deployment after every required gate succeeds.

## Outcome ledger

107: issue and evidence inventory (this file, automated certification-label invariant).
108: targeted identifier reread ambiguity guard and regression cases.
109: checklist competing-mark ambiguity guard and regression cases.
110: Unicode-safe bounded XLSX preview clipping and no-loss tests.
111: scanner/mixed-export fail-closed QA + exact-head CI and deployment verification.

These release numbers mark tested incremental improvements; they do not represent five independently qualified OCR breakthroughs.
