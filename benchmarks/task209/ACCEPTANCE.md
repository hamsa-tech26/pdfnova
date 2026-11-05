# Target 209 — read-only production security and reliability watch

Base: Release 208 production commit
3726ad3529bed0e87bfc6a0b29d572e0a5a2e0b9.

This change is **monitoring only**. It does not modify PDF processing, storage,
encryption, payments, analytics, browser uploads, or the separate PDF-to-Excel
research. Real-document validation and Engine V4 Stable certification remain
deferred.

## Monitoring design

| Control | Frequency | Evidence and failure behavior |
| --- | --- | --- |
| Public website reachability | Daily at 01:43 UTC (07:13 IST); manual dispatch | GET homepage/robots/sitemap; HEAD all 31 tool routes plus privacy, trust verification and tool-selection guide. 37/37 must be 200 with expected content types. Compact seven-day artifact. |
| Public HTTP security headers | Same daily job | Enforce HSTS at least one year, nosniff, DENY framing, CSP frame/object restrictions and a restrictive referrer policy. |
| Development and production dependency advisory watch | Monday at 02:19 UTC (07:49 IST); manual dispatch | Clean lockfile install with scripts disabled, Next/Vite baseline checks, fail on any moderate+ full-tree npm advisory; separate production high+ audit. |
| Pull-request regression | When the monitor/workflow changes | Monitor script unit tests are part of the normal Vitest suite; the public HTTP and weekly audit workflows also run when their sources change. |

Both jobs use public URL metadata only, read-only repository permissions and
standard public-repository GitHub-hosted runners. They do not send user files,
cookies, query strings, authentication headers or other private input.
They do not auto-merge, auto-update dependencies, roll back or deploy.

The scheduled check is **not** a 24-hour uptime SLA. GitHub scheduled events
can be delayed/dropped under load and may be disabled after 60 days of inactivity
in a public repository. Workflow failure is visible in the GitHub Actions tab;
individual email/push notifications depend on account notification settings.

## Local verification

- Clean npm ci: **447 packages installed**.
- Live read-only external probe against Release 208: **37/37 HTTP paths PASS**,
  **5/5 required security-header checks PASS**.
- npm complete dependency audit: **0 reported vulnerabilities**.
- Full Vitest unit baseline: **720/720 PASS**, 139 files.
- Targeted monitor Vitest: **8/8 PASS**.
- TypeScript and ESLint --quiet: **PASS** (no errors).
- Production Next.js build: **PASS**, 67/67 static routes.
- OCR/Phase 10.14 regressions: **145/145 PASS**, 34 files.
- Tool registry: **31/31 PASS**.
- GitHub exact-head workflows: **pending published PR**.
- YAML parsed with an independent YAML parser; daily and weekly cron triggers,
  manual trigger, and pull-request trigger present.

## Response runbook

1. Check the latest **Public Domain Reachability Audit** or
   **Weekly Dependency Security Watch** result in GitHub Actions.
2. For a failure, preserve the compact report, then retry manually once
   after a short interval. Do not mark a timeout or 429 as healthy.
3. For repeated HTTP failures, verify the exact Vercel production commit,
   READY state, aliases and recent runtime errors. Keep the previously READY
   deployment available for rollback; no automatic rollback is configured.
4. For header regressions, inspect production security headers before relaxing
   any check. For advisory failures, review the specific dependency path and
   official advisory, then fix in a separate PR with full tests.
5. Escalate critical or persistent failures to the owner for an explicit
   rollback or release decision. Do not publish user documents in evidence.

**Not established by these checks:** actual PDF processing correctness on
real documents, live upload/download post-release, third-party penetration
testing, guaranteed notifications, or zero future vulnerabilities.
