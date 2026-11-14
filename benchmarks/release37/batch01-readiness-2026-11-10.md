# Engine V4 — Batch 01 source-review readiness (10 November 2026)

**Decision: PREPARATION ONLY. 0/20 independently accepted real PDFs. V4 Stable remains BLOCKED.**

This is a source-specific review queue, not a new certification, approved rights record, or ground-truth annotation. No original documents, cell text, reviewer names, or private extraction outputs are included. The first batch reuses the existing public USGS discovery pilots; it does **not** increase the distinct-document count. Release 216 remains paused. No production merge, deployment, external contact, purchase, or third-party upload is authorized by this note.

## Source triage

| Order | Original source and preliminary value | Rights/quality status | Required next source-first check | Acceptance credit |
| --- | --- | --- | --- | ---: |
| 1 | [USGS OFR 2024-1025](https://pubs.usgs.gov/publication/ofr20241025), [publisher PDF](https://pubs.usgs.gov/of/2024/1025/ofr20241025.pdf). Existing original-file pilot recorded SHA-256 `4f7e28475dfb538ca30d220ee3ca71ecec466b32de6f424de640f06d41852203`, 30 PDF pages, and five published table locations (PDF pages 14, 17, 18, 19, 20). | **HOLD — no publication-specific rights review or two independent original-PDF annotations.** The table inventory is publisher-derived metadata, not ground truth. | Check all 30 pages, embedded images/credits/third-party inclusions and PDF hash against a fresh full original; independently inventory *all* tables and cells including merged/blank slots. | 0 |
| 2 | [USGS FS 2024-3013](https://pubs.usgs.gov/publication/fs20243013), [publisher PDF](https://pubs.usgs.gov/fs/2024/3013/fs20243013.pdf), official two-page factsheet. Useful for a potential *no-table/layout negative control*, subject to visual confirmation. | **HOLD — full-PDF third-party-rights and source-first table-presence inspection absent.** Do not presume it contains, or does not contain, a table. | Inspect both source pages, references, graphics and credited material; determine whether a table exists before assigning it to a table-accuracy category. | 0 |
| 3 | [USGS SIR 2024-5103](https://pubs.usgs.gov/publication/sir20245103), [publisher PDF](https://pubs.usgs.gov/sir/2024/5103/sir20245103.pdf), official 39-page report description. | **HOLD — specific third-party illustration identified.** The publisher's PDF credits a base map to **Esri and its licensors, copyright 2013** (figure 1). The complete source cannot be treated as automatically cleared for reuse or redistribution. | Identify all non-USGS material, determine permitted private/local inspection and any necessary licenses, and record a rights decision before formal corpus intake. | 0 |

### Rights decision rule

The [USGS copyright policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) says USGS-produced material is generally public domain, **but non-USGS images and graphics can retain third-party copyrights**. The [Publications Warehouse FAQ](https://pubs.usgs.gov/documentation/faq) likewise distinguishes publisher PDFs from separately copyrighted inclusions. Therefore `rightsConfirmed` must remain `false` until an authorized person reviews each complete publication and its proposed use. The Esri credit in SIR 2024-5103 is a concrete reason for extra caution, not proof that every use of the whole PDF is forbidden.

## Minimum acceptance packet for **each** distinct complete source PDF

1. **Source identity and permitted use:** official canonical URL; original complete PDF stored privately; verified original SHA-256 and actual PDF page count; review of every third-party illustration, license notice and personal-information risk; human-signed permitted-use decision.
2. **Two blind source-first references:** separate annotators A and B independently inspect the *complete original*, identify every real table, and record every row, column, cell string, explicit empty cell, span, page and rotation. Neither reviewer may see Kukureku predictions or the other reviewer's labels while annotating.
3. **Agreement and adjudication:** `npm run v4:compare-blind -- <id>` compares separately authored private references; mismatches require original-source adjudication by an independently authorized person. Matching software output is not proof that reviewers were independent.
4. **Independent final approval:** reviewer and annotator identities/timestamps, approved reference, source hash and rights evidence are recorded privately; an approved reference must match both accepted blind annotations according to the existing strict intake rules.
5. **Actual scoring:** run `npm run benchmark:v4:corpus` on the **same complete original** and its actual Inspector output. Retain only permissible aggregate evidence outside `benchmarks/release37/private/`. A scored source is not automatically a V4 Stable pass.

**Do not** use the short diagnostic excerpts, screenshots, automated OCR transcriptions, synthetic PDF tests, public table inventory, an AI assistant's inspection, or a second hash of the same source as substitutes for an independently accepted original PDF.

## Coverage and release ledger

| Formal requirement | Observed status, 10 Nov 2026 | Next evidence |
| --- | --- | --- |
| 20 distinct real full-PDF hashes | **0 accepted**; 3 public discovery prospects | Each source packet above plus independent review |
| Native / scanned / hybrid / complex / multipage / rotated / Hindi / Bengali | **0 independently accepted in every category** | At least 2 distinct real accepted source PDFs per category; overlaps count only when independently demonstrated |
| Exact cells ≥95%, rows ≥75%, structure ≥90% per category | **Not measured from accepted ground truth** | Source-blind category scoring; include missed tables, blank cells and merges |
| Hindi and Bengali actual OCR | **Not verified**; current public OCR scope is English-only | Implement and independently validate real Hindi/Bengali recognition before certification |
| Phases 10.15–10.19; real Phase 10.14 | **Not verified** | Separately reproduced, source-linked actual evidence |
| 20–25 MiB stress, ≤512 MiB peak heap, ≤200 ms blocking, batching/cancellation, zero critical regressions | **Not verified in formal acceptance report** | Real performance and independent regression evidence |
| Release 216 | **Paused** | Remains out of scope of this source-review batch |

## Reproducible baseline checks (10 November 2026)

- `npm run test:v4:blind-pair`: **8 pass, 0 fail**. These are negative-control/synthetic software tests; **0 certification credit**.
- `npm run qualify:v4:stable`: expected exit code **1**, JSON `status: "BLOCKED"`, `documentCount: 0`, with missing category, accuracy, OCR, phase and performance evidence listed. The block is intentional and must not be relaxed to make the report green.
- The existing public five-table inventory remains `NOT_ANNOTATED`, `rightsConfirmed: false`, `acceptedDocumentCredit: 0`.

## Next executable sequence

1. **First source for independent review: OFR 2024-1025**, after full-source rights and privacy clearance. Its five publisher-listed tables make it more informative than a small no-table control. If clearance fails, retain it only as a zero-credit diagnostic and select another legitimately usable source.
2. Keep FS 2024-3013 available as a separately assessed negative-control prospect, but **do not claim table accuracy** without a real source table.
3. Keep SIR 2024-5103 on third-party-illustration rights hold. Do not redistribute its full PDF or assume the report's public status grants an Esri image license.
4. Once independent reviewers are genuinely available under an approved privacy arrangement, execute the existing private two-annotator intake; do not fabricate identities or attestations. Actual coordination with reviewers or distribution of PDF bytes is a separate authorization boundary.
5. After the first genuinely accepted full source, update this ledger from **0/20** only on actual recorded evidence and begin sourcing the remaining coverage categories. Do not announce V4 Stable until the whole strict gate passes.
