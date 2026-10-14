# Kukureku PR #65: pre-release dependency security review

Date: 2026-10-15. Scope: **development branch only**. This document is not a release waiver.

## Next.js security baseline

- `next` and `eslint-config-next` are **both pinned to 16.3.8** in `package.json` and `package-lock.json`.
- 16.3.8 is the patched release for the September/October 2026 advisories affecting Next.js versions below 16.3.8, including cache poisoning and image optimization SSRF.
- A CI guard (`node scripts/checkNextSecurityBaseline.mjs`) fails on an older or mismatched version, or if the manifests/lockfile disagree.
- Next.js 16.4.0 is a newer stable feature release, but **not needed to fix the identified Next.js advisories**. A framework change is not a security fix for a vulnerable third-party `braces` package and should not be conflated with one. No unnecessary major/downgrade or lockfile churn is authorized here.

References:
- https://github.com/advisories/GHSA-4jqv-mc3x-m676
- https://github.com/advisories/GHSA-cjq9-62q9-8jv4
- https://github.com/vercel/next.js/releases/tag/v16.3.8

## Residual transitive vulnerabilities

The 2026-10-14 existing-branch GitHub Validate run #38586879158 found:

1. **High — GHSA-vfj7-8cjw-p6xm (`braces@3.0.3`)**: only dev tooling in the locked tree. Path: `eslint-config-next@16.3.8 → @next/eslint-plugin-next@16.3.8 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`. The advisory covers **all released versions through 3.0.3 and lists no patched version**. Upgrading `eslint-config-next` to another version that still uses this dependency does not cure the underlying advisory. Force-downgrading the ESLint Next configuration to 14.x is incompatible with the 16.x framework and unacceptable. The production npm install (`npm audit --omit=dev --audit-level=high`) did not flag a high/critical issue in that snapshot. This does *not* mean the full dependency tree is secure.
2. **Moderate — GHSA-hp3w-g68c-fv3c (`sprintf-js@1.0.3`)**: `mammoth@1.13.0 → argparse@1.0.10 → sprintf-js@1.0.3` (part of the production dependency graph). The advisory has no patched release at the time of the review; npm recommends a breaking Mammoth downgrade. No arbitrary npm audit force fix, insecure replacement, or suppression was applied.

References:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-hp3w-g68c-fv3c

## Enforced build gates and release decision

- GitHub Validate runs `npm ci`, Golden preflight, tool output evidence, `npm run lint`, all unit tests, explicit OCR and Phase 10.14 regressions, Next build, Next/ESLint alignment and patched minimum verification, and **both** npm dependency audits.
- `npm audit --omit=dev --audit-level=high`: high/critical production threshold must pass; moderate advisories remain visible in output.
- `npm audit --audit-level=high`: full graph remains a **failing gate** if the dev-only `braces` advisory is still present. A nonzero audit result must never be hidden as green. The check runs `if: always()` even when earlier steps fail.
- Do **not** claim a green full security audit, or merge/release PR #65, merely because non-security CI and real-world XLSX extraction passed.
- Next steps: seek an upstream `braces` fix or replace the vulnerable ESLint dependency chain without reducing lint coverage, and separately evaluate Mammoth/sprintf in a controlled compatibility test. A narrowly scoped, time-limited *risk acceptance* would require separate **explicit owner approval** and proof the path is dev-only/unreachable from end-user PDF inputs; **no exception has been approved in this PR**.

## Spreadsheet output security and accuracy

The standard V4 export keeps source data as literal strings. In only the conservatively reconstructed, strongly verified eight-column native-PDF layout, two explicitly recognized metrics (households/FHTC) are emitted as safe numeric Excel integers. Identifiers, leading-zero values and formula-like content stay literal strings; no PDF formulas are executed. One independent real-world document was checked, but that is not a general accuracy certification. Heading inference and all numeric values still require review against source PDFs.

## Authorization boundary

This document and associated code changes were made in draft PR #65 only. No preview/production deployment, merge, branch cleanup or old-draft closure is authorized by this review.
