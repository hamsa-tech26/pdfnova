import {describe,it,expect} from "vitest";
import {describeNativePairedGroupHeaders} from "../nativeGroupedHeaderGuide";

const first=["Chromosome","Jonathan","","Golden Delicious","","Consensus",""];
const second=["/linkage group","No. of makers","Length(cM)",
  "No. of makers","Length(cM)","No. of makers","Length(cM)"];
const data=["1","70","82.0","97","75.4","159","86.5"];

describe("R84 evidence-gated scientific two-tier XLSX column guide",()=>{
  it("recognizes native 3×2 grouped headings and keeps source cells untouched",()=>{
    const rows=[first,second,data];
    const prior=JSON.stringify(rows);
    const result=describeNativePairedGroupHeaders(rows);
    expect(result).toBeTruthy();
    expect(result?.columns).toEqual([
      "Chromosome /linkage group",
      "Jonathan / No. of makers","Jonathan / Length(cM)",
      "Golden Delicious / No. of makers","Golden Delicious / Length(cM)",
      "Consensus / No. of makers","Consensus / Length(cM)",
    ]);
    expect(result?.notes.join(" ")).toContain("no Excel cell merges recreated");
    expect(JSON.stringify(rows)).toBe(prior);
  });
  it("rejects unsupported sparse, nonrepeated, misplaced and single-tier headings",()=>{
    expect(describeNativePairedGroupHeaders([first,second])).toBeNull();
    expect(describeNativePairedGroupHeaders([
      ...[first,second,data].map(row=>row.slice(0,6)),
    ])).toBeNull();
    expect(describeNativePairedGroupHeaders([
      ["Item","Open","","Close","","Close",""],second,data,
    ])).toBeNull();
    expect(describeNativePairedGroupHeaders([
      ["Item","Jonathan","Other","Golden Delicious","","Consensus",""],second,data,
    ])).toBeNull();
    expect(describeNativePairedGroupHeaders([
      first,["/linkage group","Count","Length(cM)","Total","Length(cM)",
        "Count","Length(cM)"],data,
    ])).toBeNull();
    expect(describeNativePairedGroupHeaders([
      first,["/linkage group","Number","Number","Number","Number","Number","Number"],data,
    ])).toBeNull();
    expect(describeNativePairedGroupHeaders([
      ["Item","Group 1","","Group 2","","Group 3",""],
      ["ID","Count","Price","Count","Price","Count","Price"],
      ["1","2","3","4","5","6","7"],
    ])?.columns).toHaveLength(7);
  });
});
