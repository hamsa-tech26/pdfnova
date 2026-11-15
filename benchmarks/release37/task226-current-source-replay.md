# Task 226 — Exact-source V4 pilot replay (QA-only)

## Purpose
Trigger the existing `.github/workflows/release37-public-pilot.yml` on the current production source baseline `b54e0822678cd3eb2a3660bd9e83d07135c600c9`, after the 14 November iOS/PDF-to-Excel/table fixes. This is a **read-only evidence run**, not an Engine V4 certification attempt and not a production release.

## Existing bounded source checks
- Download three distinct original published USGS reports through approved `https://pubs.usgs.gov/` HTTPS endpoints to an ephemeral CI runner; require actual PDF signatures, SHA-256 provenance, unique sources, maximum 25 MiB, validated page selection, and zero redistribution of PDF bytes.
- Analyze source-backed excerpts in local Chromium V4 Inspector, record only status, counts, hashes, pages and timing, and verify published-page table region shapes.
- Run the existing real USGS OFR 2024-1025 regression against its original pages 14, 17, 18, 19 and 20; check the developer-transcribed **147 source table cells** in actual XLSX output. This is a regression, not independent publisher-reference annotation.
- Assert `npm run qualify:v4:stable` remains **BLOCKED / 0 accepted distinct real documents**. Never turn synthetic or developer-led success into independent certification.
- Retain rights status `REVIEW_REQUIRED` and independent reference annotation `NOT_ANNOTATED`; no external source content or private Inspector JSON in CI artifacts.

## Exact-head acceptance decision
- Require successful Engine V4 Public Document Pilot, Validate and Browser Reliability Smoke workflows for this PR SHA.
- If an actual source fails, record which step and numerical/page metadata without logging raw text or PDF bytes; do not weaken detector thresholds, overwrite references, or claim V4 Stable.
- Continue real original-PDF rights clearance and independent, blinded reference review separately. The formal 20-document gate remains at 0/20 until accepted source-level evidence genuinely exists.

**DRAFT ONLY.** No application code change, merge, production deployment, cloud payment, branch preview, Search Console OAuth or Release 216 resume.
