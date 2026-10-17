import {describe,it,expect} from "vitest";
import type {PdfParagraphBlock,PdfLine,PdfWord} from "../../model/types";
import type {ColumnCandidate,StableColumnDetectionResult} from "../stableColumnDetector";
import {recoverSparseLeftNativeCaptionColumn} from "../scopedDenseCaptionGridRecovery";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";

const firstX=56;
const anchors=[119,220,265,303,347,384,430,466,513];
const rowX=[
  [119,237,321,402,485],
  [221,266,304,349,386,432,469,514],
  [56,119,136,144,219,264,302,345,383,430,466,512],
  [119,132,138,221,264,304,347,385,430,466,512],
  [56,119,136,144,221,264,304,347,383,430,466,512],
  [119,132,138,221,264,304,347,385,430,466,512],
];
const ys=[180,161,142,129,116,102];
function makeBlock(ocr=false):PdfParagraphBlock{
  const lines:PdfLine[]=rowX.map((xs,i)=>{
    const words:PdfWord[]=xs.map((x,j)=>({
      id:"native-"+i+"-"+j,
      text:"Cell"+i+"_"+j,
      pageNumber:4,rotation:0,font:{size:8},
      extractionProvenance:ocr?{source:"ocr-tesseract",confidence:90}:undefined,
      bounds:{x,y:ys[i],width:Math.max(10,Math.min(21,anchors[1]-anchors[0]-5)),height:9},
    }));
    return {id:"physical-"+i,pageNumber:4,words,
      bounds:{x:Math.min(...xs),y:ys[i],width:Math.max(...xs)+20-Math.min(...xs),height:9},
      text:words.map(w=>w.text).join(" ")};
  });
  return {id:"caption-table-4-repro-38",type:"paragraph",pageNumber:4,
    lines,text:lines.map(l=>l.text).join(" "),confidence:0.93,
    bounds:{x:56,y:102,width:480,height:90}};
}
function column(x:number,index:number,support=5):ColumnCandidate{
  return {id:"column-candidate-"+index,x,minX:x,maxX:x,
    leftBoundary:x-16,rightBoundary:x+16,
    occurrences:support,distinctLineCount:support,averageDeviation:0,
    stability:1,confidence:0.95,accepted:true,reason:"fixture"};
}
function detection(support=2):StableColumnDetectionResult{
  return {
    columns:anchors.map((x,i)=>column(x,i)),
    rejectedCandidates:[{...column(firstX,99,support),accepted:false,
      reason:"Rejected because too few distinct lines support this position."}],
    adaptiveTolerance:6,confidence:0.93,
  };
}

describe("Release79 bounded dense native caption grid",()=>{
  it("recovers the source-supported tenth left column and preserves all six physical rows",()=>{
    const block=makeBlock();
    const recovered=recoverSparseLeftNativeCaptionColumn(block,detection());
    expect(recovered).not.toBeNull();
    if(!recovered)return;
    expect(recovered.columns.map(c=>c.x)).toEqual([56,...anchors]);
    expect(recovered.columns[0].leftBoundary).toBe(56);
    expect(recovered.rejectedCandidates).toHaveLength(0);
    const rows=detectAdaptiveRowsV4(
      {...block,id:"dense-caption-grid-"+block.id},
      recovered.columns,
    );
    expect(rows.rows).toHaveLength(6);
    expect(rows.rows.map(r=>r.lines.map(l=>l.id))).toEqual(
      block.lines.map(l=>[l.id]),
    );
    expect(rows.rows.every(r=>r.reason==="dense-native-caption-physical-line")).toBe(true);
    const table=buildSmartTableV4(4,rows.rows,recovered.columns).table;
    expect(table).toBeTruthy();
    expect(table?.rows).toHaveLength(6);
    expect(table?.columnCount).toBe(10);
    expect(table?.rows.every(row=>row.cells.length===10)).toBe(true);
  });

  it("does not change ordinary paragraphs, OCR, longer tables, or one-line hints",()=>{
    const original=makeBlock();
    expect(recoverSparseLeftNativeCaptionColumn(
      {...original,id:"ordinary-paragraph"},detection(),
    )).toBeNull();
    expect(recoverSparseLeftNativeCaptionColumn(makeBlock(true),detection())).toBeNull();
    expect(recoverSparseLeftNativeCaptionColumn(
      {...original,lines:[...original.lines,...original.lines]},detection(),
    )).toBeNull();
    expect(recoverSparseLeftNativeCaptionColumn(original,detection(1))).toBeNull();
    expect(recoverSparseLeftNativeCaptionColumn(original,{
      ...detection(),rejectedCandidates:[],
    })).toBeNull();
  });

  it("rejects a six-line region whose body has unstable column alignments",()=>{
    const original=makeBlock();
    const lines=original.lines.map((line,index)=>({
      ...line,
      words:line.words.map((word,j)=>({
        ...word,bounds:{...word.bounds,x:word.bounds.x+index*19+j*2},
      })),
    }));
    expect(recoverSparseLeftNativeCaptionColumn(
      {...original,lines},detection(),
    )).toBeNull();
  });
});
