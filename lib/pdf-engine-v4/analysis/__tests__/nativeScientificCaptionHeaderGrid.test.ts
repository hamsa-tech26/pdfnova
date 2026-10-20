import {describe,expect,it} from "vitest";
import {findNativeCaptionHeaderScientificGrids} from "../nativeScientificCaptionHeaderGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {detectStableColumnsV4} from "../stableColumnDetector";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";
const ys=[701.3,682.4,673,654.7,647.8,640.7,622.6,615.6,
  601.1,586.6,572.1,557.6,550.6,536.1,521.6,505.7,488];
function line(i:number,points:readonly [number,string][]):PdfLine{
  const y=ys[i];
  const words:PdfWord[]=points.map(([x,text],j)=>({
    id:"source-"+i+"-"+j,text,pageNumber:8,
    bounds:{x,y,width:Math.min(205,Math.max(8,text.length*3.6)),height:9},
    font:{size:9},rotation:0,extractionProvenance:{source:"native-pdf"},
  }));
  return {id:"line-"+i,pageNumber:8,words,
    bounds:{x:Math.min(...words.map(w=>w.bounds.x)),y,
      width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-
        Math.min(...words.map(w=>w.bounds.x)),height:9},
    text:words.map(w=>w.text).join(" ")};
}
function fixture():PdfParagraphBlock{
  const lines:PdfLine[]=[
    line(0,[[57,"Table 7. Scientific observations"]]),
    line(1,[[57,"Source description and data provenance"]]),
    line(2,[[57,"Recorded conditions and reference explanation"]]),
    line(3,[[61,"Parameter"],[163,"Condition A source"],[262,"Condition B source"],[352,"Supplementary scientific outcome text"]]),
    line(4,[[162,"Reference group"],[255,"Treatment group"],[358,"Comparative group"]]),
    line(5,[[158,"Native header third line"],[254,"Group controls"]]),
    line(6,[[61,"1 (12.2)"],[96,"1"],[102,"(3)"],[182,"101.22"],[282,"12.2"],[352,"104.3"]]),
    line(7,[[358,"3.5"],[375,"("],[382,"103.4"],[458,".5"],[475,")"]]),
    line(8,[[61,"2 (12.5)"],[122,"("],[128,"3.7"],[182,"102.2"],[269,"15.8"],[305,"("],[311,"9.1"]]),
    line(9,[[61,"3 (11.2)"],[124,"("],[130,"3.7"],[182,"103.3"]]),
    line(10,[[61,"4 (13.2)"],[124,"("],[130,"3.7"],[182,"103.3"]]),
    line(11,[[61,"5 (10.2)"],[124,"("],[130,"3.7"],[182,"103.3"],[269,"15.8"],[305,"("],[311,"9.1"],[352,"102.2"]]),
    line(12,[[358,"4.2"],[376,"("],[382,"89.1"]]),
    line(13,[[61,"6 (10.2)"],[124,"("],[130,"3.7"],[182,"103.3"]]),
    line(14,[[61,"7 (11.2)"],[124,"("],[130,"3.7"],[182,"103.3"]]),
    line(15,[[61,"Notes about the underlying data"]]),
    line(16,[[57,"8"],[315,"8"]]),
  ];
  return {id:"native-source",type:"paragraph",pageNumber:8,lines,
    bounds:{x:57,y:488,width:500,height:222},
    text:lines.map(l=>l.text).join(" "),confidence:.9};
}
describe("R145 bounded native scientific caption-and-header segmentation",()=>{
  it("removes source caption/preamble/footnotes without dropping or duplicating words",()=>{
    const src=fixture();
    const found=findNativeCaptionHeaderScientificGrids([src]);
    expect(found).toHaveLength(1);
    expect(found[0].firstLineIndex).toBe(3);
    expect(found[0].lastLineIndex).toBe(14);
    expect(found[0].block.lines).toHaveLength(12);
    expect(found[0].block.bounds.y).toBe(521.6);
    expect(found[0].block.bounds.y+found[0].block.bounds.height).toBeCloseTo(663.7);
    const detected=detectTableRegionsForPage([src]);
    const nativeRegion=detected.tableRegions.find(t=>
      t.block.id.startsWith("native-caption-header-grid-"));
    expect(nativeRegion).toBeDefined();
    const columns=detectStableColumnsV4(nativeRegion!.block);
    expect(columns.columns.length).toBeGreaterThanOrEqual(4);
    const rows=detectAdaptiveRowsV4(nativeRegion!.block,columns.columns);
    expect(rows.rows).toHaveLength(12);
    expect(rows.rows.every(row=>
      row.reason==="native-scientific-caption-physical-line-review")).toBe(true);
    const table=buildSmartTableV4(8,rows.rows,columns.columns).table;
    expect(table?.rows).toHaveLength(12);
    const out=table?.rows.flatMap(row=>row.cells.flatMap(c=>c.words))??[];
    const sourceWords=nativeRegion!.block.type==="paragraph"?
      nativeRegion!.block.lines.flatMap(l=>l.words):[];
    // Cell analysis intentionally splits leading "1 label" tokens into
    // "-serial" + "-content" fragments. Verify every source token is
    // reconstructed once, not merely a matching total fragment count.
    for(const sourceWord of sourceWords){
      const tokens=out.filter(w=>w.id===sourceWord.id||
        w.id===sourceWord.id+"-serial"||
        w.id===sourceWord.id+"-content");
      const direct=tokens.filter(w=>w.id===sourceWord.id);
      const fragments=tokens.filter(w=>w.id!==sourceWord.id);
      if(direct.length===1){
        expect(fragments).toHaveLength(0);
        expect(direct[0].text).toBe(sourceWord.text);
      }else{
        expect(direct).toHaveLength(0);
        expect(fragments.map(w=>w.id).sort()).toEqual([
          sourceWord.id+"-content",sourceWord.id+"-serial",
        ]);
        expect(tokens.map(w=>w.text).join(" ")).toBe(sourceWord.text);
      }
    }
    expect(out.every(w=>sourceWords.some(sourceWord=>
      w.id===sourceWord.id||w.id===sourceWord.id+"-serial"||
      w.id===sourceWord.id+"-content"))).toBe(true);
    const ids=detected.regions.flatMap(r=>
      r.block.type==="paragraph"?r.block.lines.flatMap(l=>l.words.map(w=>w.id)):[]);
    const expected=src.lines.flatMap(l=>l.words.map(w=>w.id));
    expect(ids).toHaveLength(expected.length);
    expect(new Set(ids)).toEqual(new Set(expected));
  });
  it("does not promote an uncaptioned or caption-only narrative",()=>{
    const noCaption=fixture();
    noCaption.lines[0].text="Introduction and discussion";
    expect(findNativeCaptionHeaderScientificGrids([noCaption])).toHaveLength(0);
    const narrative=fixture();
    for(let i=6;i<=14;i++)narrative.lines[i]=line(i,[[61,"Long scientific narrative paragraph without aligned numeric columns"]]);
    expect(findNativeCaptionHeaderScientificGrids([narrative])).toHaveLength(0);
  });
  it("rejects source OCR mixtures and unstable underlying row anchors",()=>{
    const mixed=fixture();
    mixed.lines[8].words[0].extractionProvenance={source:"ocr-tesseract"};
    expect(findNativeCaptionHeaderScientificGrids([mixed])).toHaveLength(0);
    const drifting=fixture();
    for(let i=8;i<=14;i++)for(const w of drifting.lines[i].words)
      w.bounds.x+=i*11;
    expect(findNativeCaptionHeaderScientificGrids([drifting])).toHaveLength(0);
  });
});
