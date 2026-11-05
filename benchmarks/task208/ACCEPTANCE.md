# Target 208 — development dependency security audit

Base: production Release 207, main commit
`b4128f98754be99f5dfcae6af126b479a34ffc8f`.

This branch is **deployment-disabled**. It does not change PDF processing,
user documents, upload retention, encryption, public APIs, billing, or the
separate PDF-to-Excel research. Independent real-document verification and
Engine V4 Stable certification are deferred.

## Root cause

The Release 207 full-tree npm audit found **eight moderate** transitive
advisory entries caused by one vulnerable development dependency:
`minimatch@10.2.6`, nested beneath
`@typescript-eslint/typescript-estree@8.65.0` and surfaced through the
TypeScript ESLint/Next.js tooling chain. The primary advisory is
`GHSA-g3hv-75wg-m249` (globparts amplification / denial of service).
Its patched version is `minimatch@11.0.1`.

`npm audit fix --force` proposed a major downgrade to
`eslint-config-next@15.5.29`; that was **rejected** because the application
must keep Next.js and `eslint-config-next` aligned at `16.4.2`.

## Scoped remediation

- Override only the `minimatch` dependency of
  `@typescript-eslint/typescript-estree` to exact `11.0.1`.
- Update the lockfile to the patched dev-only package plus its required
  dev-only `@isaacs/nonrecursive-glob-match` dependency.
- Retain the existing pinned Next.js, Vite, React, engine and registry
  baselines unchanged.
- Tighten full-tree `Validate` CI from high/critical to **moderate and above**
  advisories; keep its existing production audit and checks.
- Explicitly disable preview deployment for
  `fix/task208-development-audit`.

## Verification record (local, clean `npm ci`)

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS, 447 packages installed |
| `npm audit --audit-level=moderate` | PASS, **0 vulnerabilities** (before: 8 moderate) |
| `npm ls minimatch @typescript-eslint/typescript-estree --all` | PASS, targeted `minimatch@11.0.1 overridden` |
| `npm test -- --reporter=dot` | PASS, **715/715** across 139 files |
| OCR + Phase 10.14 targeted Vitest | PASS, **145/145** across 34 files |
| TypeScript `npx tsc --noEmit` | PASS |
| `npx eslint . --quiet` | PASS, no errors (legacy worker warning only) |
| Next/Vite pinned security baseline scripts | PASS |
| 31-tool registry check | PASS |
| `node --test vendor/next-eslint-glob/index.node.cjs` | PASS, 2/2 |
| Next.js production build | PASS, 67/67 static routes |
| Exact-head GitHub Validate / Browser Reliability | Pending draft PR and CI |

An audit is not a guarantee of freedom from future vulnerabilities. The
full audit must be rerun on the **exact published head** before merge or
deployment. No production deployment is authorized by this evidence ledger.
