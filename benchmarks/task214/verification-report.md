# Release 214 — Public content accuracy and mobile discovery

Date: 2026-11-07 (IST)

Base: production `main` at `203489fbe86aedf4771581e61b74136f791bd9e7` (Release 212).

## Changes

1. The homepage, About page, Press & Directory Kit, private-PDF guide, and social preview now derive current tool counts from `TOOL_SEO` through `PUBLIC_TOOL_COUNT`.
2. About lists all 31 registered tool names as direct, keyboard-accessible links, including PDF to Excel. This replaces the incomplete 30-name hardcoded list.
3. The Press page no longer contradicts itself with current counts of 10 and 30. Structured `dateModified` was updated to match the content revision.
4. The private-PDF guide names the current 31-tool catalog, retains ten introductory examples, and links to the complete catalog. The Trust Center's **historical** original-ten-tool processing matrix remains deliberately unchanged.
5. Updated priority SEO metadata for Merge PDF, Compress PDF, and PDF to Word, retaining explicit limits and without promising perfect compression or scanned-PDF conversion.
6. Added the current tool count to the mobile homepage, since the previous count appeared only in a desktop-only panel.
7. Updated the tool registry checker to accept a count derived from the checked registry while continuing to reject incorrect literal counts.

## Validation receipts

| Check | Outcome |
| --- | --- |
| `npm test` | PASS — 142 test files, 737 tests |
| `playwright test e2e/public-content-accuracy.e2e.mjs e2e/mobile-navigation.e2e.mjs` | PASS — 13 browser checks |
| `npm run build` | PASS — Next.js 16.4.2, TypeScript pass, 69 static routes |
| `tsc --noEmit` | PASS |
| `npm run check:tools` | PASS — 31 registered routes synchronized |
| Targeted ESLint | PASS — zero warnings/errors in modified/new source files |
| Full ESLint | PASS — zero errors; 25 pre-existing warnings outside this change |
| `git diff --check` | PASS |

Browser checks cover 320px/375px navigation, mobile menu accessibility, the exact 31 About-page links, public-page consistency, mobile horizontal overflow, and the three priority page metadata values. They test local development behavior, not live production and not Google search ranking.

## Boundaries and release decision

- This is a content/SEO clarity improvement, not an assertion that Google has indexed every tool or that all engine workflows have reached independent certification.
- No Google Search Console user token or credential was required or introduced. Release 213 OAuth authorization remains pending the owner's laptop.
- No billable service, payment integration, or document-upload feature was added.
- Production is unchanged until this branch is reviewed, merged, and deployed. Preserve the existing READY production deployment as the rollback reference.
