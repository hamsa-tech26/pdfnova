# Kukureku PDF — Releases 48–50 internal functional qualification

**Scope**: Thirty public PDF tools tested on intentionally bounded synthetic fixtures. This is a first-party functional/output acceptance baseline, **not** a third-party security or accessibility certification and **not** a guarantee for arbitrary scanned, encrypted, damaged or unusual PDFs.

## Formal evidence requirements

1. A tool gets **PASS** only when an automated browser interaction creates a downloaded artifact, an operation-specific property of the artifact is inspected, and relevant GitHub CI workflows pass.
2. **PASS_WITH_WARNING** is used when the principal documented function passed on fixtures but fidelity, supported formats, layout, OCR quality, security or compatibility boundaries remain. Warning counts **do not** mean unrestricted certification.
3. **FAILED** means the primary promised operation did not pass or no operation-specific browser export evidence exists.
4. A route being reachable, producing a success toast, or creating a parseable file alone is **not** sufficient.
5. All claims are limited to the tested fixture(s) and code revision. Review user-facing limitations separately.

## Release 48 — browser output verification

`e2e/releases48-50-certification.e2e.mjs` tests previously unqualified exports (Organize PDF, Flatten PDF, Add Image Stamp), conversion text, image resources, JPEG SOF framing, compression text, watermarks and page-number/header-footer text.

## Release 49 — error recovery, privacy and accessibility

`e2e/release49-mobile-security.e2e.mjs` checks 320px mobile overflow, keyboard focus restoration, invalid-file visibility/recovery, and repeated operations. Existing tests continue to check cancellation, no-partial-output and saved-workspace integrity. Live mobile device and screen-reader audits have not been completed.

## Release 50 — evidence and release gate

`benchmarks/tool-output-evidence.json` lists all 30 route-specific verdicts, evidence paths and limitations. CI runs `npm run check:output-evidence -- --require-complete` after unit tests. The companion browser workflow must also pass at the exact PR head. Only then may a single production deployment be released. Confirm the production SHA and HTTP responses.

### Exclusions and next acceptance programme

- OCR Engine V4 real-world benchmark and table accuracy still require independently supplied ground-truth documents.
- High raster compression, layout-intensive Word conversions and exact visual image similarity require larger real-world golden fixtures.
- The browser audit is not an independent security penetration test, WCAG conformance statement or real-phone performance study.
- A complete full-population production quality guarantee is neither claimed nor realistic.

**Do not call this an external certification.** Call it a scoped internal functional certification backed by downloadable test evidence and a versioned, limitation-aware report.
