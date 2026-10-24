import JSZip from "jszip";
import {PDFDocument} from "pdf-lib";
import {createHash} from "node:crypto";
import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
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
      // The old total-only check let five spurious tables on one excerpt
      // page stand in for five published table pages. Require source-page
      // coverage and preserve counts for any missing page investigation.
      const byPage=metadata.selectedPageNumbers.map((originalPage,i)=>{
        const onPage=nativeTables.filter(table=>table.pageNumber===i+1);
        return {originalPage,confirmedCandidateCount:onPage.length,
          shapes:onPage.map(table=>[table.rows.length,table.columnCount])};
      });
      console.log("R143_USGS_PAGE_COVERAGE "+JSON.stringify({
        sourceId:metadata.id,sourceHashVerified:true,
        coverage:byPage,referenceStatus:"NOT_INDEPENDENTLY_ANNOTATED",
        realWorldQualificationCredit:0,
      }));
      expect(nativeTables.length).toBe(5);
      expect(byPage.map(row=>row.confirmedCandidateCount))
        .toEqual([1,1,1,1,1]);
      // Original-publisher source excerpt's five developer-transcribed
      // workbook table layouts. Presence without shape agreement is not
      // good enough: it could be a false-positive table on the right page.
      expect(byPage.map(row=>row.shapes)).toEqual([
        [[6,6]],[[4,6]],[[4,6]],[[4,7]],[[5,7]],
      ]);
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
  // Fail quickly with non-sensitive diagnostic if an unexpected quality
  // gate blocks this previously accepted real XLSX, rather than idling for
  // 160 seconds waiting for a download that will never start.
  const downloaded=page.waitForEvent("download",{timeout:160000})
    .then(download=>({kind:"download",download}));
  const withheld=page.getByRole("heading",{name:"Excel conversion withheld"})
    .waitFor({state:"visible",timeout:160000})
    .then(()=>({kind:"withheld",download:null}));
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const outcome=await Promise.any([downloaded,withheld]);
  if(outcome.kind==="withheld"||!outcome.download){
    const label=await page.getByRole("alert").locator("p").nth(1).innerText();
    const reason=/choose an individual table/i.test(label)?"ONLY_REVIEW_REQUIRED_GRIDS":
      /uncertain row or column structure/i.test(label)?"UNCERTAIN_STRUCTURE":
      /overlapping table cells/i.test(label)?"OVERLAP":
      /more than 12|maximum of 12/i.test(label)?"TOO_MANY_TABLES":
      "OTHER_FAIL_CLOSED_REASON";
    console.log("R130_USGS_EXPORT_REFUSAL "+JSON.stringify({
      reason,sourceHashVerified:true,sourceContentNotLogged:true,acceptance:"BLOCKED",
    }));
    throw Error("USGS 147-cell source regression blocked: "+reason);
  }
  const download=outcome.download;
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
  // Verify the downloaded workbook through an independent spreadsheet reader,
  // not only through the exporter-generated worksheet XML regexes above.
  // The project-transcribed publisher comparison stays diagnostic, not blind.
  const privateExpected=test.info().outputPath("usgs-publisher-cell-reference.json");
  await writeFile(privateExpected,JSON.stringify(expected),"utf8");
  const externalReport=JSON.parse(execFileSync("python",[
    "scripts/checkRelease37XlsxReader.py",file,privateExpected,
  ],{encoding:"utf8",timeout:25000,maxBuffer:256*1024}));
  expect(externalReport).toMatchObject({
    status:"PASS",reader:"openpyxl",tables:5,comparedCells:147,
    mismatches:0,formulaCells:0,referenceStatus:"PROJECT_TRANSCRIBED_NOT_INDEPENDENT",
    formalV4Credit:0,
  });
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
    id:"PMC3464982",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC3464982.1/PMC3464982.1.pdf",
    sha256:"40f3441af492430c32156c53ae23595377bfa67b3ec2591a38a4b3fc1e5b0f54",
    pageNumber:5,sourcePageCount:8,publishedRows:28,publishedColumns:3,
    previousRows:2,previousColumns:4,diagnosticOnly:false,requireImprovement:true,
  },
  {
    id:"PMC3063220",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC3063220.1/PMC3063220.1.pdf",
    sha256:"70e908e1cc763f889f091276874e745a7802f1a11291f1d487f43fee8efcb1ad",
    pageNumber:5,sourcePageCount:6,publishedRows:13,publishedColumns:11,
    previousRows:11,previousColumns:13,diagnosticOnly:true,requireImprovement:false,
    requireExactShape:true,
  },
  {
    id:"PMC2147049",
    sourceUrl:"https://pmc-oa-opendata.s3.amazonaws.com/PMC2147049.1/PMC2147049.1.pdf",
    sha256:"465b9e4c260dcc2c2d7b3532efe7ef2ef7d88d9ef88502ca4dc689cdd77d726e",
    pageNumber:3,sourcePageCount:21,
    publishedRows:40,publishedColumns:2,
    previousRows:14,previousColumns:6,
    requireExactShape:true,
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
      if(source.id==="PMC3464982"){
        // R88 production candidate: FAIL unless the original hash-verified
        // full publisher PDF really yields the published 28 x 3 table.
        expect(closest).toEqual({rows:28,columns:3});
      }
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
      if(["PMC3297222","PMC2147049","PMC4595315","PMC5995222","PMC3464982","PMC3063220"].includes(source.id)){
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

      if(source.id==="PMC2147049"){
        // No raw publisher PDF/text leaves the temporary CI runner. Report
        // source layout and caption coordinates only.
        const pg=inspector.document.pages[source.pageNumber-1];
        const mid=(pg.width??612)/2;
        const paragraph=pg.blocks.find(b=>b.type==="paragraph"&&b.lines?.length>40);
        const sourceLines=paragraph?.lines??[];
        const side=(line,which)=>line.words.filter(w=>
          which==="left" ? w.bounds.x+Math.min(w.bounds.width,18)/2<mid
            : w.bounds.x+Math.min(w.bounds.width,18)/2>=mid);
        const sideProfiles=["left","right"].map(which=>{
          const lines=sourceLines.map((line,i)=>({
            sourceIndex:i,y:Math.round(line.bounds.y),
            words:side(line,which).sort((a,b)=>a.bounds.x-b.bounds.x),
          })).filter(l=>l.words.length>0);
          const captionHits=lines.flatMap((l,i)=>{
            const text=l.words.map(w=>w.text).join(" ");
            return /\btable\s*\d{1,2}[.\s:]?/i.test(text)
              ? [{index:i,y:l.y,words:l.words.length}]:[];
          }).slice(0,8);
          const firstXs=lines.map(l=>Math.round(l.words[0].bounds.x));
          const yBandCounts=new Map();
          for(const line of lines){
            const k=Math.round(line.y/8)*8;
            yBandCounts.set(k,(yBandCounts.get(k)||0)+1);
          }
          return {which,lines:lines.length,captionHits,
            lineWordCountHistogram:lines.reduce((obj,l)=>{
              const k=Math.min(l.words.length,12);
              obj[k]=(obj[k]??0)+1;return obj;
            },{}),
            firstXPeaks:[...firstXs.reduce((m,x)=>{
              const k=Math.round(x/8)*8;m.set(k,(m.get(k)||0)+1);return m;
            },new Map()).entries()].sort((a,b)=>b[1]-a[1]).slice(0,12),
            head:lines.slice(0,10).map(l=>({i:l.sourceIndex,y:l.y,
              starts:l.words.slice(0,6).map(w=>Math.round(w.bounds.x))})),
            tail:lines.slice(-10).map(l=>({i:l.sourceIndex,y:l.y,
              starts:l.words.slice(0,6).map(w=>Math.round(w.bounds.x))})),
            doubleRows:[...yBandCounts.values()].filter(v=>v>1).length,
            linesForRowReview:which==="left"?lines.map(l=>({
              i:l.sourceIndex,y:l.y,w:l.words.length,
              xs:l.words.slice(0,10).map(w=>Math.round(w.bounds.x)),
              hasRightValue:l.words.some(w=>w.bounds.x>190&&w.bounds.x<295),
            })):[],
          };
        });
        console.log("R80_COLUMN_BOUNDARY_DIAGNOSTIC "+JSON.stringify({
          source:source.id,sourceVerified:true,pageWidth:pg.width,
          physicalSourceLines:sourceLines.length,splitAt:mid,
          profiles:sideProfiles,
          originalWords:sourceLines.reduce((n,l)=>n+l.words.length,0),
          retainedWords:sourceLines.reduce((n,l)=>
            n+side(l,"left").length+side(l,"right").length,0),
          independentCertificationCredit:0,
        }));
      }
      if(source.id==="PMC5995222"){
        console.log("R79_ORIGINAL_NATIVE_ROUTING "+JSON.stringify({
          source:source.id,
          pageStatuses:(inspector.nativePageTextExtraction??[]).map(p=>({
            page:p.pageNumber,status:p.textExtraction?.status,
            nativeWordCount:p.textExtraction?.wordCount,
          })),
          detectedTables:inspector.tables.length,
          tableProfiles:inspector.tables.map(t=>({
            page:t.pageNumber,rows:t.rows?.length??0,cols:t.columnCount,
            confidence:Number(t.confidence?.toFixed(3)),
          })),
          independentApprovalCredit:0,
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
      if(source.diagnosticOnly){
        const pg=inspector.document.pages[source.pageNumber-1];
        const allLines=(pg?.blocks??[]).flatMap((block,blockIndex)=>
          (block.lines??[]).map((line,idx)=>({
            blockIndex,idx,y:Math.round(line.bounds?.y??0),
            x:Math.round(line.bounds?.x??0),width:Math.round(line.bounds?.width??0),
            wordCount:line.words?.length??0,
            starts:(line.words??[]).slice(0,11).map(w=>Math.round(w.bounds.x)),
            numeric:(line.words??[]).filter(w=>/^[+-]?\\d/.test(w.text?.trim()??"")).length,
          })));
        const allRegionProfiles=(inspector.tableAnalyses??[]).filter(a=>a.pageNumber===source.pageNumber)
          .slice(0,12).map(a=>({
            id:a.blockId?.slice(0,35),rows:a.rowDetection?.rows?.length??0,
            rowLineCounts:(a.rowDetection?.rows??[]).map(r=>r.lines?.length??0).slice(0,40),
            columns:(a.columnDetection?.columns??[]).map(c=>({
              x:Math.round(c.x),support:c.distinctLineCount
            })),
          }));
        console.log("R87_ORIGINAL_WIDE_TABLE_GEOMETRY "+JSON.stringify({
          id:source.id,originalHashVerified:true,
          page:source.pageNumber,pageWidth:pg.width,pageHeight:pg.height,
          allSourceLines:allLines.length,lines:allLines.slice(0,140),
          candidateProfiles:pageTables.map(t=>({
            rows:t.rows?.length??0,columns:t.columnCount,
            rowCellOccupancies:(t.rows??[]).map(r=>
              r.cells?.filter(c=>String(c.text??"").trim()).length??0).slice(0,32),
          })),
          analyses:allRegionProfiles,formalQualificationCredit:0
        }));
      }
      if(source.id==="PMC2147049" && !matchesPublishedShape){
        console.warn("R78_KNOWN_FAILURE: PMC2147049 still lacks the published 40x2 shape");
      }
      // Fail closed on absent/unchanged shapes. Even an improvement here is
      // provisional and must not be described as full per-cell accuracy.
      if(!source.diagnosticOnly)expect(observedError).not.toBeNull();
      if(source.requireImprovement!==false) {
        expect(observedError).toBeLessThan(baselineError);
      }
      if(source.id==="PMC2147049"&&matchesPublishedShape){
        // Spot-check native cell strings against the source publisher's
        // open-access HTML Table 1, not merely published table dimensions.
        // This remains a bounded developer verification, not independent signoff.
        const table=pageTables.find(t=>t.rows?.length===40&&t.columnCount===2);
        expect(table).toBeDefined();
        const normalize=text=>String(text??"").normalize("NFKC")
          .toLowerCase().replace(/[^a-z0-9]/g,"");
        const reference=[
          ["Chromosome size","2341251"],
          ["G+C content","2705"],
          ["CDS numbers","2259"],
          ["Pseudogenes","5"],
          ["Prophage","1"],
          ["Genetic islands","3"],
          ["Ribosomal RNA operons","5"],
          ["Plasmids","0"],
          ["Chemotaxis proteins","46"],
          ["Unique A. butzleri proteins","315"],
        ];
        const cells=(table?.rows??[]).map(row=>[
          normalize(row.cells?.find(c=>c.columnIndex===0)?.text),
          normalize(row.cells?.find(c=>c.columnIndex===1)?.text),
        ]);
        const decisions=reference.map(([label,value])=>
          cells.some(([l,v])=>l.includes(normalize(label))&&v.includes(value)));
        console.log("R80_PUBLISHER_CELL_SPOTCHECK "+JSON.stringify({
          source:source.id,sourceVerified:true,
          inspectedAnchors:reference.length,
          matchedAnchors:decisions.filter(Boolean).length,
          sourceWordTextNotLogged:true,
          independentAcceptedDocumentCredit:0,
        }));
        expect(decisions.filter(Boolean).length).toBeGreaterThanOrEqual(7);
      }
      if(source.requireExactShape===true){
        expect(matchesPublishedShape).toBe(true);
        const exact=pageTables.find(table=>
          table.rows?.length===source.publishedRows &&
          table.columnCount===source.publishedColumns);
        expect(exact?.rows?.length).toBe(source.publishedRows);
        // A correct 10-column *shape* alone is not an accuracy claim.
        expect(exact?.rows?.every(row=>row.cells?.length===source.publishedColumns)).toBe(true);
      }
    });
}


// R79: Test a real *exported* XLSX, not just an Inspector object. This verifies
// the external source's provisional six-row ten-column table is preserved in
// the downloaded workbook and contains non-empty cells. It is not third-party
// adjudication of individual source-cell values or merged header semantics.
test("R79 original PMC table-page excerpt exports a populated 6x10 XLSX sheet",async({page})=>{
  test.setTimeout(160_000);
  const source=release77PmcCases.find(x=>x.id==="PMC5995222");
  if(!source)throw Error("Missing pinned PMC source");
  const bytes=await boundedPmcPdf(source.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  // This is original publisher page 4, not a synthetic table. The complete
  // 7-page document is known to trigger the independent quality refuse gate
  // because other tables are uncertain; never disable that safeguard.
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(source.sourcePageCount);
  const excerpt=await PDFDocument.create();
  const pages=await excerpt.copyPages(original,[source.pageNumber-1]);
  excerpt.addPage(pages[0]);
  const excerptBytes=Buffer.from(await excerpt.save());
  expect(excerptBytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:source.id+"-original-page-"+source.pageNumber+".pdf",
    mimeType:"application/pdf",buffer:excerptBytes,
  });
  const downloaded=page.waitForEvent("download",{timeout:65000})
    .then(download=>({kind:"download",download}));
  const withheld=page.getByRole("heading",{name:"Excel conversion withheld"})
    .waitFor({state:"visible",timeout:65000})
    .then(()=>({kind:"withheld",download:null}));
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const result=await Promise.any([downloaded,withheld]);
  if(result.kind==="withheld"||!result.download){
    const label=await page.getByRole("alert").locator("p").nth(1).innerText();
    const reason=/image-only or low-text/i.test(label)?"LOW_NATIVE_TEXT_PAGE"
      :/columns are merged together/i.test(label)?"COLLAPSED_COLUMN_GUARD"
      :/uncertain row or column structure/i.test(label)?"UNCERTAIN_TABLE_GUARD"
      :/Overlapping/i.test(label)?"OVERLAPPING_CELLS"
      :/more than 12|maximum of 12/i.test(label)?"TOO_MANY_TABLES"
      :"OTHER_FAIL_CLOSED_REASON";
    console.log("R79_ORIGINAL_EXPORT_REFUSAL "+JSON.stringify({
      source:source.id,reason,sourceHashVerified:true,
      errorMessageNotLogged:true,acceptance:"BLOCKED",
    }));
    throw Error("R79 original PDF-to-Excel conversion withheld: "+reason);
  }
  const download=result.download;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  const file=await download.path();
  if(!file)throw Error("No real XLSX download");
  const zip=await JSZip.loadAsync(await readFile(file));
  const names=Object.keys(zip.files).filter(name=>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  expect(names.length).toBeGreaterThanOrEqual(2);
  const unescape=value=>value.replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  const profiles=[];
  for(const name of names){
    const xml=await zip.file(name)?.async("string")??"";
    const rows=[...xml.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)].map(match=>{
      const cells=[...match[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)];
      const vals=[];
      for(const cell of cells){
        const index=[...cell[1]].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0)-1;
        const v=cell[2].match(/<(?:t|v)(?:\s[^>]*)?>([\s\S]*?)<\/(?:t|v)>/);
        vals[index]=unescape(v?.[1]??"").trim();
      }
      return vals;
    });
    const maxCols=rows.reduce((n,row)=>Math.max(n,row.length),0);
    const nonemptyByRow=rows.map(row=>row.filter(x=>Boolean(x?.trim())).length);
    profiles.push({name,rowCount:rows.length,maxCols,nonemptyByRow});
  }
  const matches=profiles.filter(p=>p.rowCount===6&&p.maxCols===10&&
    p.nonemptyByRow.reduce((a,b)=>a+b,0)>=45);
  console.log("R79_XLSX_STRUCTURE "+JSON.stringify({
    originalSource:source.id,originalHashVerified:true,pagesSelected:[source.pageNumber],
    sheetProfiles:profiles.map(p=>({
      rows:p.rowCount,cols:p.maxCols,nonempty:p.nonemptyByRow.reduce((a,b)=>a+b,0),
    })),
    matched6x10PopulatedSheet:matches.length>0,
    independentlyReviewedCellCredit:0,
  }));
  expect(matches.length).toBeGreaterThanOrEqual(1);
  // Human review warnings remain visible for unverified extraction.
  const xmls=await Promise.all(names.map(async name=>zip.file(name)?.async("string")));
  expect(xmls.some(xml=>xml?.includes("EXTRACTION NOT VERIFIED"))).toBe(true);
});


test("R80 original PMC2147049 Table 1 source page exports real 40x2 XLSX",async({page})=>{
  test.setTimeout(160_000);
  const src=release77PmcCases.find(s=>s.id==="PMC2147049");
  if(!src)throw Error("Original PMC test source unavailable");
  const bytes=await boundedPmcPdf(src.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(src.sha256);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(src.sourcePageCount);
  const excerpt=await PDFDocument.create();
  const pages=await excerpt.copyPages(original,[src.pageNumber-1]);
  excerpt.addPage(pages[0]);
  const sourcePage=Buffer.from(await excerpt.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:src.id+"-publisher-table1-page.pdf",
    mimeType:"application/pdf",buffer:sourcePage,
  });
  const downloaded=page.waitForEvent("download",{timeout:65000})
    .then(download=>({kind:"download",download}));
  const withheld=page.getByRole("heading",{name:"Excel conversion withheld"})
    .waitFor({state:"visible",timeout:65000})
    .then(()=>({kind:"withheld",download:null}));
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const result=await Promise.any([downloaded,withheld]);
  if(result.kind==="withheld"||!result.download){
    const detail=await page.getByRole("alert").locator("p").nth(1).innerText();
    const why=/low-text|image-only/i.test(detail)?"NATIVE_TEXT_GATE":
      /overlap/i.test(detail)?"OVERLAP_GUARD":
      /merged together/i.test(detail)?"MERGED_COLUMN_GUARD":
      /uncertain|no reliable/i.test(detail)?"STRUCTURAL_GUARD":
      /maximum of 12|more than 12/i.test(detail)?"TABLE_COUNT_GATE":
      "OTHER_FAIL_CLOSED";
    console.log("R80_XLSX_REFUSAL "+JSON.stringify({source:src.id,
      reason:why,originalHashVerified:true,safetyPreserved:true,
      rawErrorTextNotLogged:true}));
    throw Error("R80 original table-page XLSX refused: "+why);
  }
  const file=await result.download.path();
  if(!file)throw Error("No XLSX artifact after source-page conversion");
  const zip=await JSZip.loadAsync(await readFile(file));
  const names=Object.keys(zip.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const profiles=[];
  for(const name of names){
    const xml=await zip.file(name)?.async("string")??"";
    const cells=[...xml.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)]
      .map(m=>[...m[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)]
        .map(c=>({
          col:[...c[1]].reduce((v,t)=>v*26+t.charCodeAt(0)-64,0)-1,
          filled:Boolean(c[2].match(/<(?:t|v)(?:\s[^>]*)?>([\s\S]*?)<\/(?:t|v)>/)?.[1]?.trim()),
        })));
    profiles.push({rows:cells.length,cols:Math.max(0,...cells.flat().map(c=>c.col+1)),
      filled:cells.flat().filter(c=>c.filled).length,
      reviewWarning:xml.includes("EXTRACTION NOT VERIFIED")});
  }
  const match=profiles.find(x=>x.rows===40&&x.cols===2&&x.filled>=55);
  console.log("R80_XLSX_STRUCTURE "+JSON.stringify({
    originalHashVerified:true,extractedPublisherPage:src.pageNumber,
    sheetProfiles:profiles,matched40x2:!!match,independentCredit:0,
  }));
  expect(match).toBeTruthy();
  expect(profiles.some(x=>x.reviewWarning)).toBe(true);

  // Release 82: compare ALL 80 actual XLSX cell positions to the publisher's
  // manually transcribed HTML Table 1 (not V4 output or synthetic golden).
  // Coordinate-only mismatch logs prevent leaking source data into CI output.
  const ref=JSON.parse(await readFile(
    "benchmarks/release82/pmc2147049-table1-publisher-reference.json","utf8"));
  expect(ref.originalPdfSHA256).toBe(src.sha256);
  expect(ref.referenceStatus).toBe(
    "publisher-html-transcribed-by-project-not-independently-adjudicated");
  expect(ref.rows).toHaveLength(40);
  const dataSheetIndex=profiles.findIndex(x=>x.rows===40&&x.cols===2&&x.filled>=55);
  expect(dataSheetIndex).toBeGreaterThanOrEqual(0);
  const xml=await zip.file(names[dataSheetIndex])?.async("string")??"";
  const decode=txt=>txt.replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  const excelRows=[...xml.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)].map(row=>{
    const values=["",""];
    for(const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)){
      if(cell[1]!=="A"&&cell[1]!=="B")continue;
      const texts=[...cell[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
        .map(m=>decode(m[1])).join("");
      values[cell[1]==="A"?0:1]=texts;
    }
    return values;
  });
  expect(excelRows).toHaveLength(40);
  // Normalize layout-specific punctuation/superscripts but do NOT reorder
  // rows or columns, invent blank cells, or accept approximate substrings.
  const normalize=text=>String(text??"").normalize("NFKC").toLowerCase()
    .replace(/\b(?:a|b)\b(?=$)/g,"")
    .replace(/[^\p{L}\p{N}]+/gu,"");
  const matches=[],mismatchCoordinates=[];
  for(let row=0;row<40;row++)for(let col=0;col<2;col++){
    const ok=normalize(excelRows[row][col])===normalize(ref.rows[row][col]);
    matches.push(ok);
    if(!ok)mismatchCoordinates.push([row+1,col+1]);
  }
  const exact=matches.filter(Boolean).length;
  console.log("R82_PUBLISHER_CELL_REFERENCE "+JSON.stringify({
    source:src.id,verifiedOriginalPdfHash:true,source:"publisher-html",
    referenceReview:"project-transcribed-not-independent",
    rows:40,columns:2,totalCells:80,matchingCells:exact,
    mismatchedCoordinates:mismatchCoordinates,valuesNotLogged:true,
    certifiedDocumentCredit:0,
  }));
  // Release 83 requires all publisher-reference positions to match in the
  // actual downloaded workbook. This authored comparison is not formal,
  // third-party independent accuracy certification.
  expect(exact).toBe(80);
  expect(mismatchCoordinates).toEqual([]);
  // Native Greek glyphs inferred from ambiguous font encodings MUST be
  // explicitly disclosed to the end-user as review-only interpretations.
  const allWorksheets=await Promise.all(names.map(name=>
    zip.file(name)?.async("string")));
  expect(allWorksheets.some(x=>x?.includes("ambiguous font glyphs"))).toBe(true);
});


/**
 * R81 genuine user interaction: entire publisher 7-page PDF is loaded without
 * pre-splitting, an unrelated one-row table remains refused, and the user
 * explicitly selects its independently identified 6x10 native table.
 * Tests workbook bytes, not Inspector-only synthetic dimensions.
 */
test("R81 full original PMC5995222 selectively exports source page 4 table to XLSX",async({page})=>{
  test.setTimeout(230_000);
  const src=release77PmcCases.find(x=>x.id==="PMC5995222");
  if(!src)throw Error("Missing pinned original PDF");
  const bytes=await boundedPmcPdf(src.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(src.sha256);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:src.id+".pdf",mimeType:"application/pdf",buffer:bytes,
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:140000});

  // A separate invalid one-row table is visibly disabled.
  const invalid=page.locator("label").filter({
    hasText:/Page 5 — 1 rows × 9 columns/,
  }).locator('input[type="radio"]');
  await expect(invalid).toBeDisabled();
  const selected=page.locator("label").filter({
    hasText:/Page 4 — 6 rows × 10 columns/,
  }).locator('input[type="radio"]');
  await expect(selected).toBeEnabled();
  await expect(page.getByRole("button",{name:"Export selected table (.xlsx)"}))
    .toBeDisabled();

  // The existing whole-document behavior is unchanged and correctly refused.
  await page.getByRole("button",{name:"Convert to Excel (.xlsx)"}).click();
  await expect(page.getByRole("heading",{name:"Excel conversion withheld"}))
    .toBeVisible({timeout:70000});
  await page.getByRole("button",{name:"Return to table choices"}).click();

  await selected.check();
  const preview=page.getByRole("region",{name:"Scrollable extracted spreadsheet preview"});
  await expect(preview).toBeVisible();
  await expect(page.getByRole("heading",{name:/extracted values preview \(unverified\)/i})).toBeVisible();
  await expect(preview.getByRole("row")).toHaveCount(7);
  await expect(preview.getByRole("columnheader")).toHaveCount(9);
  await expect(page.getByText(/Showing rows 1–6 of 6/)).toBeVisible();
  const downloadPromise=page.waitForEvent("download",{timeout:70000});
  await page.getByRole("button",{name:"Export selected table (.xlsx)"}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-table-\d+\.xlsx$/i);
  const saved=await download.path();
  if(!saved)throw Error("No XLSX downloaded");
  const zip=await JSZip.loadAsync(await readFile(saved));
  const names=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  expect(names).toHaveLength(2); // just one table + explicit review sheet
  const first=await zip.file("xl/worksheets/sheet1.xml")?.async("string")??"";
  const notes=await zip.file("xl/worksheets/sheet2.xml")?.async("string")??"";
  const rows=[...first.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)];
  const cols=[...first.matchAll(/<c r="([A-Z]+)\d+"[^>]*>/g)]
    .map(match=>[...match[1]].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0));
  const nonempty=[...first.matchAll(/<(?:t|v)(?:\s[^>]*)?>([\s\S]*?)<\/(?:t|v)>/g)]
    .filter(m=>m[1].trim().length>0).length;
  const schema={originalHashVerified:true,pagesInSource:src.sourcePageCount,
    selectedSourcePage:src.pageNumber,rows:rows.length,cols:Math.max(...cols),
    nonemptyCells:nonempty,hasSelectiveReview:notes.includes("SELECTIVE EXPORT"),
    hasUnverifiedWarning:notes.includes("UNVERIFIED"),excelFormulaNodes:/<f(?:\s|>)/.test(first)};
  console.log("R81_ORIGINAL_SELECTIVE_EXPORT "+JSON.stringify(schema));
  expect(schema.rows).toBe(6);
  expect(schema.cols).toBe(10);
  expect(schema.nonemptyCells).toBeGreaterThanOrEqual(45);
  expect(schema.hasSelectiveReview).toBe(true);
  expect(schema.hasUnverifiedWarning).toBe(true);
  expect(schema.excelFormulaNodes).toBe(false);
});


