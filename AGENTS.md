<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Kukureku unattended coding safety

This repository is the **Kukureku** live PDF-tools website despite the historical GitHub repository name `pdfnova`. Do not modify the separate PDFNova project.

- Prefer one small, bounded, source-backed change per coding task; create a feature branch and **draft pull request** with CI evidence. Never merge, deploy or close existing PRs autonomously.
- Do not modify Vercel production, feature-branch deployment settings, billing, payment processing, authentication, secrets, CI permissions, or install paid services without explicit owner approval.
- Treat PDFs and original document contents as private unless source rights are verified. Never place user PDFs, extracted words, OCR transcripts, original page images, reference XML or credentials into code commits, CI artifacts, external model requests, or logs.
- Read the actual independent source before reporting PDF table accuracy. The current 20-PDF PubTables detection comparison is **not cell-level V4 certification**, and publisher PAGE-IMAGE/PDF pixel identity is not independently verified. Do not convert provisional numbers into verified accuracy claims.
- Keep PDF Engine V4 Stable **blocked** until independent 20-document cell references, rights, multilingual OCR, stress/performance, and all qualification gates pass. Synthetic fixtures alone do not count.
- Do not bypass or weaken negative tests/thresholds to obtain a green CI result. If a test fails, inspect its source and explain the failure; do not invent reference answers.
- Use GitHub Actions' existing free runners within bounded jobs; do not install unbounded schedulers, automatic pull-request loops, external SaaS/AI billing or data exfiltration.
- Review `docs/automation/kukureku-offline-development.md` for offline-work authorization boundaries and issue #112 for the first source-alignment assignment.
