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

## Task 179 reproducibility and accuracy-floor addendum

Original publisher JATS identity is now pinned to SHA256 `6ccae06bb8df38ae1d1a71119e700066202488b3417159e20e667c4ccf8c54bc`,
recorded from the first accepted PMC1064098 Europe PMC source fetch. Both
actual fetch and the hosted compare CLI must match this hash; unexpected
publisher versions fail closed. The 14-page original PDF is independently
SHA-pinned by Release 112.

The real-document pilot requires at least 2 source-authored distinct cells
matching actual reconstructed PDF `cell.text`, at least 19 source cells
remaining contiguous within an observed PDF row, and 20 within an observed
table, with exactly 37 source cell candidates and 16 substantial publisher
tokens. These source-compatible lower bounds prevent future extraction
regressions, but do not establish correct cell structure or complete source
alignment. Existing 3/6 published detection boxes remain unchanged; formal
V4 Stable stays 0/20.
