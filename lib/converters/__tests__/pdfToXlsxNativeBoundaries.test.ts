import { describe, expect, it } from "vitest";
import {
  recoverEightColumnRowsFromNativePositions,
  type NativePositionPage,
  type NativeTextToken,
} from "../pdfToXlsxNativeBoundaries";

/** Independently authored synthetic native spans. No user PDF or values. */
const guide=[109,158,218,295,394,495,598,672];
const counts=[24,33,30];
const token=(text:string,x:number,right:number,y:number):NativeTextToken=>({
  text,x,right,y,
});

function syntheticPages():NativePositionPage[] {
  let sequence=0;
  return counts.map((count,page)=>{
    const tokens:NativeTextToken[]=[];
    if(page===0) {
      for(let col=0;col<guide.length;col++) {
        tokens.push(token(String(col+1),guide[col]-3,guide[col]+3,550));
      }
      tokens.push(token("Unverified",250,300,580));
    }
    for(let i=0;i<count;i++) {
      sequence++;
      const y=525-i*12;
      tokens.push(
        token(String(sequence),90,95,y),
        token(String(4000+sequence),103,124,y),
        token("North",130,153,y),
        token("County",157,184,y),
        token("Sector",196,226,y),
        token("Beta",228,247,y),
        token("Council",261,300,y),
        token("Delta",304,330,y),
        token("Settlement",352,404,y),
        token(String(sequence),406,417,y),
        token(String(50+sequence),493,512,y),
        token(String(40+sequence),596,614,y),
      );
      if(sequence!==15)tokens.push(token("Y",672,679,y));
    }
    return {pageNumber:page+1,tokens};
  });
}

