# Kukureku — controlled offline development

## Scope

This is a **two-part workflow**, not an always-on unrestricted coding bot:

1. **GitHub Actions:** `Kukureku Overnight Safe Audit` checks the default branch at approximately **01:47 Asia/Kolkata, Monday–Friday**. All steps are read-only; no Vercel build/deploy, GitHub write token, secret setup, user-upload processing, or browser document corpus download.
2. **Codex Cloud:** A coding task can run on an OpenAI cloud computer **while the user's own laptop is off**, once the repository is connected to a **published Codex Cloud environment** and a task is started. This step requires the account owner to authorize the environment. GitHub Actions by itself **does not start Codex tasks**; it only runs the predefined audit.

The overnight audit runs only from GitHub's **default branch**. This proposed workflow is on a **draft PR** and will not become scheduled until the owner approves/merges the automation setup. Merging to main may trigger Vercel production deployment via existing Git integration: confirm that trade-off and obtain explicit owner approval before any merge.

## One-time Codex Cloud setup (account owner)

1. Open ChatGPT/Codex on the **web**. Start a Codex task and choose **Work in > Cloud > Select environment > Create environment**.
2. Select the existing GitHub repository **`hamsa-tech26/pdfnova`**. (Despite its repo name, this is the **Kukureku** website. Do not change the unrelated PDFNova project.) Authorize only the necessary repository permissions in GitHub.
3. Codex inspects the repo. It should discover Node.js 24, `npm ci --no-audit --no-fund`, `npm test`, `npm run lint`, and the existing PDF engine test workflows. No user-provided API keys, payment details or Vercel token are needed.
4. Review and **Publish** the environment. Do not enable paid integrations, repository-secret access or production environments.
5. Start one cloud task with the prompt below. The task can continue after the laptop is off. Review its draft PR and exact GitHub CI results afterward.

## First bounded coding assignment (paste into a Codex Cloud task)

> Work in the GitHub repository `hamsa-tech26/pdfnova` (Kukureku). Read `AGENTS.md`, [GitHub Issue #112](https://github.com/hamsa-tech26/pdfnova/issues/112), and Draft PR #111 before editing. Your sole objective is to **verify that the independently published PubTables-1M detection-reference PAGE IMAGES correspond precisely to the same original PDF page/version/crop used by our test**, using a small rights-permitted sample. Do not train, use a model API, download the multi-GB corpus, or tune detection thresholds. Build a deterministic positive/negative mapping check and unit tests. Keep raw PDFs, page images and annotations out of source control, task transcript and CI artifacts. Produce a **draft PR** with source/rights evidence and measured limits; stop if permission, licensing, data, billing or independent review is needed. Never merge, deploy, change payment/security settings, or certify V4 Stable. Report any unavailable prerequisites instead of guessing.

## Allowed autonomous actions

- Audit CI, production metadata and public HTTP status; reproduce source-only defects using existing synthetic tests or published rights-cleared materials.
- Develop on a dedicated feature branch, run bounded tests and produce a draft pull request **only if the connected coding environment permits it**.
- Record genuine source-backed findings, exact CI status and tested limitations.

## Prohibited without separate owner approval

- Merge to `main`, approve/close existing PRs, trigger any Vercel preview/production deployment, touch payment/billing, add paid APIs, change security access, install GitHub apps, change repo branch protection, upload private documents or copy API keys.
- Read/write secrets, directly upload PDF contents to external AI services, automatically correct unverifiable document values, grant **V4 Stable** certification, mark #38/#75 resolved without independent evidence.
- Self-trigger recursive bot loops, bulk download large corpora, or auto-create many PRs/issues.

## Overnight check design

- Existing native: `.github/workflows/validate.yml`, browser and original-PDF PR gates still cover pull requests.
- Scheduled: `.github/workflows/kukureku-overnight-audit.yml` handles lightweight recurring regression checks on `main` with **`contents: read`** only.
- Results: GitHub Actions run summary and compact public HTTP status codes. GitHub email notifications are user-controlled and **not guaranteed**. If the schedule is disabled after inactivity, re-enable it in GitHub Actions.
- ChatGPT Scheduled Task: if configured, checks the repo/PR/Audit progress independently, reports failures, and can prepare a narrowly scoped engineering task subject to connected capabilities and all approval limits. It is not a permanent Codex daemon.

## Acceptance

- PR CI green; branch preview disabled; no production or payment changes.
- Existing tests remain green; owner confirms merge permission for workflow activation.
- Codex environment personally authorized and published by the account owner, with one safe PR assignment demonstrated.
- No claims of unattended coding until the cloud environment and coding task really execute.
