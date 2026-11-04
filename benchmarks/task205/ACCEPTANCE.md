# Task 205 — V1 real-document qualification intake hardening

Base production source: Release 195 `1b25dc6fe74c9ba0bac1b337e0e46b9254aba241`.

This branch changes private, local-only qualification tooling and tests. It does
not change public PDF tool output, the 31-route output-evidence claims, or the
separate PDF-to-Excel research track. Its Vercel branch deployment is disabled.

## Ten prioritized readiness checks

| # | Readiness check | Current disposition |
| --- | --- | --- |
| 1 | Real-world consent/reviewer/source corpus | **BLOCKED**: no approved private corpus available; no independent acceptance |
| 2 | Ignore unused PDF image resources | **VERIFIED synthetic**: cannot qualify OCR without a painted raster |
| 3 | Accept actually painted image-only OCR inputs | **VERIFIED synthetic**: image render operation detected |
| 4 | Reject selectable-text overlays in OCR benchmark | **VERIFIED synthetic**: avoids confusing text extraction with OCR |
| 5 | Check all pages of multi-page OCR input | **VERIFIED synthetic**: mixed image/blank pages refused |
| 6 | Reject detached fields in form source | **VERIFIED synthetic**: require page-attached field widget |
| 7 | Reject blank table source | **VERIFIED synthetic**: requires text or actual image paint |
| 8 | Permit raster-only table source for later Inspector measurement | **VERIFIED synthetic**: eligibility is not table accuracy |
| 9 | Block CDN-query exfiltration and unexpected browser traffic | **VERIFIED predicate tests**: local GET/HEAD and explicit OCR assets only; private browser run is **NOT_RUN** |
| 10 | Fail closed on an invalid or incomplete local corpus | **VERIFIED CLI tests**: absent means NOT_RUN; present-but-invalid means BLOCKED_INTAKE with nonzero exit |

## Local test receipt (development worktree)

- Full Vitest: **727/727 PASS**, 141 files, including added tests.
- Separate OCR/Phase 10.14 regressions: **145/145 PASS**, 34 files.
- Focused intake and egress tests: **18/18 PASS**, 3 files.
- Standalone TypeScript: PASS.
- ESLint `--quiet`: PASS (0 errors).
- Next.js 16.4.2 production build: PASS, 66/66 static pages; initial
  build in the isolated worktree failed solely because Turbopack could not
  resolve a symlinked dependency. Re-run with local dependency copy passed.
- `check:output-evidence --require-complete`: PASS, **31/31 synthetic scoped**:
  14 PASS, 17 PASS_WITH_WARNING; NOT real-document certification.
- Local private preflight: **NOT_RUN**, 0 real PDFs, `realWorldAccuracy=NOT_MEASURED`.
- Private Golden browser run: **NOT_RUN** (needs approved original files and
  independent reviewers). Physical mobile/screen reader checks: **NOT_RUN**.
- GitHub exact-commit CI and browser suite: PENDING until this branch is pushed.

**Release recommendation:** test-only draft, **NO MERGE / NO PRODUCTION CHANGE**.
Do not claim that the real-document corpus, Engine V4 Stable 0/20 gate, or
uncertain PDF-to-Excel research has been accepted.
