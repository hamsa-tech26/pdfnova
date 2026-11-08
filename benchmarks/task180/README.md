# Page-by-page lossless redaction embedding

Base: PR #130, f4267570e893092d28e6adf185242bcc60ab3480.

The six-page, 300 dpi noisy-scan stress fixture derived from the public FBI
November 2015 report produced an 8,081 ms browser heartbeat gap during export.
This is an exploratory desktop observation, not a mobile budget or forensic
certification. The fixture is derived content, not another accepted document.

pdf-lib 1.17.1 defers PNG embedding until PDFDocument.save. Each PDFImage keeps
its decoded PNG RGB buffer until PDFImage.embed clears its embedder. With
multiple pages, the exporter therefore retains all decoded output rasters and
compresses them together at final save. The image API explicitly supports
embedding before save.

Embed each already-masked PNG within its existing page callback, then yield a
browser event-loop turn. Compression, masks, render scale, geometry, source
validation, new-document rebuild and all safety refusals are unchanged.
No lossy codec or original source image is introduced. Compressed output
streams and final PDF bytes still accumulate; this does not bound arbitrary
document memory. There is still no redaction Cancel control or AbortSignal.

Verification must compare actual browser downloads with the original PR,
including every selected/unselected raster pixel and hidden-object checks.
Record timing, sampled aggregate browser RSS and heartbeat gaps separately
from the previously demonstrated privacy properties. No preselected speed or
memory result is claimed here. Local results belong in the final task report.

The branch-disable entry is included before its first push. PRs #130 and #131
remain unchanged drafts. No merge, deployment, paid service, Android or
Smart Scanner work is authorized. Engine V4 Stable remains 0/20.
