import type {LogicalTable} from "../model/logicalTable";
import type {PdfPageModel,PdfBoundingBox} from "../model/types";
import {listManuallyReviewableImageRegions} from "../ocr/embeddedImageRegionPlanner";

/**
 * R150: identify concrete, opt-in review targets when a source-native
 * caption/header scientific table ends next to independently painted images.
 *
 * This is deliberately NOT a logical table extension, table-cell detector,
 * OCR decision, automatic XLSX admission, or source-certified continuation.
 * Original native table boundaries and all extracted words remain unchanged.
 * Only PDF-native geometry and pre-existing manual image eligibility count.
 */
export type ScientificRasterReviewTarget={
  tableIndex:number;
  pageNumber:number;
  imagePaintIndex:number;
  relationship:"below-native-region"|"overlaps-native-region";
};

const valid=(b:PdfBoundingBox)=>[b.x,b.y,b.width,b.height]
  .every(Number.isFinite)&&b.width>0&&b.height>0;

export function findNativeScientificRasterReviewTargets(
  pages:readonly PdfPageModel[],
  tables:readonly LogicalTable[],
):ScientificRasterReviewTarget[]{
  const found:ScientificRasterReviewTarget[]=[];
  for(let tableIndex=0;tableIndex<Math.min(100,tables.length);tableIndex++){
    const table=tables[tableIndex];
    if(!table||!valid(table.bounds)||!table.rows.some(row=>
      row.provenance?.blockId?.startsWith("native-caption-header-grid-")))
      continue;
    const pageNumbers=[...new Set(table.rows.map(row=>
      row.provenance?.pageNumber??table.pageNumber))];
    for(const pageNumber of pageNumbers){
      const page=pages.find(p=>p.pageNumber===pageNumber);
      if(!page||page.textExtraction.status!=="sufficient")continue;
      let count=0;
      for(const image of listManuallyReviewableImageRegions(page)){
        const r=image.sourceBounds,t=table.bounds;
        if(!valid(r))continue;
        const horizontal=Math.max(0,Math.min(t.x+t.width,r.x+r.width)-
          Math.max(t.x,r.x));
        if(horizontal/Math.min(t.width,r.width)<0.45)continue;
        const gap=t.y-(r.y+r.height);
        const vertical=Math.max(0,Math.min(t.y+t.height,r.y+r.height)-
          Math.max(t.y,r.y));
        const overlaps=vertical/Math.min(t.height,r.height)>=0.15;
        if(!overlaps && !(gap>=0&&gap<=75))continue;
        found.push({tableIndex,pageNumber,imagePaintIndex:image.imagePaintIndex,
          relationship:overlaps?"overlaps-native-region":"below-native-region"});
        if(++count>=2)break;
      }
    }
  }
  return found;
}