/**
 * Second project-curated original-publisher reference (NOT independent V4
 * certification). Checks all 133 reference data cell coordinates in the
 * downloaded XLSX from original publisher PDF page 6.
 */
test("R84 original PMC4595315 publisher Table 3 against 133 referenced Excel cells",async({page})=>{
  test.setTimeout(240_000);
  const source=release77PmcCases.find(x=>x.id==="PMC4595315");
  if(!source)throw Error("Pinned publisher source not found");
  const reference=JSON.parse(await readFile(
    "benchmarks/release84/pmc4595315-table3-publisher-reference.json","utf8"));
  expect(reference.originalPdfSha256).toBe(source.sha256);
  expect(reference.referenceStatus).toBe(
    "publisher-html-project-transcribed-not-independent-adjudication");
  expect(reference.dataRows).toHaveLength(19);
  expect(reference.dataRows.every(row=>row.length===7)).toBe(true);
  const bytes=await boundedPmcPdf(source.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(source.sourcePageCount);
  const excerpt=await PDFDocument.create();
  const publisherPage=await excerpt.copyPages(original,[source.pageNumber-1]);
  excerpt.addPage(publisherPage[0]);
  const singlePage=Buffer.from(await excerpt.save());

  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC4595315-original-publisher-page6.pdf",
    mimeType:"application/pdf",buffer:singlePage,
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:160000});
  const choice=page.locator("label").filter({
    hasText:/21 rows × 7 columns/,
  }).locator('input[type="radio"]');
  await expect(choice).toHaveCount(1);
  // Do not weaken the selected-table quality gate to make benchmark pass.
  const choiceAllowed=await choice.isEnabled();
  if(!choiceAllowed){
    console.log("R84_TABLE3_REFUSAL "+JSON.stringify({
      originalPdfHashVerified:true,sourcePage:source.pageNumber,
      candidateRows:21,candidateColumns:7,
      structuralSafetyWithheld:true,
      sourceTextNotLogged:true,independentCredit:0,
    }));
  }
  expect(choiceAllowed).toBe(true);
  await choice.check();
  await expect(page.getByText(/Two-level native header detected:/)).toBeVisible();
  const downloadPromise=page.waitForEvent("download",{timeout:70000});
  await page.getByRole("button",{name:"Export selected table (.xlsx)"}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  const filename=await download.path();
  if(!filename)throw Error("No real original-source XLSX downloaded");
  const zip=await JSZip.loadAsync(await readFile(filename));
  const sheets=Object.keys(zip.files).filter(name=>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  expect(sheets.length).toBe(2); // one explicitly selected table plus review
  const unescape=text=>String(text??"").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
  const xmls=await Promise.all(sheets.map(async name=>zip.file(name)?.async("string")??""));
  const matrices=xmls.map(xml=>[...xml.matchAll(
    /<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)].map(match=>{
    const row=Array.from({length:7},()=>"");
    for(const cell of match[1].matchAll(
      /<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)){
      const col=[...cell[1]].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;
      if(col>=0&&col<7){
        const inline=[...cell[2].matchAll(
          /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
          .map(m=>unescape(m[1])).join("");
        const number=cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??"";
        row[col]=inline||unescape(number);
      }
    }
    return row;
  }));
  const tableIndex=matrices.findIndex(rows=>rows.length===21);
  expect(tableIndex).toBeGreaterThanOrEqual(0);
  // R91 original-publisher XLSX header presentation: three actual paired
  // native source group parents, not a guessed merge over data cells.
  const nativeSheet=xmls[tableIndex];
  const mergeRefs=[...nativeSheet.matchAll(/<mergeCell ref="([^"]+)"\/>/g)]
    .map(m=>m[1]);
  const styleSheet=await zip.file("xl/styles.xml")?.async("string")??"";
  const r91Ok=mergeRefs.join(",")==="B1:C1,D1:E1,F1:G1" &&
    nativeSheet.includes('ySplit="2" topLeftCell="A3"') &&
    styleSheet.includes('wrapText="1"');
  console.log("R91_ORIGINAL_GROUPED_HEADER_PRESENTATION "+JSON.stringify({
    originalPublisher:source.id,originalHashVerified:true,
    expectedNativeTwoTierHeaderRows:2,
    expectedSafeGroupMerges:3,observedGroupMerges:mergeRefs,
    twoHeaderRowsFrozen:nativeSheet.includes('ySplit="2" topLeftCell="A3"'),
    wordWrappedHeaderStyle:styleSheet.includes('wrapText="1"'),
    passed:r91Ok,formalIndependentCredit:0,
  }));
  expect(mergeRefs).toEqual(["B1:C1","D1:E1","F1:G1"]);
  expect(nativeSheet).toContain('ySplit="2" topLeftCell="A3"');
  expect(styleSheet).toContain('wrapText="1"');
  const tableRows=matrices[tableIndex].slice(2);
  expect(tableRows).toHaveLength(19);
  const headerRows=matrices[tableIndex].slice(0,2);
  const normalizeHeader=value=>String(value??"").normalize("NFKC")
    .trim().toLowerCase().replace(/[\u00a0\u2009\u202f\s\/\-]+/g,"");
  const headerMismatches=[];
  for(let row=0;row<2;row++)for(let col=0;col<7;col++){
    if(normalizeHeader(headerRows[row][col])!==
      normalizeHeader(reference.publisherHeaderRows[row][col])){
      headerMismatches.push([row+1,col+1]);
    }
  }
  console.log("R84_GROUPED_HEADER_REFERENCE "+JSON.stringify({
    publisherSource:source.id,headerCells:14,
    matchingHeaderCells:14-headerMismatches.length,
    headerMismatchCoordinates:headerMismatches,
    sourceValuesNotLogged:true,semanticMergingNotVerified:true,
    independentCredit:0,
  }));
  const clean=value=>String(value??"").normalize("NFKC").trim()
    .replace(/[\u00a0\u2009\u202f,\s]/g,"").toLowerCase()
    .replace(/[–−]/g,"-");
  const discrepancies=[];
  let matches=0;
  for(let i=0;i<19;i++)for(let col=0;col<7;col++){
    if(clean(tableRows[i]?.[col])===clean(reference.dataRows[i][col]))matches++;
    else discrepancies.push([i+3,col+1]);
  }
  console.log("R84_SECOND_PUBLISHER_CELL_REFERENCE "+JSON.stringify({
    originalSource:source.id,originalSha256Verified:true,
    publisherArticle:reference.id,dataRows:19,columns:7,
    comparedCells:133,exactNormalizedMatches:matches,
    mismatchCoordinates:discrepancies,sourceValuesNotLogged:true,
    independentAcceptanceCredit:0,
  }));
  // Full original-publisher reference observed as 133/133 on Release 83.
  // A change that loses a real data cell or moves it to a different source
  // column must fail this regression.
  expect(matches).toBe(133);
  expect(discrepancies).toEqual([]);
  expect(headerMismatches).toEqual([]);
  expect(xmls.some(xml=>xml.includes("UNVERIFIED"))).toBe(true);
  const review=xmls.find((xml,i)=>i!==tableIndex&&
    xml.includes("Grouped native column heading guide"));
  expect(review).toBeDefined();
  expect(review).toContain("Jonathan / No. of makers");
  expect(review).toContain("Golden Delicious / Length(cM)");
  expect(review).toContain("Consensus / Length(cM)");
  expect(review).toContain("no Excel cell merges recreated");
  expect(/<f(?:\s|>)/.test(xmls[tableIndex])).toBe(false);
});


/**
 * Release86 initial original-source diagnostic: PubTables-1M OTSL published
 * 9x2 table, current older V4 baseline was 8x4. Source publisher's article
 * exposes the same 9x2 (including header), unlike synthetic tests.
 * Never log PDF/source text or raw Inspector outputs.
 */
test("R86 source-verified PMC5012829 native table geometry (diagnostic)",async({page})=>{
  test.setTimeout(200000);
  const originalUrl="https://pmc-oa-opendata.s3.amazonaws.com/PMC5012829.1/PMC5012829.1.pdf";
  const sha="4c66dcdecf3b65ea2e75834c741cda73e8bb548794c635ce4601215ef780722b";
  const bytes=await boundedPmcPdf(originalUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(6);
  await page.goto("/engine-inspector");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC5012829.1.pdf",mimeType:"application/pdf",buffer:bytes,
  });
  const button=page.getByRole("button",{name:"Download complete result JSON"});
  await expect(button).toBeVisible({timeout:130000});
  const getting=page.waitForEvent("download");
  await button.click();
  const downloaded=await getting,filename=await downloaded.path();
  if(!filename)throw Error("No Inspector original PDF result");
  const result=JSON.parse(await readFile(filename,"utf8"));
  const tables=result.tables.filter(t=>t.pageNumber===5);
  const pageObj=result.document.pages[4];
  const blocks=(pageObj?.blocks??[]).map(block=>{
    const lines=block.lines??[];
    const wordCounts=lines.map(l=>l.words?.length??0);
    const xclusters=new Map();
    const ys=new Map();
    for(const line of lines){
      const words=line.words??[];
      for(const word of words){
        const x=Math.round(word.bounds.x/10)*10;
        xclusters.set(x,(xclusters.get(x)??0)+1);
      }
      const y=Math.round((line.bounds?.y??0)/10)*10;
      ys.set(y,(ys.get(y)??0)+1);
    }
    return {kind:block.type,lines:lines.length,words:wordCounts.reduce((a,b)=>a+b,0),
      rows:lines.map((line,i)=>({
        index:i,y:Math.round(line.bounds?.y??0),
        count:line.words?.length??0,
        xs:(line.words??[]).slice(0,15).map(w=>Math.round(w.bounds.x)),
        kinds:(line.words??[]).slice(0,15).map(w=>/^[0-9,.()%+-]+$/.test(w.text)?1:0),
      })),
      bounds:block.bounds&&{x:Math.round(block.bounds.x),y:Math.round(block.bounds.y),
        w:Math.round(block.bounds.width),h:Math.round(block.bounds.height)},
      wordCounts:wordCounts.slice(0,28),
      xPeaks:[...xclusters.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12),
      sameYBands:[...ys.values()].filter(v=>v>1).length};
  });
  const selected=tables.map(t=>({
    rows:t.rows.length,cols:t.columnCount,
    rowCells:t.rows.slice(0,12).map(r=>r.cells?.filter(c=>c.text?.trim()).length??0),
    bounds:t.bounds&&{x:Math.round(t.bounds.x),y:Math.round(t.bounds.y),
      w:Math.round(t.bounds.width),h:Math.round(t.bounds.height)}
  }));
  console.log("R86_ORIGINAL_PMC5012829_DIAGNOSTIC "+JSON.stringify({
    hashVerified:true,pageCount:6,page:5,publishedShape:[9,2],
    candidates:selected,blocks:blocks.slice(0,20),noTextLogged:true,
    independentCredit:0,
  }));
  expect(pageObj).toBeTruthy();
});


/**
 * Release 86 publisher-controlled value check:
 * actual original page 5, not an assistant-generated table or fake PDF.
 * Uses the existing, unchanged fail-closed single-table XLSX exporter.
 */
test("R86 original PMC5012829 Table 1 downloads real 9x2 XLSX with publisher cells",async({page})=>{
  test.setTimeout(200000);
  const reference=JSON.parse(await readFile(
    "benchmarks/release86/pmc5012829-table1-publisher-reference.json","utf8"));
  expect(reference.rows).toHaveLength(9);
  const bytes=await boundedPmcPdf(reference.originalSourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(reference.originalPdfSha256);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(reference.sourcePageCount);
  const subset=await PDFDocument.create();
  const pages=await subset.copyPages(original,[reference.sourcePageNumber-1]);
  subset.addPage(pages[0]);
  const pageBuffer=Buffer.from(await subset.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC5012829-source-page-5.pdf",
    mimeType:"application/pdf",buffer:pageBuffer,
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:100000});
  const option=page.locator("label").filter({hasText:/9 rows × 2 columns/})
    .locator('input[type="radio"]');
  await expect(option).toHaveCount(1);
  await expect(option).toBeEnabled();
  await option.check();
  const preview=page.getByRole("region",{name:"Scrollable extracted spreadsheet preview"});
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("row")).toHaveCount(10);
  await expect(preview.getByRole("columnheader")).toHaveCount(3);
  const downloaded=page.waitForEvent("download",{timeout:65000});
  await page.getByRole("button",{name:"Export selected table (.xlsx)"}).click();
  const result=await downloaded;
  expect(result.suggestedFilename()).toMatch(/\.xlsx$/i);
  const p=await result.path();
  if(!p)throw Error("No real source-page XLSX file downloaded");
  const zip=await JSZip.loadAsync(await readFile(p));
  const names=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  expect(names).toHaveLength(2);
  const xml=await zip.file("xl/worksheets/sheet1.xml")?.async("string")??"";
  const review=await zip.file("xl/worksheets/sheet2.xml")?.async("string")??"";
  const deent=text=>String(text??"").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
  const matrix=[...xml.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)]
    .map(row=>{
      const result=["",""];
      for(const cell of row[1].matchAll(
        /<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)){
        const col=cell[1]==="A"?0:cell[1]==="B"?1:-1;
        if(col<0)continue;
        const txt=[...cell[2].matchAll(
          /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>deent(x[1])).join("");
        const numeric=cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??"";
        result[col]=txt||deent(numeric);
      }
      return result;
    });
  const norm=value=>String(value??"").normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu,"");
  const mismatches=[];
  for(let row=0;row<9;row++)for(let col=0;col<2;col++){
    if(norm(matrix[row]?.[col])!==norm(reference.rows[row][col]))
      mismatches.push([row+1,col+1]);
  }
  console.log("R86_PMC5012829_ORIGINAL_XLSX "+JSON.stringify({
    hashVerified:true,sourcePages:6,publisherPage:5,
    expectedRows:9,expectedColumns:2,actualRows:matrix.length,
    comparedCells:18,matchingPositions:18-mismatches.length,
    mismatchCoordinates:mismatches,referenceIsProjectTranscribed:true,
    privateSourceTextNotLogged:true,independentApprovalCredit:0,
  }));
  expect(matrix).toHaveLength(9);
  expect(mismatches).toEqual([]);
  expect(review).toContain("UNVERIFIED");
  expect(review).toContain("SELECTIVE EXPORT");
  expect(/<f(?:\s|>)/.test(xml)).toBe(false);
});


