# Next.js 16.4.6 security patch

**DRAFT / NO MERGE / NO DEPLOY.** Baseline: production source `4d41cdf36c2319f59ec8b5c35d4a999799010802`.

## Finding

The exact-head `Validate` workflow on 17 Nov 2026 failed at `npm audit --audit-level=moderate`. npm reported Next.js `16.3.0–16.4.4` affected by `GHSA-mfr8-8qww-v76h` (CVE-2026-119790), a moderate cross-root-parameter cache disclosure in a specific `'use cache'` / `unstable_cache()` concurrency pattern. The repository was pinned to `next@16.4.2` and `eslint-config-next@16.4.2`.

## Remediation

Pin `next` and `eslint-config-next` together to **16.4.6**. Next.js `16.4.5` contains the 3 Nov 2026 security fixes for seven published advisories; `16.4.6` is the subsequent Active LTS backport release and is the version npm's current audit remediation recommends. Refresh the complete lockfile rather than editing integrity hashes by hand.

## Boundaries and acceptance

- Dependency-only change; no PDF processing logic, data stores, OCR, CSP policy, document upload, or persisted user data changes.
- No user/private PDFs in CI.
- Require exact-head `Validate`, `Browser Reliability Smoke`, `npm audit --audit-level=moderate`, TypeScript, build and existing regression checks.
- Keep the Vercel branch deployment guard disabled. No preview, merge, production deployment, or Release 216 resume.
- This patch does not certify Engine V4 Stable; remain **0/20**.

## Lockfile generation receipt

The temporary lock-refresh job completed successfully on 17 Nov 2026 (GitHub Actions run [44016966132](https://github.com/hamsa-tech26/pdfnova/actions/runs/44016966132)). It ran `npm install --package-lock-only`, a clean `npm ci`, `npm ls` and `npm audit --audit-level=moderate`. The installed tree reported `next@16.4.6`, `eslint-config-next@16.4.6`, `@next/env@16.4.6` and `@next/eslint-plugin-next@16.4.6`; npm reported **0 vulnerabilities**. The complete npm-generated lockfile was committed to this branch at `ed5df6983c42775c119405526d8fff707a03e7e1`.

The temporary lock-refresh workflow is removed from the final patch. The standard repository Validate and Browser Reliability Smoke checks must now pass on the final head before this DRAFT can be considered ready.
