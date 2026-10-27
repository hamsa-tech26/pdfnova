Mobile-first PDF tool entry — development verification, 27 October 2026

Exact code commit: `1bfd592617424a037d2629fe68c456efbd00c2c4`.
Base: production/main `85880e0181ee1e7f44990225aefe8563a3ece7a7`.
Branch: `fix/task182-mobile-tool-entry`.

The home page now has direct Merge PDF, Compress PDF and JPG-to-PDF actions above
its secondary dashboard/catalog links. On smaller screens, the shared tool hero
uses a short privacy statement instead of four large cards. Uploader decoration
and spacing are reduced; desktop trust cards remain. Copy retains non-form merge,
local processing, file-size/count limits and qualified compression expectations.

Only layout, introduction text, browser regressions and draft documentation were
changed. Conversion/validation/download/storage code, metadata, SEO canonicals,
robots, sitemap, dependencies and security headers are unchanged. This draft is
independent of PRs #130–#133 and does not integrate their engine corrections.

Before/after local production-build observations (top of the primary action):

| Viewport | Action | Before, px | After, px |
|---|---|---:|---:|
| 390x844 | First direct home Merge link | 1905 | 371.5 |
| 390x844 | Merge file selection | 1189 | 479 |
| 390x844 | Compress file selection | 1161 | 479 |
| 390x844 | JPG file selection | 1161 | 479 |
| 320x680 | Merge file selection | 1245 | 503 |
| 320x680 | Compress file selection | 1285 | 479 |
| 320x680 | JPG file selection | 1285 | 479 |

All three home actions and target pickers fit the first viewport at 320x680,
390x844, 768x1024 and 1440x900. New tests also check >=44px action heights,
hit-testable centers, correct destinations, no horizontal overflow and keyboard
navigation into the native file chooser with original single/multiple selection.
The viewport is a CSS browser viewport, not a promise about every browser's chrome,
font scaling or physical-device safe area.

Validation of this candidate source:
- Complete unit suite: 139 files / 714 tests PASS.
- Explicit OCR and Phase 10.14 command: 34 files / 145 tests PASS.
- TypeScript and local Next.js 16.4.2 production build PASS.
- ESLint: 0 errors / 25 existing warnings.
- Complete production-build browser suite: 97/97 PASS, zero retries. Includes all
  seven new entry regressions, all-tool mobile navigation, menu/focus/theme tests,
  existing privacy/safety/redaction checks and seven XLSX controls.
- Independent manual synthetic browser downloads: 3/3 PASS. MuPDF confirms two
  source PDFs merge in order, Low compression retains native text, and two images
  become a two-page PDF with image resources. Output hashes/counts are recorded
  in mobile-audit.json. No document-body requests were observed in these bounded
  local synthetic checks; this is not a new arbitrary-document privacy guarantee.
- Registry: 31/31 synchronized. Complete output-evidence and golden checks PASS.
- Next/Vite security baselines PASS; full/production npm audits: 0 vulnerabilities.
- Formal Engine V4 Stable qualification remains BLOCKED at 0/20; this UI change
  grants no independent real-document qualification credit.

Environment: Node 24.19.0, Next 16.4.2, Vitest 4.1.12, Node Playwright 1.56.1,
installed Chromium 154.0.8037.57. Manual checks use Python Playwright 1.62.0 and
PyMuPDF 1.26.6. No Playwright-pinned browser or physical phone acceptance is
claimed. Screenshots were taken from the local production builds, not a preview
or production deployment. No field Core Web Vitals, ranking uplift or conversion
increase was measured or promised. Search Console and a free outcome-measurement
choice remain separate work. No tracking/provider/account changes are included.

Deployment safeguard: the first code commit sets
`git.deploymentEnabled["fix/task182-mobile-tool-entry"] = false`.
Remote configuration blob `2ad3aeb4b4c3943a3683a5fd16d4670107512b59` was fetched
and verified. The evidence branch is separately disabled before its first push.
No merge, deployment, paid service, Android/Smart Scanner engineering or historical
PR closure was performed. The main development source remains clean at the tested
commit. No private account traffic analytics, raw documents, reference rasters or
workbooks are included in this evidence package.

Screenshots: [before home](before-home.png), [after home](after-home.png),
[before Merge](before-merge.png), [after Merge](after-merge.png).
