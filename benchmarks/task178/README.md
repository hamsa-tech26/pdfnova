# Task 178 — publisher-authored source truth diagnostic, not detector tuning

Production base: `85880e0181ee1e7f44990225aefe8563a3ece7a7`.

The original NLM/PMC article `PMC1064098` has four publisher-authored
HTML/JATS scientific tables. The PDF benchmark currently recognizes three
of six independently published page-image detection boxes across two full
original PMC PDFs. This diagnostic obtains article JATS from Europe PMC
ephemerally, bounds/validates exact article DOI + PMCID + CC BY license
reference, and compares distinctive JATS table-cell strings with the
browser-produced full original PDF Inspector result.

Evidence is a **content inventory**, not location or structure matching:
publisher XML and PDF versions/pixels have NOT been independently paired.
A matching word cannot establish cell location, merged-cell semantics,
page-specific alignment, or a whole table extraction. Do not credit Engine
V4 Stable (0/20) or change historical 3/6 IoU 0.5. Do not use publisher
values as runtime detector inputs. No source content leaves the ephemeral
CI runner. Only numeric counts and a SHA256 of publisher XML are logged.
If the Europe PMC host is unavailable or the source identity/licence
cannot be verified, fail and report blocked—no permissive fallback.

Acceptance: standalone positive/negative parser tests, actual real publisher
browser pilot with this source diagnostic, six-box localization results,
all existing source-safety, unit/OCR, browser and security checks.
This does **not** change the production PDF engine or XLSX export code.
No branch Vercel deployment; no merge or production action without separate
owner approval. Keep original research drafts unchanged.
