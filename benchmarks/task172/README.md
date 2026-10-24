# Task 172 — combined development-only release candidate

Source base: draft PR #119 at 7bddef1622ffab73efb753e904ee57867c30db00.
Source XLSX: draft PR #121 at 978336878064948bee24a6a7c72a51b1481dc917.
Source redaction: draft PR #122 at e50c17140a1b9e9273b4d80b37ba49b138c19571.

## Exact file integration
- Source files from #121 and #122 are assembled as Git blobs identical to their previously reviewed heads.
- The shared validate.yml is the #121 version; #122 makes an identical modification relative to #119.
- The shared browser-smoke.yml is the #122 version, preserving the common source-head checkout and the independent PyMuPDF redaction reader.
- The dedicated XLSX workflow is #121's verified version.
- Branch deployment is disabled here from the very first published commit.
- PRs #119/#121/#122 remain unchanged; do not close or merge them.

## Mandatory fresh verification (not yet performed on combined tree)
- Complete and production dependency audits; Next.js, Vitest, Zod and Vite security baselines.
- Full unit suite (expected >= 707, not pre-credited); OCR suite (145); TypeScript, lint and production build.
- Browser reliability (expected >= 90, not pre-credited), independent XLSX roundtrip (7).
- Fractional redaction edge coverage and actual downloadable-PDF inspection for underlying data.
- Zero regression in Package Guard, backups, browser-local privacy and tool-route checks.
- Check final CI head/tree identity and compare diff with production main.

## Boundaries
Synthetic test passes do not establish full real-document quality, independent source rights, or Engine V4 Stable certification (0/20). The PDF accuracy research draft #117 is independent and remains blocked on original-source visual correspondence. Rollback execution permission is not proven by deployment listing alone. No merge or Vercel deployment may occur without separate owner approval.
