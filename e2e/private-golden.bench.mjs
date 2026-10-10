import {test,expect} from "@playwright/test";
import {PDFDocument} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {readFile} from "node:fs/promises";
import {privateCorpus,readPrivatePdf,writePrivateResult} from "../scripts/privateGoldenLocal.mjs";
import {scorePrivateCase} from "../scripts/privateGoldenScorer.mjs";
// Runs only with explicit local config, never in GitHub CI.
const manifest=await privateCorpus();
async function pages(bytes){
  const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
  const task=getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:true,isEvalSupported:false});
  const doc=await task.promise,all=[];
  try{
    for(let i=1;i<=doc.numPages;i++){
      const p=await doc.getPage(i),text=await p.getTextContent(),physical=pdf.getPage(i-1);
      all.push({width:physical.getWidth(),height:physical.getHeight(),rotation:physical.getRotation().angle,
        text:text.items.map(x=>String(x.str??"")).join(" ")});
      p.cleanup();
    }
  }finally{await task.destroy();}
  return all;
}
async function download(page,label){
  const promise=page.waitForEvent("download",{timeout:240000});
  await page.getByRole("button",{name:label}).click();
  return readFile(await (await promise).path());
}
function tableRows(analysis,index){
  const table=analysis.tables?.[index];
  if(!table||!Array.isArray(table.rows))return null;
  return table.rows.map(row=>{
    const cells=Array.isArray(row.cells)?row.cells:[];
    const width=Math.min(50,Math.max(table.columnCount??0,...cells.map(c=>(c.columnIndex??-1)+1),0));
    const result=Array.from({length:width},()=>"");
    for(const c of cells)if(Number.isInteger(c.columnIndex)&&c.columnIndex>=0&&c.columnIndex<width)
      result[c.columnIndex]=String(c.text??"");
    return result;
  });
}
for(const entry of manifest.cases){
  test("private Golden Document: "+entry.id,async({page})=>{
    test.setTimeout(360000);
    const possibleUploads=[];
    page.on("request",req=>{
      if(["POST","PUT","PATCH"].includes(req.method())&&/\/api\/|upload|convert/i.test(req.url()))
        possibleUploads.push(req.method());
    });
    try{
      const source=await readPrivatePdf(entry);
      let observed=null,spec=entry,route="",button="";
      if(entry.category==="layout"){
        if(scorePrivateCase(entry,{measured:true,pages:await pages(source)}).status!=="PASS")
          throw Error("SOURCE_ANNOTATION_MISMATCH");
        route="/reverse-pdf";button="Reverse and Download PDF";
      }else if(entry.category==="form"){route="/flatten-pdf";button="Flatten and Download PDF";}
      else if(entry.category==="ocr-text"){route="/ocr-pdf";button="Run OCR and Download TXT";}
      else {route="/engine-inspector";button="Download complete result JSON";}
      await page.goto(route);
      await page.locator('input[type="file"]').first().setInputFiles({
        name:entry.file,mimeType:"application/pdf",buffer:source});
      const saved=await download(page,button);
      if(entry.category==="layout"){
        observed={measured:true,pages:await pages(saved)};
        spec={...entry,expected:{...entry.expected,pages:[...entry.expected.pages].reverse()}};
      }else if(entry.category==="form"){
        const doc=await PDFDocument.load(saved,{updateMetadata:false});
        observed={measured:true,flattenedText:(await pages(saved)).map(p=>p.text).join(" "),
          remainingFieldCount:doc.getForm().getFields().length};
      }else if(entry.category==="ocr-text"){
        observed={measured:true,text:saved.toString("utf8")};
      }else{
        const data=JSON.parse(saved.toString("utf8"));
        observed={measured:true,rows:tableRows(data,entry.expected.tableIndex)};
      }
      if(possibleUploads.length)throw Error("UNEXPECTED_UPLOAD_REQUEST");
      const score=scorePrivateCase(spec,observed);
      await writePrivateResult(entry,score);
      expect(score.status).toBe("PASS");
    }catch{
      await writePrivateResult(entry,{status:"FAIL",reasonCode:"PRIVATE_CASE_FAILED",metrics:{}});
      throw Error("Private Golden Document "+entry.id+" failed; no source text or PDF content disclosed.");
    }
  });
}
