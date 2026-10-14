# Kukureku PR #65 — dependency security remediation (development only)

Date: 2026-10-15. This is a dependency-remediation record, **not** merge, production deployment, or security-exception authorization.

## Patched framework baseline

`next@16.3.8` and `eslint-config-next@16.3.8` remain pinned and aligned, preserving Next.js's patched September–October baseline and the project's original Next-specific lint rules. `scripts/checkNextSecurityBaseline.mjs` continues enforcing version alignment.

## Previously vulnerable dependency paths — remediated on draft branch

1. **GHSA-vfj7-8cjw-p6xm (HIGH), `braces@3.0.3`**: previously transitive through `@next/eslint-plugin-next -> fast-glob -> micromatch -> braces`. Inspected the upstream Next.js 16.3.8 plugin: its `fast-glob` call is the `globSync(rootDir, {onlyDirectories:true})` root-directory lookup in `utils/get-root-dirs`. The repo-local adapter `vendor/next-eslint-glob` implements **only this API** through bounded Node.js 24 built-in `fs.globSync`, deliberately rejecting other options and excessive brace nesting. The root manifest pins `fast-glob` to this local package and uses `overrides.fast-glob="$fast-glob"`, eliminating the vulnerable `fast-glob/micromatch/braces` chain without dropping the official `eslint-config-next` rules. Adapter's Node-native tests cover directory-only behavior and input limits. This is a constrained compatibility shim, **not a general-purpose replacement for arbitrary fast-glob consumers**; re-audit and extend or retire it on Next plugin upgrades.
2. **GHSA-hp3w-g68c-fv3c (MODERATE), `sprintf-js@1.0.3`**: previously transitive through `mammoth -> argparse@1.0.10 -> sprintf-js`. Root `overrides.argparse="2.0.1"` resolves Mammoth's CLI-related parser path to `argparse@2.0.1`, which does not bring in `sprintf-js`. Mammoth's conversion API availability and CLI help were exercised in isolation; all project regression tests, browser conversion and public workflows must continue to pass under the committed lockfile. Future Mammoth or argparse upgrades require revalidation.

## Verification gates

The isolated Node 24 GitHub Actions replacement probe demonstrated a reproducible `npm ci`, `npm audit --audit-level=moderate` with **zero reported vulnerabilities**, original Next.js lint PASS, TypeScript PASS, all 480 application Vitest tests PASS, and Next.js production build PASS in run #38627588682. That first successful probe applied a *temporary* dependency override and should not be conflated with validation of the eventual committed manifest/lockfile.

The permanent dependency changes are committed to PR #65. They are subject to **fresh CI on their exact final commit**, including:
- Validate: clean lockfile install, Next baseline verification, tool and evidence checks, lint, all unit and OCR Phase 10.14 regressions, build, production high audit and full high audit.
- PR65 Dependency Replacement Probe: clean install, bounded adapter tests, no `braces` or `sprintf-js` entries, full `npm audit --audit-level=moderate`, original lint, TypeScript, all unit tests, build.
- Release 57 XLSX Browser Roundtrip and Browser Reliability Smoke, including document conversion routes.

Keep full audit fail-closed; **no exception, bypass, or suppressed finding**. Report exact final-run results before release readiness.

## Spreadsheet output scope

The standard V4 export preserves all source values as literal Excel strings. Only the strongly verified eight-column reconstructed native-table case emits safely recognized household/FHTC counts as numbers; IDs and formula-like strings remain literal. One reviewed real-world document has passed structural conversion; no universal PDF-to-Excel or OCR accuracy certification is claimed.

## Approval boundary

PR #65 stays **draft** with no production/preview deployment for this remediation, no merge, no closure of other PRs, and no security policy exception without the owner's separate explicit approval.

## References

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-hp3w-g68c-fv3c
- https://github.com/vercel/next.js/releases/tag/v16.3.8
