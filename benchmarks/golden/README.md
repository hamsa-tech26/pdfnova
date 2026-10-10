# Release 51 — Golden Document Library v1

Three generated **synthetic-only** PDF fixtures, each with committed, independent expected source values:

| File | Expected ground truth |
| --- | --- |
| golden-layout.pdf | Two pages, exact selectable text, metadata, 90-degree rotation, cropped page |
| golden-form.pdf | Standard AcroForm text and checkbox values |
| golden-scan.pdf | Image-only bitmap of GOLDEN SCAN 123, with zero embedded selectable text |

Run `npm run check:golden` to regenerate and verify all PDFs. The binary fixture files and generated SHA-256 report are gitignored. CI verifies source truth and separate Playwright tests must inspect real user-facing downloads, not merely success banners.

**Limitations:** This is a synthetic regression baseline, not real-world benchmark evidence. OCR word accuracy is **NOT_MEASURED**. The Phase 10.14 V4 acceptance gate remains independent and blocked until verified. Do not commit user/customer/government documents, personal identifiers or PDF contents into GitHub.

**Next acceptance level:** Consent-based and safely sanitized real-world PDFs with independently annotated ground truth for multilingual OCR, distorted scans, multi-column tables, forms and layout preservation. Store private cases only locally, not in GitHub or Vercel artifacts.
