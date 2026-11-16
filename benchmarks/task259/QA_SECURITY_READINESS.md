# Task 259 — consolidated QA and security readiness (not Release 216)

**DRAFT / NO MERGE / NO DEPLOY**. The base of this integration is the deployed source `4d41cdf36c2319f59ec8b5c35d4a999799010802`, with QA-only changes. Existing pull request #215 already unifies synthetic downloaded-file verification from PRs #207, #212, #213 and #214.

## Newly integrated independent evidence

| Source | Changed content | Source exact-head CI before integration |
|---|---|---|
| PR #217, Task 253 | 33 public routes' response-header baseline (homepage, 31 tools, Workspace Health), security documentation and workflow | 3/3 substantive checks PASS |
| PR #220, Task 257 | Browser-only report-only candidate CSP evaluation using fictional PDF-to-Excel input, no policy enforcement or external reports | 3/3 substantive checks PASS |

Both sources' changes are included as source blobs on the combined head; the duplicate branch `vercel.json` guards are merged rather than overwritten. **Require independent exact-head Validate, Browser Reliability Smoke, 9 output-fidelity flows, production header baseline and report-only CSP observation.** A previously green source PR is not equivalent to a green combined PR.

## Release and security constraints

- No runtime Next.js, API, data stores, OCR engines, certificate configuration, or production CSP values are modified here. Candidate CSP logs blocked script/connection origins in aggregated form, but a single Chromium route does not establish full tool compatibility.
- Production stays the previously READY deployment, no new preview, merge, manual deploy or autopublish. Release 216 remains **PAUSED**.
- Existing `frame-ancestors`/base/object/form CSP guards are enforced; script/connect/worker resource policy needs separate 31-tool compatibility verification. Report-only observations are not an enforced security improvement.
- Security claims must not exceed observed evidence; no customer PDF data, private files, or raw PDF contents in CI artifacts.
- Engine V4 formal documents remain **0/20**; Task 254's source-coordinate investigation is separate. Three of six published PubTables detection boxes remain unmatched at unchanged IoU >=0.5.
- Team billing allocation, final invoice, credits and spend cap are not yet independently reconciled. Skipping Vercel automatic builds does not waive Pro subscription charges.
- Preserve source PRs open until the integrated PR is merged and release reviewed; no source PR is declared superseded for traceability merely by opening this draft.

The next practical blocker after exact-head CI is verifying a truly compatible CSP across all routes and independent 20-document V4 qualification evidence; Release 216 is **NO-GO** until independently approved.
