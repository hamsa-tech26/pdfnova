# Task 272 — Protect/Unlock PDF AES-256 and privacy acceptance

**DRAFT / NO MERGE / NO DEPLOY.** Test-only continuation after Task 271 compression acceptance.

## Scope
- Generate a fictional one-page PDF with three unique content markers inside ephemeral CI.
- Exercise live `/protect-pdf` with a test-only password and download the actual protected PDF.
- Independently inspect the encryption dictionary for AES-256 Standard Security Handler markers (`/V 5`, `/R 6`, `/Length 256`, `/AESV3`), verify plaintext markers/password are not present, and use PDF.js to confirm missing-password and incorrect-password rejection plus correct-password parsing.
- Feed the downloaded protected bytes into live `/unlock-pdf`, enter the same synthetic password, download the unlocked output and independently verify markers/order without a password and absence of the encryption dictionary.
- Observe only resource type/method/origin categories and outbound write-body matches for original/protected PDF bytes, base64, markers and the test password. Never log password, raw URL, request body or document bytes.
- Inject the candidate CSP only as document-scoped **Report-Only** headers; no collector or enforcement.
- Run Chromium and Linux Playwright WebKit at 390×844.

## Release and privacy boundaries
- Synthetic documents/password only; no customer files, real credentials, external storage or persistent CI documents.
- No runtime, QPDF implementation, password policy, storage or production CSP changes.
- Direct-byte/base64/password scans do not exclude transformed or encrypted egress. Linux WebKit is not physical iPhone certification.
- Keep this branch explicitly disabled for Vercel automatic deployments.

**DRAFT / NO MERGE / NO DEPLOY.** Preserve existing READY production deployment and Vercel automatic-deployment hold. Release 216 paused; Engine V4 Stable remains 0/20. No paid services or external storage.
