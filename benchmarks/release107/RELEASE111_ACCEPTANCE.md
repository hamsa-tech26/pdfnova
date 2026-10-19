# Release 111 — consolidated QA and launch limits

Five-target development batch: R107 audit, R108 labelled OCR reread ambiguity, R109 scanned checklist competing marks, R110 Unicode-safe Excel preview, and R111 mixed-document fail-closed/CI.

## Pass conditions on exact PR head

1. GitHub Validate: TypeScript, lint, Vitest, Next.js build, dependency/OCR checks.
2. Engine V4 Public Document Pilot: 20/20 real publisher/browser validations without changing references.
3. Release 57 XLSX Browser Roundtrip: maintain exact XLSX cell values and parsing.
4. Browser Reliability Smoke: maintain existing tool and user-flow coverage.
5. No preview Vercel deployment on this development branch. After four checks pass, merge exactly once, allow one production Git deployment, verify Vercel READY and kukureku.com alias.
6. If any check fails: do not merge or deploy. Record the failure and correct the same branch.
7. Keep 20 independent-document formal V4 Stable score at 0/20 unless rights, independent annotation, and complete acceptance actually pass.

## Out-of-scope / still unresolved

- No new OCR recognizer, no claim of improved real-world character accuracy without reviewed originals.
- No scanned/mixed PDF-to-Excel converter enabled.
- No global table score reduction, invented cells/merged headers, or blind correction.
- #37 perspective table fidelity, #70/#75 external table detector acceptance, #38 formal V4 certification remain open.
