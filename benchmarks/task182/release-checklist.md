PR #141 — prepared release checklist

Candidate: b70fb04d1b214d9002185350d9463b5edc32dca6.
This checklist is preparation, not authorization to merge or deploy.

Completed before release:
- Final self-review of the diff, small-screen readability, file-limit visibility,
  keyboard entry, direct navigation and unchanged conversion/privacy handlers.
- Confirmed label contrast issue corrected; default light ratio about 6.94:1.
  Screenshot regressions cover both themes and hover, targeting >=4.5:1.
- Three-tool traffic baseline frozen privately from the connected Vercel audit.
  Source date-window rounding and missing conversion events remain explicit.
- Code and evidence branches deployment-disabled before their first pushes.
- Screenshots, test receipts and exact code commits recorded separately.

Required release gates:
1. Confirm Validate and Browser Reliability are green for the exact candidate,
   with no unaddressed review threads. The dependency probe is intentionally
   skipped; a skipped optional probe is not a passing test.
2. Obtain explicit owner authorization for both merge and production release.
   The earlier no-merge/no-deployment restriction remains active. Merging main
   may trigger the existing Git deployment integration; do not treat merge as
   an innocuous metadata step or enable previews to circumvent the restriction.
3. Immediately before release, read the current production commit/deployment
   and preserve the exact previous READY deployment for a possible rollback.
   The last audited production source was 85880e0181ee1e7f44990225aefe8563a3ece7a7;
   do not assume that remains current indefinitely.
4. Perform only the approved release, then verify the resulting deployment's
   source matches the approved change. Do not promote an unrelated preview.

Post-release acceptance, only after release authorization:
- Confirm public 200 responses and correct canonical metadata for home, Merge,
  Compress and JPG-to-PDF; robots/sitemap must retain existing protections.
- On 320px and 390px screens, verify all three direct home links and file pickers
  fit the initial viewport; check keyboard focus, file limits and both themes.
- Download three synthetic outputs and independently verify merge order,
  preserved native text in Low compression and image/PDF page counts.
- Check privacy/network behavior using synthetic files, not user documents.
- Confirm no new runtime failure or layout regression. If a rollback is needed,
  use the specifically authorized prior READY deployment, without unrelated
  configuration changes or historical PR closures.
- Run physical iOS Safari and Android Chrome acceptance when devices are
  available. Browser emulation is not physical-device qualification.

Search and growth measurements:
- Search Console is not connected. The owner can supply an exported Performance
  report from an existing verified property (last 28 complete days; Pages,
  Queries, Dates and Devices with clicks/impressions/CTR/position), or connect
  an authorized read-only data source. Do not ask for passwords or tokens.
- Filter the three canonical tool URLs; check indexing/sitemap coverage. Do not
  assume absent access means zero impressions, or use web-search snippets as
  Search Console evidence. No DNS edits, property creation or sitemap submission
  is authorized by this checklist.
- Compare matched completed weekly windows after release; preserve release date,
  source commit, devices and referrers. Do not sum overlapping visitor groups or
  infer conversion/session paths from pageview counts.
- No custom events are recorded today. Vercel custom events require Pro or
  Enterprise, so they remain excluded under the no-paid-services restriction.
  A free, privacy-reviewed measurement destination is a separate decision.
  Local QA events are not production funnel evidence. Distinguish export
  completion from download initiation; neither proves a user saved/read a file.
- Never send document bytes/text, filenames, passwords or raw exception messages
  to analytics. No numeric traffic uplift is promised from the small baseline.

Separate unresolved engineering scope:
- The four real PDF-to-Excel coverage failures and complete independent reference
  review remain unresolved. PR #141 does not integrate the engine drafts or
  weaken their refusal/qualification gates. Engine V4 Stable remains unverified.
