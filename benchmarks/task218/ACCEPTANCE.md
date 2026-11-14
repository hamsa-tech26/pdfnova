# Task 218 — same-origin English OCR runtime for optional PDF-to-Excel image review

**Status:** Draft candidate only. No merge or deployment authorized by this record.

## Reproduced failure on Release 215

The `R123 public opt-in image OCR` browser test reached the optional embedded-image OCR step and never displayed the editable review table. Six other PDF-to-Excel safety tests passed. The Playwright network trace showed a request to `https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js` failing with `net::ERR_EMPTY_RESPONSE` in the restricted local test network. The screen displayed only `Embedded-image OCR review failed.` This diagnoses **the observed local failure**, not a proven outage for every production user.

## Scoped remedy

- Stage the exact lockfile-installed Tesseract.js worker, three LSTM WASM variants, English trained-data archive and accompanying licenses in `/ocr-runtime/` before development or production builds. Fail the build if an expected asset is missing or empty.
- Fail the build if those ten runtime and license files exceed a reviewed **25 MiB** aggregate size budget; a dependency upgrade must undergo a fresh transfer-cost review rather than silently increasing CDN usage.
- Use `createLocalEnglishOcrWorker` for all four existing PDF V4 OCR worker call sites, with same-origin worker/core/language paths and `workerBlobURL: false`.
- Include one pinned English data package (`@tesseract.js-data/eng@1.0.0`). Its installed `package.json` declares MIT, but the linked [upstream data repository](https://github.com/naptha/tessdata/blob/gh-pages/LICENSE) displays Apache-2.0 and the installed package does not contain a standalone license file. **Follow-up provenance check:** the installed `4.0.0_best_int/eng.traineddata.gz` has Git blob SHA `730a6a59010b9440e38dd85f9fe6b6bf0637e6eb`, exactly matching [that file in the upstream `gh-pages` repository](https://github.com/naptha/tessdata/blob/gh-pages/4.0.0_best_int/eng.traineddata.gz). Its SHA-256 is `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`, now pinned at build time. The exact upstream Apache-2.0 LICENSE (Git blob `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`) is vendored and staged beside the model. This improves license provenance and notice completeness but does **not** independently resolve the inconsistent npm metadata or authorize deployment. Generated binaries are excluded from Git, not from the final website build.
- Test that every required static asset is accessible and that the real OCR-to-Excel browser flow requests no external OCR worker/model/WASM URLs.
- Keep optional image OCR, unverified table suggestions, manual cell correction, preview and explicit approval separate from automatic native-table export. No quality threshold or unsupported scan refusal was weakened.
- Disable Vercel branch deployments for `fix/task218-same-origin-ocr`.

## Bounded evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Same-origin model staging | **PASS locally** | Eleven files, 22.29 MiB including the upstream Apache-2.0 notice, within the 25 MiB guard; English model SHA-256 pinned |
| Local worker unit test | **1/1 PASS** | Option paths and blob-worker prohibition |
| Playwright same-origin asset availability | **1/1 PASS** | Worker, English language archive and selected WASM variants |
| Playwright image OCR → reviewed XLSX | **1/1 PASS** | Synthetic hybrid PDF; no external OCR runtime requests; manual review and explicit export |
| Complete PDF-to-Excel + local asset Playwright suite | **8/8 PASS** | Includes the formerly timed-out optional image OCR browser case |
| Full Vitest | **741/741 PASS** | Synthetic and unit coverage |
| TypeScript | **PASS** | `tsc --noEmit` |
| ESLint | **PASS** | Zero errors, 25 existing warnings; generated third-party OCR binaries excluded |
| Production Next.js build | **PASS** | Static OCR assets generated during `prebuild` and packaged with the site |
| Scoped production dependency audit | **PASS** | `npm audit --omit=dev --audit-level=moderate`, zero vulnerabilities |
| Tool registry | **31/31 PASS** | Existing public tool registrations unchanged |

The same PDF-to-Excel R123 test that timed out on the previous baseline completed in about 26 seconds together with the static-asset test after this change. Independent workbook safety assertions remain in place. This does not demonstrate OCR accuracy on arbitrary scans.

## Release gate and honest limitations

1. Hosted exact-head Validate, Browser Reliability, PDF-to-Excel source/roundtrip and production build must pass. Do not count a skipped source-pin test as a pass.
2. Same-origin models increase static build output by about 23 MB. Review transfer/bandwidth impact before deployment; no paid resource changes in this task.
3. English only. Hindi/Bengali accuracy and real-world recognition remain unmeasured. Apache-2.0 notices for Tesseract.js, its core and the byte-matched English trained-data archive are staged. **The npm MIT metadata versus upstream Apache-2.0 discrepancy still requires a human release/legal determination** before shipping; reproducing the upstream license and matching bytes are not formal clearance. Broader intellectual-property and independent security reviews are not claimed.
4. Formal Engine V4 Stable remains **BLOCKED 0/20** independently accepted documents. Source-recovery PR #152 and paused GSC OAuth Release 216 are not part of this branch.
5. No user PDF or credential was uploaded to any new service. Tests use generated synthetic data only.

**Disposition: DRAFT / NO DEPLOY**, preserve Release 215 production and its rollback until release checks and separate approval are complete.
