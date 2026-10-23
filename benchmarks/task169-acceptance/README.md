# Task 169: Package Guard browser persistence race

Base: production `c55ea065a8c3435fbb7f301dde2a943c4495efc5`.
Separate from the Vitest remediation in draft PR #119.

## Reproduction and root cause

A production-build browser run failed at the first `Run Package Guard` click
after uploading `package-application.pdf` in Magic Drop and immediately using
hard navigation. Its snapshot shows `No workspace package yet`. The test
upload helper only waits for `setInputFiles`; that does not await the async
IndexedDB source save. Leaving the page can abandon that save.

## Bounded correction

`e2e/reliability-smoke.e2e.mjs` now waits for the existing source-save UI signal
before navigating to Package Guard, matching other workspace handoff tests.
The strict BLOCKED and integrity-only READY assertions, finding/link/snapshot
checks, timeouts and retry settings are unchanged. No application code,
detector, OCR, converter, privacy logic or certification threshold changed.
`vercel.json` disables this branch before its first push.

## Verification ledger

| Item | Result |
| --- | --- |
| Original local production-build test | FAILED: empty workspace after immediate navigation |
| Corrected test, three fresh browser contexts, no retries | 3/3 PASS, 9.2 seconds total |
| Server under test | Local Next.js 16.4.2 production build; application bytes unchanged from base |
| Corrected source file ESLint / whitespace | PASS |
| Real-world original PDF qualification | NOT_VERIFIED; this input is synthetic |

This is a test synchronization correction, not a claim to repair a production
data-loss defect or complete all 31 tools' real-world acceptance. The source
document remains browser-local. No merge or deployment is authorized. Formal
Engine V4 Stable remains 0/20. Hosted results and commit links are in the PR.
