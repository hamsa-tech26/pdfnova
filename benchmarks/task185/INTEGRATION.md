# Task 185 — Reviewed PDF-to-Excel integration candidate

Date: 2026-11-01

## Baseline and ownership of changes
- **Not production.** Production `main` is `1b4209a8b7deca20ee3b8d5b76ece42162c9bdf9` at preparation.
- First merge parent: mobile PR #150 exact head `606fea3563d567aa58030b5dd5f5a208cf834cc7`, verified by Validate and 99/99 browser smoke.
- Second merge parent: research PR #149 exact head `79c8aed6378ef3d5123eede038cc7292aec3c81b`, containing the stacked XLSX/OCR review work.
- Git tree uses the complete PDF-to-Excel draft source tree, overlaid with the eight non-`vercel.json` Release #141 / PR #150 mobile files (including PR #150 uploader refinement), and a union of both deployment-disable lists.
- The integration branch itself has `deploymentEnabled=false` **before the branch is published**. Source history and unrelated projects are unchanged.

## Reliability and safety intent
- Preserve the reviewed-only table classifier across table IDs and row provenance, including original fail-closed PDF-to-XLSX automatic-export rejection for uncertain, scientific or reconstructed tables.
- Source-page selection must remain browser-local, max 25 selected pages, with explicit original-page omission warnings. The original source PDF remains unchanged.
- Preserve native source words, original label strings, provenance and per-adjustment review notes. No unsupported OCR recovery or invented source labels.
- No first-hand blind certification is claimed. The publisher-pinned BLS sources reported **666/666 numeric cells** and **70/74 exact text labels** on two reports in PR #149; this is narrow publisher agreement and does not establish general reliability.
- Engine V4 Stable formal certification remains **0/20**. Reserved-source misses, OCR stress failures, footnote typography, full table semantics and independent annotation remain open.
- No payments, domain/account ownership transfer or public deployment.

## Required integrated verification (must be checked on this exact merge commit)
1. GitHub Validate (locked install, 31-tool registry, golden evidence, units/OCR, TypeScript, lint, production build, security audit).
2. GitHub Browser Reliability Smoke: full suite, real downloads, mobile 320px light/dark, keyboard picker checks.
3. Separate source-pinned BLS replay with original four files and SHA-256 verification, plus actual reviewed XLSX/download acceptance. Optional source tests may be skipped in CI if original files are absent; do not interpret skips as passes.
4. Classifier and automatic-export refusal negative tests; no weakening of strict provenance/cell quality gates.
5. Examine any CI failures and changed output. Do **not** merge/ deploy until separate release approval.

## No-go rule
Any regression in privacy, file validation, review-only eligibility or browser downloads is a blocker. This integration candidate stays a **draft** until those issues and independent review gaps are documented.

## CI routing on publication
The repo's Validate and Browser Reliability Smoke workflows listen to PRs targeting `main` (or the legacy `fix/task169-vitest-security`), not the mobile PR branch. PR #152 is therefore **draft-targeted at main for CI only** while retaining the actual two-parent integration commit. The code remains blocked on PR #150 release review, full regression verification, and explicit deployment approval. This documentation update makes the CI trigger visible and does not relax any source gate.