/**
 * A second previously broken full original-PDF scientific layout.
 * Compare numeric factual measurements + blanks against publisher Table 3,
 * not a synthetic PDF or dimensions alone; no third-party signoff claimed.
 */
test("R87 original PMC3063220 real XLSX numeric cell and 13x11 table verification",async({page})=>{
  test.setTimeout(240_000);
  const source=release77PmcCases.find(x=>x.id==="PMC3063220");
  if(!source)throw Error("R87 publisher source missing");
  const reference=JSON.parse(await readFile(
    "benchmarks/release87/pmc3063220-table3-numeric-source-reference.json","utf8"));
  expect(reference.sourceFullPdfSha256).toBe(source.sha256);
  expect(reference.referenceColumns).toEqual([0,2,3,4,6,7,8,10]);
  expect(reference.referenceRows).toHaveLength(12);
  const bytes=await boundedPmcPdf(source.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(source.sourcePageCount);
  const excerpt=await PDFDocument.create();
  excerpt.addPage((await excerpt.copyPages(original,[source.pageNumber-1]))[0]);
  const pdf=Buffer.from(await excerpt.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC3063220-original-page5.pdf",
    mimeType:"application/pdf",buffer:pdf,
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:150000});
  const target=page.locator("label").filter({hasText:/13 rows × 11 columns/})
    .locator('input[type="radio"]');
  await expect(target).toHaveCount(1);
  await expect(target).toBeEnabled();
  await target.check();
  // R101: exercise late-page/late-column navigation on the REAL original
  // 13x11 clinical publisher table before exporting. No synthetic shortcuts.
  const range=page.getByText(/Showing rows 1–12 of 13/);
  await expect(range).toBeVisible();
  await expect(page.getByRole("button",{name:"Next 12 rows"})).toBeEnabled();
  await page.getByRole("button",{name:"Next 12 rows"}).click();
  await expect(page.getByText(/Showing rows 13–13 of 13/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Next 12 rows"})).toBeDisabled();
  await page.getByRole("button",{name:"Previous 12 rows"}).click();
  await expect(range).toBeVisible();
  await page.getByRole("button",{name:"Next 8 columns"}).click();
  await expect(page.getByText(/columns I–K/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Next 8 columns"})).toBeDisabled();
  await page.getByRole("button",{name:"Previous 8 columns"}).click();
  await expect(range).toBeVisible();

  await page.getByRole("textbox",{name:"Excel cell address"}).fill("Z14");
  await page.getByRole("button",{name:"Go to cell",exact:true}).click();
  await expect(page.getByText(/Enter a source Excel cell inside/)).toBeVisible();
  await page.getByRole("textbox",{name:"Excel cell address"}).fill("J13");
  await page.getByRole("button",{name:"Go to cell",exact:true}).click();
  await expect(page.getByText(/Showing rows 13–13 of 13/)).toBeVisible();
  await expect(page.getByText(/columns I–K/)).toBeVisible();
  await expect(page.getByText(/Exact cell J13 · Source PDF page 1/)).toBeVisible();
  await page.getByRole("button",{name:"Inspect exact cell J13"}).click();
  const exactCellLabel=await page.getByLabel("Exact extracted cell text").textContent();
  expect(exactCellLabel).not.toBeNull();
  console.log("R101_ORIGINAL_TABLE_NAVIGATION "+JSON.stringify({
    originalSource:source.id,fullSourceHashVerified:true,
    originalRows:13,originalColumns:11,visitedLastRow:13,
    inspectedAddress:"J13",inspectedColumn:10,inspectedSourcePage:1,
    exactCellTextNotLogged:true,certifiedPublisherCells:0,
  }));
  const downloadPromise=page.waitForEvent("download",{timeout:75000});
  await page.getByRole("button",{name:"Export selected table (.xlsx)"}).click();
  const download=await downloadPromise;
  const filename=await download.path();
  if(!filename)throw Error("No actual XLSX from original publisher PDF");
  const zip=await JSZip.loadAsync(await readFile(filename));
  const names=Object.keys(zip.files).filter(name=>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  expect(names).toHaveLength(2);
  const unescape=txt=>String(txt??"").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
  const sheet=await zip.file("xl/worksheets/sheet1.xml")?.async("string")??"";
  const reviews=await zip.file("xl/worksheets/sheet2.xml")?.async("string")??"";
  const parsed=[...sheet.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)].map(row=>{
    const values=Array.from({length:11},()=>"");
    for(const cell of row[1].matchAll(
      /<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)){
      const c=[...cell[1]].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;
      const texts=[...cell[2].matchAll(
        /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
        .map(m=>unescape(m[1])).join("");
      if(c>=0&&c<11)values[c]=texts||unescape(
        cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??"");
    }
    return values;
  });
  expect(parsed).toHaveLength(13);
  // R106 source geometry acceptance: recovered header line breaks must be
  // literal inside the original XLSX inline strings; no guessed extra row
  // or edited body cells. UI helper alone cannot satisfy this gate.
  const nativeWideXmlHeaderCells=[...sheet.matchAll(
    /<c r="([A-K])1"[^>]*>([\s\S]*?)<\/c>/g)];
  const multilineCount=nativeWideXmlHeaderCells.filter(c=>
    /<t(?:\s[^>]*)?>([\s\S]*?\n[\s\S]*?)<\/t>/.test(c[2])).length;
  const wideStyles=await zip.file("xl/styles.xml")?.async("string")??"";
  const headerWrapped=sheet.includes('<row r="1" ht="68" customHeight="1">') &&
    sheet.includes('ySplit="1" topLeftCell="A2"') &&
    wideStyles.includes('wrapText="1"');
  console.log("R106_ORIGINAL_WIDE_HEADER_LINE_PRESERVATION "+JSON.stringify({
    source:source.id,fullPdfHashVerified:true,originalHeaderRows:1,
    bodyRows:12,columns:11,multilineHeaderCells:multilineCount,
    nativeStylesApplied:headerWrapped,
    sourceHeaderValuesNotLogged:true,formalReviewerCredit:0,
  }));
  expect(multilineCount).toBeGreaterThan(0);
  expect(headerWrapped).toBe(true);
  expect(reviews).toContain("physical line breaks");
  expect(exactCellLabel).toBe(parsed[12][9]||"(blank cell)");
  // Browser cell inspection must NEVER edit the subsequent downloaded XLSX.

  const normalize=value=>String(value??"").normalize("NFKC")
    .replace(/[^\d]/gu,"");
  const mismatches=[];
  let matches=0;
  for(let r=0;r<12;r++)for(let i=0;i<8;i++){
    const c=reference.referenceColumns[i];
    const actual=normalize(parsed[r+1]?.[c]);
    const expected=normalize(reference.referenceRows[r][i]);
    if(actual===expected)matches++;
    else mismatches.push([r+2,c+1]);
  }
  console.log("R87_PUBLISHER_NUMERIC_XLSX "+JSON.stringify({
    source:source.id,hashVerified:true,rows:13,columns:11,
    comparedNumericalAndBlankPositions:96,matchingPositions:matches,
    mismatchedCoordinates:mismatches,valuesNotLogged:true,
    referenceIsProjectTranscribed:true,independentDocumentCredit:0,
    hasSelectiveWarning:reviews.includes("SELECTIVE EXPORT"),
    hasUnverifiedWarning:reviews.includes("UNVERIFIED"),
  }));
  expect(reviews).toContain("UNVERIFIED");
  expect(reviews).toContain("reconstructed from multiple physical PDF lines");
  expect(/<f(?:\s|>)/.test(sheet)).toBe(false);
  // Enforce the observed 96/96 original-PDF measurement, not an empty baseline.
  expect(matches).toBe(96);
  expect(mismatches).toEqual([]);
  // R102–106 full publisher source audit: enforce ALL twelve real data rows
  // and all eleven publisher columns, including medication, fever, rescue
  // treatment labels and blank cells omitted from the R87 numeric reference.
  // Do not skip source rows, log clinical values or claim independent review.
  const fullReference=JSON.parse(await readFile(
    "benchmarks/release102/pmc3063220-table3-complete-publisher-reference.json","utf8"));
  expect(fullReference.fullPdfSha256).toBe(source.sha256);
  expect(fullReference.expectedRows).toBe(13);
  expect(fullReference.expectedColumns).toBe(11);
  expect(fullReference.body).toHaveLength(12);
  expect(fullReference.body.every(row=>row.length===11)).toBe(true);
  expect(fullReference.formalStableDocumentCredit).toBe(0);
  const clean=value=>String(value??"").normalize("NFKC")
    .trim().toLowerCase().replace(/[\s\u00a0\u2009\u202f]+/gu,"")
    .replace(/[−–—]/gu,"-");
  const sourceDiscrepancies=[];
  const discrepancyColumns=Array(11).fill(0);
  let fullMatches=0;
  for(let r=0;r<12;r++)for(let c=0;c<11;c++){
    if(clean(parsed[r+1]?.[c])===clean(fullReference.body[r][c]))fullMatches++;
    else{
      sourceDiscrepancies.push([r+2,c+1]);
      discrepancyColumns[c]++;
    }
  }
  console.log("R102_FULL_SCIENTIFIC_PUBLISHER_AUDIT "+JSON.stringify({
    originalPublisher:"PMC3063220",hashVerified:true,
    comparedDataCells:132,sourceNormalizedMatches:fullMatches,
    mismatchCoordinates:sourceDiscrepancies,
    differencesByColumn:discrepancyColumns,
    clinicalValuesLogged:false,headerSemanticsIndependent:false,
    formalIndependentCredit:0
  }));
  expect(sourceDiscrepancies).toEqual([]);
  expect(fullMatches).toBe(132);

});


/**
 * R88 full original publisher PDF page → real XLSX. Unlike the source-shape
 * diagnostic, this verifies the downloadable workbook, selective/unverified
 * disclosure, row/column dimensions, and formula safety. It is NOT a blind
 * publisher-reference cell-value certification.
 */
test("R88 PMC3464982 actual 28x3 native source table to XLSX",async({page})=>{
  test.setTimeout(240_000);
  const source=release77PmcCases.find(s=>s.id==="PMC3464982");
  if(!source)throw Error("R88 original publisher fixture missing");
  const bytes=await boundedPmcPdf(source.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(8);
  const excerpt=await PDFDocument.create();
  excerpt.addPage((await excerpt.copyPages(original,[source.pageNumber-1]))[0]);
  const selected=Buffer.from(await excerpt.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC3464982-original-page5.pdf",mimeType:"application/pdf",buffer:selected,
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:150000});
  const target=page.locator("label").filter({hasText:/28 rows × 3 columns/})
    .locator('input[type="radio"]');
  await expect(target).toHaveCount(1);
  await expect(target).toBeEnabled();
  await target.check();
  const pending=page.waitForEvent("download",{timeout:75000});
  await page.getByRole("button",{name:"Export selected table (.xlsx)"}).click();
  const download=await pending;
  const file=await download.path();
  if(!file)throw Error("R88 browser download missing");
  const zip=await JSZip.loadAsync(await readFile(file));
  const sheetNames=Object.keys(zip.files).filter(n=>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  expect(sheetNames).toHaveLength(2);
  const sheet=await zip.file("xl/worksheets/sheet1.xml")?.async("string")??"";
  const review=await zip.file("xl/worksheets/sheet2.xml")?.async("string")??"";
  const xmlRows=[...sheet.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)];
  expect(xmlRows).toHaveLength(28);
  const validCellAddress=/^([A-C])(\d{1,2})$/;
  let cellCount=0;
  for(const row of xmlRows){
    const cells=[...row[1].matchAll(/<c r="([A-Z]+\d+)"[^>]*>[\s\S]*?<\/c>/g)];
    for(const cell of cells){
      const match=validCellAddress.exec(cell[1]);
      expect(match).not.toBeNull();
      expect(Number(match?.[2])).toBeGreaterThanOrEqual(1);
      expect(Number(match?.[2])).toBeLessThanOrEqual(28);
      cellCount++;
    }
  }
  expect(cellCount).toBeGreaterThanOrEqual(55);
  expect(/<f(?:\s|>)/.test(sheet)).toBe(false);
  expect(review).toContain("SELECTIVE EXPORT");
  expect(review).toContain("UNVERIFIED");

  // R89: compare the *actual downloaded workbook* to the separately
  // transcribed publisher Table 3, including category blanks and headings.
  // The reference comes from publisher HTML, not from V4's PDF output.
  const ref=JSON.parse(await readFile(
    "benchmarks/release89/pmc3464982-table3-publisher-reference.json","utf8"));
  expect(ref.sourceFullPdfSha256).toBe(source.sha256);
  expect(ref.expectedShape).toEqual([28,3]);
  expect(ref.rows).toHaveLength(28);
  expect(ref.rows.every(r=>Array.isArray(r)&&r.length===3)).toBe(true);
  expect(ref.reviewedIndependently).toBe(false);
  expect(ref.acceptedDocumentCredit).toBe(0);
  const decode=value=>String(value??"").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'").replace(/&amp;/g,"&");
  const actual=Array.from({length:28},()=>Array.from({length:3},()=>""));
  const seen=new Set();
  for(const match of sheet.matchAll(
    /<c r="([A-Z]+)(\d+)"[^>]*>([\s\S]*?)<\/c>/g)){
    const column=[...match[1]].reduce((sum,ch)=>
      sum*26+ch.charCodeAt(0)-64,0)-1;
    const row=Number(match[2])-1;
    expect(row).toBeGreaterThanOrEqual(0);
    expect(row).toBeLessThan(28);
    expect(column).toBeGreaterThanOrEqual(0);
    expect(column).toBeLessThan(3);
    const address=match[1]+match[2];
    expect(seen.has(address)).toBe(false);
    seen.add(address);
    const textValues=[...match[3].matchAll(
      /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join("");
    actual[row][column]=textValues||decode(
      match[3].match(/<v>([\s\S]*?)<\/v>/)?.[1]??"");
  }
  const normalize=value=>String(value??"").normalize("NFKC")
    .replace(/[\u00a0\u2009\u202f]/g," ").replace(/\s+/g," ")
    .trim().toLowerCase().replace(/[–—−]/g,"-")
    .replace(/(?<=\d),(?=\d{3}\b)/g,"");
  const discrepancies=[];
  let matches=0;
  for(let row=0;row<28;row++)for(let col=0;col<3;col++){
    const observed=normalize(actual[row][col]);
    const publisher=normalize(ref.rows[row][col]);
    if(observed===publisher)matches++;
    else discrepancies.push([row+1,col+1]);
  }
  console.log("R89_PUBLISHER_SOURCE_CELL_AUDIT "+JSON.stringify({
    id:source.id,hashVerified:true,rows:28,columns:3,
    comparedCells:84,exactNormalizedCellMatches:matches,
    mismatchCoordinates:discrepancies,sourceValuesNotLogged:true,
    referenceIsProjectTranscribed:true,independentlyAdjudicated:false,
    acceptedDocumentCredit:0,
  }));
  // Zero mismatch gate must never be relaxed to make CI green.
  expect(matches).toBe(84);
  expect(discrepancies).toEqual([]);
  console.log("R88_ORIGINAL_XLSX "+JSON.stringify({
    source:source.id,sourceHashVerified:true,publisherPdfPages:8,
    exportedRows:28,exportedColumns:3,workbookCells:cellCount,
    formulaCount:0,hasUnverifiedReview:true,
    comparisonToIndependentSourceCells:false,
    acceptedCertificationCredit:0,
  }));
});


/**
 * R90: source-first dense 34 × 7 atomic-displacement table, not another
 * fabricated PDF. Read the ORIGINAL 13-page publisher PDF and export its
 * actual page-9 workbook in Chromium, checking selected published atomic
 * labels + numerical measurements independently of PDF parser output.
 */
test("R90 real PMC3297222 dense native 34x7 XLSX publisher cell audit",async({page})=>{
  test.setTimeout(240_000);
  const source=release77PmcCases.find(entry=>entry.id==="PMC3297222");
  if(!source)throw Error("Original R90 publisher source missing");
  const reference=JSON.parse(await readFile(
    "benchmarks/release90/pmc3297222-atomic-displacement-publisher-reference.json","utf8"));
  expect(reference.sourceFullPdfSha256).toBe(source.sha256);
  expect(reference.sourcePdfPages).toBe(13);
  expect(reference.expectedTableRows).toBe(34);
  expect(reference.expectedTableColumns).toBe(7);
  expect(reference.selectedRows).toHaveLength(33);
  expect(reference.selectedRows.every(r=>r.length===7)).toBe(true);
  expect(reference.acceptedFormalV4DocumentCredit).toBe(0);

  const bytes=await boundedPmcPdf(source.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  const original=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(original.getPageCount()).toBe(source.sourcePageCount);
  const excerpt=await PDFDocument.create();
  excerpt.addPage((await excerpt.copyPages(original,[source.pageNumber-1]))[0]);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC3297222-original-page9.pdf",mimeType:"application/pdf",
    buffer:Buffer.from(await excerpt.save()),
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:150000});
  const selected=page.locator("label").filter({hasText:/34 rows × 7 columns/})
    .locator('input[type="radio"]');
  await expect(selected).toHaveCount(1);
  await expect(selected).toBeEnabled();
  await selected.check();
  const downloading=page.waitForEvent("download",{timeout:75000});
  await page.getByRole("button",{name:"Export selected table (.xlsx)"}).click();
  const file=await (await downloading).path();
  if(!file)throw Error("Original 34x7 Excel browser download missing");
  const zip=await JSZip.loadAsync(await readFile(file));
  const sheets=Object.keys(zip.files).filter(name=>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  expect(sheets).toHaveLength(2);
  const xml=await zip.file("xl/worksheets/sheet1.xml")?.async("string")??"";
  const review=await zip.file("xl/worksheets/sheet2.xml")?.async("string")??"";
  const decode=value=>String(value??"").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'").replace(/&amp;/g,"&");
  const actual=Array.from({length:34},()=>Array.from({length:7},()=>""));
  const seen=new Set();
  for(const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>([\s\S]*?)<\/c>/g)){
    const col=[...m[1]].reduce((v,ch)=>v*26+ch.charCodeAt(0)-64,0)-1;
    const row=Number(m[2])-1;
    expect(row).toBeGreaterThanOrEqual(0);
    expect(row).toBeLessThan(34);
    expect(col).toBeGreaterThanOrEqual(0);
    expect(col).toBeLessThan(7);
    const key=m[1]+m[2];
    expect(seen.has(key)).toBe(false);
    seen.add(key);
    const texts=[...m[3].matchAll(
      /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(q=>decode(q[1])).join("");
    actual[row][col]=texts||decode(m[3].match(/<v>([\s\S]*?)<\/v>/)?.[1]??"");
  }
  expect([...xml.matchAll(/<row r="\d+"/g)]).toHaveLength(34);
  expect(/<f(?:\s|>)/.test(xml)).toBe(false);
  expect(review).toContain("UNVERIFIED");
  expect(review).toContain("SELECTIVE EXPORT");

  // The first column must identify publisher atom labels in their
  // actual table order; do not cherry-pick or skip missing source rows.
  const clean=value=>String(value??"").normalize("NFKC")
    .trim().replace(/[\s\u00a0\u2009\u202f]+/g,"")
    .replace(/[−–—]/g,"-").replace(/[′’]/g,"'").toLowerCase();
  const expected=reference.selectedRows;
  const start=actual.findIndex(row=>clean(row[0])===clean(expected[0][0]));
  const failures=[];let matches=0;
  for(let row=0;row<expected.length;row++)for(let col=0;col<7;col++){
    const observed=clean(actual[start+row]?.[col]);
    const target=clean(expected[row][col]);
    if(start>=0&&observed===target)matches++;
    else failures.push([start+row+1,col+1]);
  }
  console.log("R90_REAL_PUBLISHER_ATOMIC_CELL_AUDIT "+JSON.stringify({
    originalSource:source.id,originalHashVerified:true,
    verifiedWorkbookDimensions:[34,7],firstMatchedSourceRow:start+1,
    selectedPublisherSourceCells:231,matchingCells:matches,
    mismatchCoordinates:failures,formulaCount:0,
    publisherHtmlReferenceProjectTranscribed:true,independentCredit:0,
  }));
  // Do not silently lower this gate: source values must be independently
  // adjudicated before counting any formal V4 Stable document.
  expect(start).toBeGreaterThanOrEqual(0);
  expect(matches).toBe(231);
  expect(failures).toEqual([]);
});


/**
 * R96 original-source CSV confidence: use the real publisher PDF, select the
 * unchanged native 28x3 table, click the new CSV export and compare all 84
 * exact data positions to the independent-from-converter publisher HTML
 * project-transcribed reference. Not independent adjudication (0/20).
 */
test("R96 original PMC3464982 selected PDF table exports safe source-matched CSV",async({page})=>{
  test.setTimeout(240_000);
  const src=release77PmcCases.find(s=>s.id==="PMC3464982");
  if(!src)throw Error("Original publisher PDF fixture missing");
  const reference=JSON.parse(await readFile(
    "benchmarks/release89/pmc3464982-table3-publisher-reference.json","utf8"));
  expect(reference.sourceFullPdfSha256).toBe(src.sha256);
  const bytes=await boundedPmcPdf(src.sourceUrl);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(src.sha256);
  const full=await PDFDocument.load(bytes,{ignoreEncryption:false});
  expect(full.getPageCount()).toBe(8);
  const excerpt=await PDFDocument.create();
  excerpt.addPage((await excerpt.copyPages(full,[src.pageNumber-1]))[0]);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"PMC3464982-original-page5.pdf",mimeType:"application/pdf",
    buffer:Buffer.from(await excerpt.save()),
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("heading",{name:"Select one detected table"}))
    .toBeVisible({timeout:150000});
  const choice=page.locator("label").filter({hasText:/28 rows × 3 columns/})
    .locator('input[type="radio"]');
  await expect(choice).toHaveCount(1);
  await choice.check();
  await expect(page.getByText("Export selected table (.csv)")).toBeVisible();
  const downloading=page.waitForEvent("download",{timeout:75000});
  await page.getByRole("button",{name:"Export selected table (.csv)"}).click();
  const dl=await downloading;
  expect(dl.suggestedFilename()).toMatch(/-table-\d+\.csv$/i);
  const file=await dl.path();
  if(!file)throw Error("Actual original-publisher selected-table CSV missing");
  const csv=await readFile(file,"utf8");
  expect(csv.charCodeAt(0)).toBe(65279); // UTF-8 BOM for Excel.
  const lines=csv.slice(1).trimEnd().split("\r\n");
  const cells=lines.map(line=>{
    const tokens=[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)]
      .map(m=>m[1].replace(/""/g,'"'));
    expect(tokens).toHaveLength(3);
    return tokens;
  });
  expect(cells).toHaveLength(28);
  const normalize=value=>String(value??"").normalize("NFKC")
    .replace(/[\u00a0\u2009\u202f]/g," ")
    .replace(/\s+/g," ").trim().toLowerCase().replace(/[–—−]/g,"-")
    .replace(/(?<=\d),(?=\d{3}\b)/g,"");
  const mismatches=[];
  for(let row=0;row<28;row++)for(let col=0;col<3;col++){
    if(normalize(cells[row][col])!==normalize(reference.rows[row][col]))
      mismatches.push([row+1,col+1]);
  }
  console.log("R96_ORIGINAL_SELECTED_CSV_AUDIT "+JSON.stringify({
    source:src.id,publisherFullPdfHashVerified:true,
    exportedRows:28,exportedColumns:3,comparedProjectPublisherCells:84,
    matchedCells:84-mismatches.length,mismatchCoordinates:mismatches,
    excelBOM:true,independentDocumentCredit:0,
  }));
  expect(mismatches).toEqual([]);
});
