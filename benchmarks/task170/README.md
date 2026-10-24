# Task 170: consolidated maintenance release ledger

This is the single maintenance candidate in draft [PR #119](https://github.com/hamsa-tech26/pdfnova/pull/119),
branch `fix/task169-vitest-security`. Production merge and every preview or
production deployment require separate owner authorization.

## Verified inputs and integration

On 2026-10-23, GitHub `main` was
`c55ea065a8c3435fbb7f301dde2a943c4495efc5`. Security PR #119 was
`561bd7d58d31a3dbf60739170c949b7c2fbe4aea`; Package Guard PR #120 was
`106dcfb664b09de2a0295c957bd7be385078c94f`. Both were conflict-free drafts,
with no discussion comments or unresolved review threads. Both branches
descend directly from the verified production baseline.

The two original Validate runs (39923094292, 39924314903) and Browser
Reliability runs (39923094095, 39924314879) were inspected, including job
steps and logs. Each recorded 703 unit, 145 OCR and 87 browser passes.
PR #120 still had two moderate development advisories; PR #119 cleared them.
Those individual runs are historical evidence, not combined-candidate proof.

The minimal reviewed patch from #120 is transferred onto #119 without
replaying its guard-position-only commit or duplicating its historical ledger:

- Wait for `This source PDF is saved locally in this browser.` before the
  Package Guard test leaves Magic Drop (four added lines, identical to #120).
- Retain #120's disabled branch-deployment entry, alongside the already
  disabled integration branch, before pushing.
- Preserve Vitest and its seven companion packages at 4.1.12, Next.js and
  eslint-config-next at 16.4.2, and Vite at 8.2.4.

Only the lockfile root and eight Vitest package entries differ from production.
Every unrelated lock entry is identical. Application, detector, OCR,
converter, backup, storage/privacy, limits, security scripts, CI workflows,
test timeouts/retries and all existing behavioral assertions are unchanged.
The historical #169 security ledger remains intact.

## Local combined-source verification

| Check | Result |
| --- | --- |
| Clean `npm ci --no-audit --no-fund` | PASS, 446 packages; workspace npm cache |
| Production audit, `--omit=dev --audit-level=high` | PASS, zero vulnerabilities of every severity |
| Complete audit, `--audit-level=high` | PASS, zero vulnerabilities of every severity |
| Next.js exact-version / Vite baseline checks and installed versions | PASS |
| Unit tests | 139 files / 703 tests PASS |
| Explicit OCR and Phase 10.14 unit subset | 34 files / 145 tests PASS |
| TypeScript, `tsc --noEmit` | PASS |
| ESLint | PASS, 0 errors / 25 existing warnings |
| Tool registry and scoped output-evidence completeness | PASS; 31 tools, 14 PASS / 17 PASS_WITH_WARNING |
| Synthetic golden generation and source invariants | PASS |
| Private golden/preflight/intake reports | Commands succeed; real-world evaluation NOT_RUN, zero approved documents |
| Vendored glob regression | PASS |
| Local default production build | ENVIRONMENT_BLOCKED: font network access, then sandbox denies Turbopack worker port binding |

The failed local attempts are retained in the session and are not passing
builds. The production build and complete browser suite must be verified by
the existing hosted workflows on this candidate. No source workaround,
TLS-verification bypass, audit suppression or relaxed test was introduced.

The final immutable candidate SHA, explicit TypeScript result, exact workflow
run links, checked-out merge/head tree equality, final review status, and
deployment recheck are recorded in the **Task 170 final verification ledger**
in [PR #119's description](https://github.com/hamsa-tech26/pdfnova/pull/119).
This keeps the verification receipt tied to the actual tested head without
adding a new untested commit merely to insert that commit's own SHA here.
The complete handoff and release report are also delivered to the owner.
Do not infer a passing combined browser/build result from historical #169 runs.

## Read-only release observations

Project `prj_W4Ua4X79yIH9iReSylcQu2skpYqq`, team
`team_Dgcv48JPsGPlLIrF4YXjmjqK`, is linked to the expected repository.
READY production/rollback target:
`dpl_7viFHtRoyBvrg7WUSwSjFsc4Kkji`,
`pdfnova-l8k8it97d-pdfnova.vercel.app`, baseline SHA above.
Both `kukureku.com` and `www.kukureku.com` are verified; www redirects to the
primary domain with 308. The 24-hour production runtime log/error queries
return no matching errors; this is bounded observation, not availability proof.

Ordinary deployment listing identifies the current READY deployment as a
rollback candidate and has no newer deployments. The dedicated rollback-filter
query still returns 403 on resource `deploymentRollback`, request
`bom1:sfo1::mp5kt-1792747321607-d072abd489e4`. No Vercel CLI or token binding
is configured for the documented fallback. Rollback execution permission is
NOT_VERIFIED. No actual rollback was attempted.

PR #120 remains open until the exact combined head independently passes CI.
Only then may it be documented and closed as superseded, retaining its branch
and commits. Neither PR may be merged under this task's authorization.

## Qualification boundary and next work

Existing browser coverage includes every registered route, actual PDF/DOCX/
XLSX/ZIP outputs where covered, independent openpyxl checks, browser OCR,
rotation/persistence, Magic Drop and Package Guard, backup roundtrip/tamper
rejection, mobile navigation, privacy, resource limits, refusal and recovery.
It remains fixture-specific coverage; independent real-document acceptance
for all 31 tools is incomplete. No new detector/cell accuracy or generalization
claim is made. Formal Engine V4 Stable remains **0/20**.

Research #117 stays separate. Its next source-backed investigation and the
required original/reference verification are in [PDF accuracy handoff](PDF_ACCURACY_HANDOFF.md).
