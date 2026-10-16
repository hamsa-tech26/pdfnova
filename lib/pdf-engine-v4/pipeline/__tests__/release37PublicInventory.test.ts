import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {checkRelease37PublicInventory} from "../../../../scripts/checkRelease37PublicTableInventory.mjs";

const inventory=JSON.parse(readFileSync("benchmarks/release37/public-table-inventory.json","utf8"));
const make=()=>JSON.parse(JSON.stringify(inventory));
const metadata=()=>({
  id:"usgs-ofr20241025",
  sourceSha256:inventory.originalPdfSha256FromPilot,
  sourcePages:30,
  selectedPageNumbers:[14,19,20],
  referenceStatus:"NOT_ANNOTATED",
  realDocumentCountCredit:0
});

describe("Real PDF original-source table review inventory",()=>{
  it("enumerates five actual publisher table pages but grants zero reference credit",()=>{
    const result=checkRelease37PublicInventory(make(),metadata());
    expect(result.status).toBe("PUBLISHER_INVENTORY_PENDING_REVIEW");
    expect(result.listedTables).toBe(5);
    expect(result.acceptedDocuments).toBe(0);
  });
  it("rejects invented independent approval or source rights confirmation",()=>{
    const record=make();
    record.independentSourceReview=true;
    record.rightsConfirmed=true;
    record.acceptedDocumentCredit=1;
    expect(checkRelease37PublicInventory(record).status).toBe("BLOCKED");
  });
  it("rejects predicted or prefilled table geometry as if reviewed",()=>{
    const record=make();
    record.tables[0].rowCount=7;
    expect(checkRelease37PublicInventory(record).status).toBe("BLOCKED");
  });
  it("rejects missing inventory tables and page mismatches",()=>{
    const record=make();
    record.tables.pop();
    expect(checkRelease37PublicInventory(record).status).toBe("BLOCKED");
    record.tables.push({...make().tables[4],originalPdfPageNumber:29});
    expect(checkRelease37PublicInventory(record).status).toBe("BLOCKED");
  });
  it("rejects hash or page-count changes in current publisher download",()=>{
    const meta=metadata();
    meta.sourceSha256="b".repeat(64);
    expect(checkRelease37PublicInventory(make(),meta).status).toBe("BLOCKED");
    const pageMeta=metadata();
    pageMeta.sourcePages=29;
    expect(checkRelease37PublicInventory(make(),pageMeta).status).toBe("BLOCKED");
  });
  it("rejects a weak pilot which misses the grouped/hierarchical table pages",()=>{
    const meta=metadata();
    meta.selectedPageNumbers=[14,17,18];
    expect(checkRelease37PublicInventory(make(),meta).status).toBe("BLOCKED");
  });
});
