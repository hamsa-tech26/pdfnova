# Kukureku PDF

Kukureku PDF is a free, privacy-first PDF workspace built with Next.js.

**Live site:** https://kukureku.com

## Current capabilities

The public tool registry includes 30 PDF tools. The browser-local workspace also provides Magic Drop, Document Inspector, version history, cross-document comparison, Workspace Copilot and Package Guard. These workspace experiences are not counted as additional public numbered tools.

## Release 36 validation

`npm run benchmark:ocr:baseline` creates an explicit NOT_RUN Phase 10.14 OCR report until actual reference-document extractions are supplied. See `benchmarks/phase10_14/README.md`.

Current tools are designed to process supported files locally in the browser rather than upload document contents for server-side conversion. No account is required for the launch tools.

Learn more about the privacy model:
https://kukureku.com/guides/private-pdf-tools