describe("Native PDF numbered guide and continuous table recovery",()=>{
  it("preserves 87 source rows in exactly eight independent data columns",()=>{
    const result=recoverEightColumnRowsFromNativePositions(syntheticPages());
    expect(result).not.toBeNull();
    expect(result?.tables).toHaveLength(1);
    const rows=result!.tables[0].rows;
    expect(rows).toHaveLength(88);
    expect(rows.every(row=>row.length===8)).toBe(true);
    expect(rows[1]).toEqual([
      "4001","North County","Sector Beta","Council Delta",
      "Settlement 1","51","41","Y",
    ]);
    expect(rows[15][7]).toBe("");
    expect(rows[87]).toEqual([
      "4087","North County","Sector Beta","Council Delta",
      "Settlement 87","137","127","Y",
    ]);
    expect(rows.slice(1).reduce((sum,row)=>sum+Number(row[5]),0)).toBe(
      Array.from({length:87},(_,i)=>51+i).reduce((a,b)=>a+b,0));
    expect(result?.reviewNotes?.join(" ")).toContain("placeholder");
  });

  it("uses headings only when all eight labels are attested above the source guide",()=>{
    const pages=syntheticPages();
    const labels=[
      token("Sl",100,109,585),token("No",111,123,585),
      token("District",145,174,585),
      token("Block",209,232,585),
      token("Name",251,277,585),token("GP/VC",289,317,585),
      token("Habitation",355,400,585),token("Name",403,427,585),
      token("households",480,533,585),
      token("FHTC",588,614,585),
      token("PVTG",663,686,585),
    ];
    pages[0].tokens.push(...labels);
    const result=recoverEightColumnRowsFromNativePositions(pages);
    expect(result).not.toBeNull();
    expect(result!.tables[0].rows[0]).toEqual([
      "Sl No","District","Block","GP/VC (IMIS)",
      "Habitation Name","Households (IMIS)",
      "FHTCs Provided (IMIS)","PVTG (Y/N)",
    ]);
    expect(result!.tables[0].numericColumns).toEqual([5,6]);
    expect(result!.tables[0].freezeHeader).toBe(true);
    expect(result!.reviewNotes!.join(" ")).toContain("Abbreviated column labels");
    const missing=syntheticPages();
    missing[0].tokens.push(...labels.filter(t=>t.text!=="PVTG"));
    const fallback=recoverEightColumnRowsFromNativePositions(missing);
    expect(fallback).not.toBeNull();
    expect(fallback!.tables[0].rows[0]).toEqual([
      "Column 1","Column 2","Column 3","Column 4",
      "Column 5","Column 6","Column 7","Column 8",
    ]);
  });

  it("uses source heading gap to separate a short group value in an uneven-width table",()=>{
    const pages=syntheticPages();
    pages[0].tokens.push(
      token("Block",209,232,580),
      token("Name",251,276,573),
    );
    const shortGroup=pages[1].tokens.find(t=>t.text==="Council");
    expect(shortGroup).toBeDefined();
    shortGroup!.text="Area";
    shortGroup!.x=244;
    shortGroup!.right=264;
    const result=recoverEightColumnRowsFromNativePositions(pages);
    expect(result).not.toBeNull();
    expect(result!.tables[0].rows[25]).toEqual([
      "4025","North County","Sector Beta","Area Delta",
      "Settlement 25","75","65","Y",
    ]);
  });

  it("separates left-aligned short values when Name and GP/VC occur in one heading",()=>{
    const pages=syntheticPages();
    pages[0].tokens.push(
      token("Block",209,232,580),
      token("Name",251,276,573),
      token("GP/VC",290,316,573),
    );
    // A fictional boundary case: a short first word begins immediately
    // after the Block column, before the midpoint of printed guide 3/4.
    const groupStarts=pages[2].tokens.filter(t=>t.text==="Council");
    const groupEnds=pages[2].tokens.filter(t=>t.text==="Delta");
    for(let i=0;i<4;i++){
      const word=groupStarts[i];
      const second=groupEnds[i];
      expect(word).toBeDefined();
      expect(second).toBeDefined();
      word.text="West";
      word.x=248;
      word.right=269.5;
      second.x=271.8;
      second.right=317;
    }
    const plan=recoverEightColumnRowsFromNativePositions(pages);
    expect(plan).not.toBeNull();
    const rows=plan!.tables[0].rows;
    expect(rows).toHaveLength(88);
    expect(rows.every(row=>row.length===8)).toBe(true);
    const repaired=rows.slice(58,62);
    expect(repaired).toHaveLength(4);
    expect(repaired.every(row=>row[3]==="West Delta" && row[2]==="Sector Beta"))
      .toBe(true);
  });

  it("refuses missing record 42 across the second page",()=>{
    const pages=syntheticPages();
    pages[1].tokens=pages[1].tokens.filter(t=>t.y!==(525-(42-25)*12));
    expect(recoverEightColumnRowsFromNativePositions(pages)).toBeNull();
  });

  it("refuses an ambiguous token crossing a column boundary",()=>{
    const pages=syntheticPages();
    const t=pages[1].tokens.find(t=>t.text==="North");
    expect(t).toBeDefined();
    t!.x=110;
    t!.right=166;
    expect(recoverEightColumnRowsFromNativePositions(pages)).toBeNull();
  });

  it("refuses missing numbered guide or conflicting guides",()=>{
    const missing=syntheticPages();
    missing[0].tokens=missing[0].tokens.filter(t=>t.y!==550);
    expect(recoverEightColumnRowsFromNativePositions(missing)).toBeNull();
    const duplicate=syntheticPages();
    duplicate[0].tokens.push(...duplicate[0].tokens.filter(t=>t.y===550)
      .map(t=>({...t,y:560})));
    expect(recoverEightColumnRowsFromNativePositions(duplicate)).toBeNull();
  });

  it("refuses a shifted status field and a noncategorical flag",()=>{
    const shifted=syntheticPages();
    const last=shifted[2].tokens.find(t=>t.text==="Y");
    last!.x=595;last!.right=610;
    expect(recoverEightColumnRowsFromNativePositions(shifted)).toBeNull();
    const corrupted=syntheticPages();
    const flag=corrupted[2].tokens.find(t=>t.text==="Y");
    flag!.text="UNKNOWN";
    expect(recoverEightColumnRowsFromNativePositions(corrupted)).toBeNull();
  });

  it("refuses incomplete, short or reordered multi-page input",()=>{
    const missing=syntheticPages();
    missing[2].tokens=[];
    expect(recoverEightColumnRowsFromNativePositions(missing)).toBeNull();
    const reordered=syntheticPages();
    reordered[1].pageNumber=3;
    expect(recoverEightColumnRowsFromNativePositions(reordered)).toBeNull();
  });
});
