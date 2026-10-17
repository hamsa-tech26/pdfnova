import JSZip from "jszip";
import {createHash} from "node:crypto";
import {test,expect} from "@playwright/test";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

const root=path.resolve("benchmarks/release37");
const config=JSON.parse(await readFile(path.join(root,"pilot-sources.json"),"utf8"));

for(const entry of config.sources){
  test("Real publisher V4 diagnostic (not accepted evidence): "+entry.id,async({page})=>{
    test.setTimeout(300_000);
    const privateDir=path.join(root,"private");
    const metadata=JSON.parse(await readFile(path.join(privateDir,entry.id+"-metadata.json"),"utf8"));
    expect(metadata.id).toBe(entry.id);
    expect(metadata.realDocumentCountCredit).toBe(0);
    expect(metadata.isRelease37AcceptanceEvidence).toBe(false);
    expect(metadata.referenceStatus).toBe("NOT_ANNOTATED");
    expect(metadata.rightsStatus).toMatch(/^REVIEW_REQUIRED/);

    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first().setInputFiles(path.join(privateDir,entry.id+"-pilot.pdf"));
    const button=page.getByRole("button",{name:"Download complete result JSON"});
    await expect(button).toBeVisible({timeout:270_000});
    const downloadPromise=page.waitForEvent("download");
    await button.click();
    const download=await downloadPromise;
    const filename=await download.path();
    if(!filename)throw new Error("No downloadable V4 Inspector result");
    // Raw Inspector JSON is read transiently, never written to CI artifacts.
    const inspector=JSON.parse(await readFile(filename,"utf8"));
    expect(inspector.document?.pages?.length).toBe(metadata.selectedPageNumbers.length);
    expect(Array.isArray(inspector.tables)).toBe(true);
    expect(inspector.ocrDecision).toBeTruthy();
    expect(inspector.processingTimes).toBeTruthy();
    if(entry.id==="usgs-ofr20241025"){
      // Publisher pages 14, 17, 18, 19, 20 each contain a labelled table.
      // This is a table-presence smoke check, NOT an independently
      // scored per-cell, per-row or V4 Stable accuracy qualification.
      // V4 Inspector may retain small false-positive narrative candidates,
      // which must never be mistaken for any of the five published tables.
      const nativeTables=inspector.tables.filter(table =>
        table.columnCount>=6 && table.rows.length>=4);
      expect(nativeTables.length).toBe(5);
    }
    // Public debug payload is numeric/enum only, never PDF text or coordinates.
    const scores=Array.isArray(inspector.candidateRegionDiagnostics)
      ? inspector.candidateRegionDiagnostics.map(candidate=>({
        pageIndex:candidate.pageNumber,
        originalPage:metadata.selectedPageNumbers[candidate.pageNumber-1]??null,
        kind:candidate.blockType,
        lines:candidate.lineCount,
        outcome:candidate.outcome,
        total:Number((candidate.analysis?.totalScore??0).toFixed(2)),
        alignment:Number((candidate.analysis?.breakdown?.alignment?.score??0).toFixed(2)),
        spacing:Number((candidate.analysis?.breakdown?.spacing?.score??0).toFixed(2)),
        density:Number((candidate.analysis?.breakdown?.density?.score??0).toFixed(2)),
        header:Number((candidate.analysis?.breakdown?.header?.score??0).toFixed(2)),
        numericColumn:Number((candidate.analysis?.breakdown?.numericColumn?.score??0).toFixed(2))
      })) : [];
    const stats=inspector.statistics??{};
    const evidence={
      sourceId:metadata.id,
      sourceSha256:metadata.sourceSha256,
      subsetSha256:metadata.subsetSha256,
      sourceUrl:metadata.sourceUrl,
      sourcePages:metadata.sourcePages,
      selectedPageNumbers:metadata.selectedPageNumbers,
      pageCount:inspector.statistics?.pageCount??inspector.document.pages.length,
      tableCount:inspector.tables.length,
      analysisOutcome:inspector.analysisOutcome,
      candidateRegionCount:scores.length,
      regionScores:scores,
      tableStatistics:Object.fromEntries([
        "wordCount","lineCount","blockCount","candidateTableRegionCount",
        "analyzedTableRegionCount","confirmedTableRegionCount",
        "rejectedForInsufficientColumns","rejectedForNoRows",
        "rejectedForTableBuildFailure"
      ].map(key=>[key,Number.isFinite(stats[key])?stats[key]:null])),
      // Only numeric/enum metadata. Do not export snippets, word objects,
      // PDF URLs embedded in page text, raw OCR decisions, or raw Inspector data.
      nativeExtraction:(inspector.nativePageTextExtraction??[]).map(x=>({
        pageNumber:x.pageNumber,
        status:x.textExtraction?.status,
        wordCount:x.textExtraction?.wordCount,
        characterCount:x.textExtraction?.characterCount,
      })),
      ocrDecisionPresent:Boolean(inspector.ocrDecision),
      controlledOcrAttempted:inspector.controlledOcrResult?.attempted===true,
      actualOcrPages:inspector.controlledOcrResult?.processedPageNumbers??[],
      timingMs:inspector.processingTimes?.totalMs??null,
      referenceStatus:"NOT_ANNOTATED",
      rightsStatus:"REVIEW_REQUIRED",
      realDocumentCountCredit:0,
      acceptanceState:"NOT_VERIFIED"
    };
    await mkdir(path.join(root,"reports"),{recursive:true});
    await writeFile(path.join(root,"reports",entry.id+"-diagnostic.json"),JSON.stringify(evidence,null,2)+"\n");
  });
}


