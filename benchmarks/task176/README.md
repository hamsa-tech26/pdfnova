# Task 176 — one development-only integration candidate

Baseline production: 0d42c81091617d30194a669b0c543f522065b5bd (Kukureku).

Integration sources, kept unchanged:
- Draft PR #124: `be71fb340db8ffeed46e717af6472475ec81be14`; require explicit native-PDF word origin in dense-grid recovery.
- Draft PR #125: `ceb9b96c24145a7a45a831732d91ea1e840159ec`; independently read actual USGS XLSX via openpyxl, 147 developer-transcribed source cells.

No overlap except Vercel branch-deployment configuration, manually reconciled here. All seven program/test/workflow/handoff files are exact source blobs. The integration branch and two source branches have deployments disabled.

Acceptance: fresh Validate, browser reliability, original publisher document pilot (20 cases) and security audits on exact integration head. Independent workbook reader must agree on all 147 USGS table cells from published PDF excerpts. Do not conflate this with independently reviewed, blind source-cell ground truth; Engine V4 Stable still 0/20. Missing ICDAR Sample 8/9 reference alignment and Sample 5 unreviewed prediction remain open.

Do not merge, deploy, modify production, close source PRs, pay for tools, or claim stable certification without separately authorized evidence.
