/**
 * Task 254: Ephemeral numeric-only viewport/aspect preflight.
 *
 * This guards against casually assuming detection XML pixels and a different
 * PDF page's point coordinates describe an identical uncropped image.
 * Matching dimensions are NECESSARY BUT NOT SUFFICIENT for actual pairing.
 * No publisher bitmap, cell content or private PDF is copied.
 */
const finitePositive = n => typeof n === "number" && Number.isFinite(n) && n > 0;

export function auditCoordinateFrame(annotation,page) {
  const aw=annotation?.imageWidth, ah=annotation?.imageHeight;
  const pw=page?.width, ph=page?.height;
  if (![aw,ah,pw,ph].every(finitePositive)) throw Error("Invalid annotation or PDF page viewport");
  const scaleX=aw/pw, scaleY=ah/ph;
  const relativeDrift=Math.abs(scaleX-scaleY)/Math.max(scaleX,scaleY);
  return {
    pdfViewportPoints: [Number(pw.toFixed(3)),Number(ph.toFixed(3))],
    publishedAnnotationPixels: [Math.round(aw),Math.round(ah)],
    scaleFactorX: Number(scaleX.toFixed(5)),
    scaleFactorY: Number(scaleY.toFixed(5)),
    relativeAspectDriftPercent: Number((relativeDrift*100).toFixed(3)),
    // 3% is a triage hint, NOT image identity or certified correspondence.
    aspectFramePlausible: relativeDrift<=0.03,
    pixelIdentityVerified:false,
    cropRotationPairingIndependentlyVerified:false,
    originalDocumentRightsApproved:false,
    independentCellTruthVerified:false,
    acceptedFormalV4Credit:0
  };
}