// Non-qualifying publisher regression. Source original pages 14/17/18/19/20
// fetched ephemerally; this is NOT independent reference certification.
test("USGS OFR 2024-1025: actual XLSX preserves all 147 source table cells",async({page})=>{
  test.setTimeout(300_000);
  const input=path.join(root,"private/usgs-ofr20241025-pilot.pdf");
  const sourceMetadata=JSON.parse(await readFile(
    path.join(root,"private/usgs-ofr20241025-metadata.json"),"utf8"));
  expect(sourceMetadata.selectedPageNumbers).toEqual([14,17,18,19,20]);
  expect(sourceMetadata.referenceStatus).toBe("NOT_ANNOTATED");
  expect(sourceMetadata.realDocumentCountCredit).toBe(0);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles(input);
  const downloadPromise=page.waitForEvent("download",{timeout:160000});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const file=await download.path();
  if(!file)throw Error("No real USGS XLSX file");
  const zip=await JSZip.loadAsync(await readFile(file));

  const expected=[
    [
      ["Site","rkm","12-04-20","10-19-21","03-01-22","11-10-22"],
      ["Sacramento Weir","103","4","4","6","6"],
      ["Tule Canal","101","na","2","2","2"],
      ["Sacramento Trawl","90","2","2","2","2"],
      ["Freeport","76","na","na","na","2"],
      ["Rio Vista","21","2","2","2","2"]
    ],
    [
      ["Calendar year","Water year","Month / September","Month / October","Month / November","Total"],
      ["2020","2021","0","17","2","19"],
      ["2021","2022","2","14","0","16"],
      ["2022","2023","13","7","0","20"]
    ],
    [
      ["Calendar year","Water year","Total length (meters) / Mean (range)","Total length (meters) / Standard deviation","Girth (meters) / Mean (range)","Girth (meters) / Standard deviation"],
      ["2020","2021","1.8 (1.6–2.1)","0.1","0.6 (0.5–0.7)","0.1"],
      ["2021","2022","1.8 (1.6–2.0)","0.1","0.6 (0.5–0.6)","0.0"],
      ["2022","2023","1.9 (1.5–2.2)","0.2","0.6 (0.5–0.7)","0.1"]
    ],
    [
      ["Migration direction","Water year of release","Sacramento Weir (n)","Tule Canal (n)","Sacramento Trawl (n)","Freeport (n)","Rio Vista (n)"],
      ["Downstream","2021","19 (100)","0 (0)","19 (100)","0 (0)","15 (79)"],
      ["","2022","16 (100)","0 (0)","16 (100)","0 (0)","16 (100)"],
      ["","2023","20 (100)","0 (0)","19 (95)","16 (80)","20 (100)"]
    ],
    [
      ["Reach","WY 2021 (minutes)","WY 2022 (minutes)","WY 2023 (minutes)","WY 2021 (hours)","WY 2022 (hours)","WY 2023 (hours)"],
      ["Sacramento Weir to Sacramento Trawl","321","185","215","5.4","3.1","3.6"],
      ["Sacramento Trawl to Freeport","na","na","303","na","na","5.1"],
      ["Freeport to Rio Vista","na","na","1,779","na","na","29.7"],
      ["Sacramento Weir to Rio Vista","3,546","1,554","2,508","59.1","25.9","41.8"]
    ]
  ];
  const unescape=value=>value.replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  let count=0;
  for(let i=0;i<expected.length;i++){
    const xml=await zip.file("xl/worksheets/sheet"+(i+1)+".xml")?.async("string");
    expect(xml).toBeTruthy();
    expect(xml).not.toContain("<f>");
    const rows=[...xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
      .map(match=>{
        const values=[];
        for(const cell of match[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)){
          const index=[...cell[1]].reduce((n,letter)=>n*26+letter.charCodeAt(0)-64,0)-1;
          const v=cell[2].match(/<(?:t|v)(?:\s[^>]*)?>([\s\S]*?)<\/(?:t|v)>/);
          values[index]=unescape(v?.[1]??"");
        }
        return Array.from({length:expected[i][0].length},(_,index)=>values[index]??"");
      });
    expect(rows).toEqual(expected[i]);
    count+=rows.reduce((sum,row)=>sum+row.length,0);
  }
  expect(count).toBe(147);
  const review=await zip.file("xl/worksheets/sheet6.xml")?.async("string");
  expect(review).toContain("EXTRACTION NOT VERIFIED");
});


/**
 * Release 77 external real-PDF diagnostic. These sources are original PMC
 * articles, not created/synthetic crops. Reference row/column shapes and
 * prior baseline shapes come from Issue #75 / #38, remain provisional and
 * DO NOT qualify a full-document gold-standard acceptance claim.
 *
 * No PDF bytes, OCR, table text or raw Inspector JSON enter artifacts/logs.
 */
const release77PmcCases=[
  {
    id:"PMC2147049",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC2147049.1/PMC2147049.1.pdf",
    sha256:"465b9e4c260dcc2c2d7b3532efe7ef2ef7d88d9ef88502ca4dc689cdd77d726e",
    pageNumber:3,sourcePageCount:21,
    publishedRows:40,publishedColumns:2,
    previousRows:14,previousColumns:6,
  },
  {
    id:"PMC4595315",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC4595315.1/PMC4595315.1.pdf",
    sha256:"372415d319a25872bc2b3d1ed5c1c6f518f3296a05b28b757026de48df3d9624",
    pageNumber:6,sourcePageCount:15,
    publishedRows:21,publishedColumns:7,
    previousRows:19,previousColumns:9,
    requireImprovement:false,
  },
  {
    id:"PMC5995222",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC5995222.1/PMC5995222.1.pdf",
    sha256:"4308f0d709cb73137cdcda1a321870c3b747b6f3ed5052438a9c699bc33311ec",
    pageNumber:4,sourcePageCount:7,
    publishedRows:6,publishedColumns:10,
    previousRows:5,previousColumns:10,
    requireImprovement:false,
    requireExactShape:true,
  },
  {
    id:"PMC3297222",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC3297222.1/PMC3297222.1.pdf",
    sha256:"9313ad1420a750c43f6ed53b8a81cf2b2009e86a28d37721bd8e3e66db973d58",
    pageNumber:9,sourcePageCount:13,
    publishedRows:34,publishedColumns:7,
    previousRows:5,previousColumns:10,
  },
];

async function boundedPmcPdf(url){
  const response=await fetch(url,{
    redirect:"error",
    signal:AbortSignal.timeout(90000),
    headers:{"Accept":"application/pdf"},
  });
  if(!response.ok||!response.body)throw Error("PMC original source unavailable");
  if(new URL(response.url).hostname!=="pmc-oa-opendata.s3.amazonaws.com")
    throw Error("Unexpected source hostname");
  const max=25*1024*1024;
  if(Number(response.headers.get("content-length")||0)>max)
    throw Error("PMC original exceeds upload safety limit");
  const chunks=[];let total=0;
  for await(const chunk of response.body){
    total+=chunk.byteLength;
    if(total>max)throw Error("PMC original exceeds upload safety limit");
    chunks.push(Buffer.from(chunk));
  }
  const bytes=Buffer.concat(chunks);
  if(bytes.subarray(0,5).toString("ascii")!=="%PDF-")
    throw Error("Publisher did not return a PDF");
  return bytes;
}

for(const source of release77PmcCases){
  test("Release 78 original PMC table-shape diagnostic (not certification): "+source.id,
    async({page})=>{
      test.setTimeout(300_000);
      const bytes=await boundedPmcPdf(source.sourceUrl);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
      await page.goto("/engine-inspector");
      await page.locator('input[type="file"]').first().setInputFiles({
        name:source.id+".pdf",mimeType:"application/pdf",buffer:bytes,
      });
      const button=page.getByRole("button",{name:"Download complete result JSON"});
      await expect(button).toBeVisible({timeout:270_000});
      const downloadPromise=page.waitForEvent("download");
      await button.click();
      const download=await downloadPromise;
      const filename=await download.path();
      if(!filename)throw Error("No downloadable V4 Inspector result");
      const inspector=JSON.parse(await readFile(filename,"utf8"));
      expect(inspector.document?.pages?.length).toBe(source.sourcePageCount);
      expect(Array.isArray(inspector.tables)).toBe(true);
      const pageTables=inspector.tables.filter(t=>t.pageNumber===source.pageNumber);
      const dimensionError=(rows,columns)=>
        Math.abs(rows-source.publishedRows)+Math.abs(columns-source.publishedColumns);
      const shapes=pageTables.map(t=>({
        rows:Array.isArray(t.rows)?t.rows.length:0,
        columns:Number(t.columnCount)||0,
      }));
      const closest=shapes.sort((a,b)=>
        dimensionError(a.rows,a.columns)-dimensionError(b.rows,b.columns))[0]??null;
      const baselineError=dimensionError(source.previousRows,source.previousColumns);
      const observedError=closest?dimensionError(closest.rows,closest.columns):null;
      console.log("R77_REPRO "+JSON.stringify({
        id:source.id,sourceHashVerified:true,
        originalPageCount:source.sourcePageCount,
        provisionalTablePage:source.pageNumber,
        publishedTableShape:[source.publishedRows,source.publishedColumns],
        earlierObservedShape:[source.previousRows,source.previousColumns],
        candidateCountOnPage:pageTables.length,
        nearestCandidateShape:closest?[closest.rows,closest.columns]:null,
        baselineDimensionDistance:baselineError,
        currentDimensionDistance:observedError,
        structuralImprovement:observedError!==null&&observedError<baselineError,
        formalAcceptedDocumentCredit:0,
      }));
      // Metadata-only page diagnostics for both original PMC table failures.
      // No word text, source PDF, or Inspector JSON is written to CI artifacts.
      if(["PMC3297222","PMC2147049","PMC4595315","PMC5995222"].includes(source.id)){
        const pdfPage=inspector.document.pages[source.pageNumber-1];
        const blocks=(pdfPage?.blocks??[]).slice(0,40).map((block,index)=>{
          const lines=Array.isArray(block.lines)?block.lines:[];
          const words=lines.flatMap(line=>Array.isArray(line.words)?line.words:[]);
          const numericRows=lines.filter(line=>
            (line.words??[]).filter(w=>/^[-+]?\\d[\\d,.]*(?:%|[)])?$/.test(w.text?.trim()??"")).length>=2
          ).length;
          return {index,type:block.type,lines:lines.length,words:words.length,
            numericRows,wideRows:lines.filter(line=>(line.words??[]).length>=5).length,
            x:Math.round(block.bounds?.x??0),y:Math.round(block.bounds?.y??0),
            width:Math.round(block.bounds?.width??0),
            height:Math.round(block.bounds?.height??0)};
        });
        const diagnosticRegions=(inspector.candidateRegionDiagnostics??[])
          .filter(region=>region.pageNumber===source.pageNumber).slice(0,35)
          .map(region=>({
            kind:region.blockType,
            lines:region.lineCount,
            total:Math.round(region.analysis?.totalScore??0),
            outcome:region.outcome,
            acceptedColumns:region.acceptedColumnCount??null,
          }));
        const lineGeometry=(pdfPage?.blocks??[]).flatMap(block=>
          (block.lines??[]).map((line,index)=>{
            const words=[...(line.words??[])].sort((a,b)=>a.bounds.x-b.bounds.x);
            const numericScientific=words.filter(w=>
              /^[+\\-\\u2212]?\\d+(?:[.,]\\d+)?(?:\\(\\d+\\))?(?:[eE][+\\-]?\\d+)?$/.test(w.text?.trim()??"")
            ).length;
            const numericWithLeading=words.filter(w=>
              /^[+\\-\\u2212]?(?:\\d|\\.\\d)/.test(w.text?.trim()??"")
            ).length;
            return {index,wordCount:words.length,scientificCount:numericScientific,
              numericLeadingCount:numericWithLeading,
              y:Math.round(line.bounds.y),
              starts:words.slice(0,10).map(w=>Math.round(w.bounds.x)),
              lineWidth:Math.round(line.bounds.width)};
          }));
        console.log("R78_PMC_PAGE_GEOMETRY "+JSON.stringify({
          id:source.id,sourcePage:source.pageNumber,visualBlocks:blocks,
          lineGeometry,diagnosticRegions,acceptedDocumentCredit:0,
        }));
      }
      if(source.id==="PMC5995222"){
        // Geometric debug only: no source words, cell text, or PDF bytes.
        const tableDiagnostics=pageTables.slice(0,6).map((table,index)=>({
          index,
          idPrefix:table.id?.split("-").slice(0,2).join("-")??null,
          rows:table.rows?.length??0,
          cols:table.columnCount,
          bounds:table.bounds&&{
            x:Math.round(table.bounds.x),y:Math.round(table.bounds.y),
            w:Math.round(table.bounds.width),h:Math.round(table.bounds.height),
          },
          rowProfiles:(table.rows??[]).map((row,r)=>({
            r,
            bounds:row.bounds&&{y:Math.round(row.bounds.y),h:Math.round(row.bounds.height)},
            populated:(row.cells??[]).filter(c=>Boolean(c.text?.trim())).length,
            occupiedCols:(row.cells??[]).filter(c=>Boolean(c.text?.trim())).map(c=>c.columnIndex),
            cellXs:(row.cells??[]).filter(c=>Boolean(c.text?.trim())).map(c=>Math.round(c.bounds?.x??0)),
            spans:(row.cells??[]).filter(c=>(c.columnSpan??1)>1||(c.rowSpan??1)>1)
              .map(c=>[c.columnIndex,c.columnSpan,c.rowSpan]),
          })),
        }));
        const regionProfile=(inspector.candidateRegionDiagnostics??[])
          .filter(r=>r.pageNumber===source.pageNumber)
          .map(r=>({kind:r.blockType,lines:r.lineCount,score:Math.round(r.analysis?.totalScore??0),
            status:r.outcome,columns:r.acceptedColumnCount??null}));
        const extractionAnalysis=(inspector.tableAnalyses??[])
          .filter(a=>a.pageNumber===source.pageNumber).slice(0,6)
          .map(a=>({
            regionIdPrefix:a.blockId?.split("-").slice(0,3).join("-"),
            accepted:(a.columnDetection?.columns??[]).map(c=>({
              x:Math.round(c.x),support:c.distinctLineCount,
              stability:Number(c.stability?.toFixed(2)),
            })),
            rejected:(a.columnDetection?.rejectedCandidates??[]).map(c=>({
              x:Math.round(c.x),support:c.distinctLineCount,
              stability:Number(c.stability?.toFixed(2)),
              reason:c.reason,
            })).filter(c=>c.x<240).slice(0,20),
            physicalRows:a.rowDetection?.rows?.length??null,
            rowLineCounts:(a.rowDetection?.rows??[]).map(r=>r.lines?.length??0),
          }));
        console.log("R79_PMC599_TABLE_LAYOUT "+JSON.stringify({
          id:source.id,tableDiagnostics,regionProfile,extractionAnalysis,formalReferenceCredit:0,
        }));
      }
      // R78: The six-anchor PMC2147049 candidate is not the published
      // two-column table. Record the strict acceptance gate separately from
      // the legacy improvement-vs-baseline check; do not certify this source.
      const matchesPublishedShape=closest!==null &&
        closest.rows===source.publishedRows &&
        closest.columns===source.publishedColumns;
      console.log("R78_ORIGINAL_TABLE_ACCEPTANCE "+JSON.stringify({
        id:source.id,exactPublishedShape:matchesPublishedShape,
        observedShape:closest?[closest.rows,closest.columns]:null,
        requiredShape:[source.publishedRows,source.publishedColumns],
        decision:matchesPublishedShape?"SHAPE_ONLY_NOT_CELL_VERIFIED":"BLOCKED",
        independentAcceptanceCredit:0,
      }));
      // This is diagnostic-only until a separately reviewed reference exists.
      // Do not assert that a known bug must remain broken: an eventual real
      // repair must be allowed to satisfy the exact-shape acceptance check.
      if(source.id==="PMC2147049" && !matchesPublishedShape){
        console.warn("R78_KNOWN_FAILURE: PMC2147049 still lacks the published 40x2 shape");
      }
      // Fail closed on absent/unchanged shapes. Even an improvement here is
      // provisional and must not be described as full per-cell accuracy.
      expect(observedError).not.toBeNull();
      if(source.requireImprovement!==false) {
        expect(observedError).toBeLessThan(baselineError);
      }
      if(source.requireExactShape===true){
        expect(matchesPublishedShape).toBe(true);
        const exact=pageTables.find(table=>
          table.rows?.length===source.publishedRows &&
          table.columnCount===source.publishedColumns);
        expect(exact?.rows?.length).toBe(6);
        // A correct 10-column *shape* alone is not an accuracy claim.
        expect(exact?.rows?.every(row=>row.cells?.length===10)).toBe(true);
      }
    });
}
