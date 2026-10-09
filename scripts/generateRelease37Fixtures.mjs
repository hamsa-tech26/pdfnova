import {PDFDocument, StandardFonts, rgb} from "pdf-lib";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join} from "node:path";

const dir=join("test-fixtures","release37");
await mkdir(dir,{recursive:true});
const input=await readFile(join("test-fixtures","phase10_14","phase10_14a_low_resolution_blur.pdf"));
const hybrid=await PDFDocument.create();
const font=await hybrid.embedFont(StandardFonts.Helvetica);
const lines=[
 "This page contains selectable native PDF text that must be preserved exactly.",
 "Original words must retain their native PDF provenance after the analysis.",
 "The scanner is only needed for the second page of this hybrid document.",
 "This fourth paragraph makes native text extraction unambiguously sufficient.",
];
function drawLines(page,strings,at=780,fontInstance=font) {
  strings.forEach((text,index)=>page.drawText(text,{x:45,y:at-30*index,size:12,font:fontInstance,color:rgb(0.1,0.12,0.2)}));
}
const p1=hybrid.addPage([595,842]);
drawLines(p1,lines);
const [scanPage]=await hybrid.copyPages(await PDFDocument.load(input),[0]);
hybrid.addPage(scanPage);
const p3=hybrid.addPage([595,842]);
drawLines(p3,[
 "Mixed page: native text above a scanned inset that is not fully recognized.",
 "Page routing must not replace native text with guessed scanned words.",
 "Embedded raster content requires explicit review and is NOT VERIFIED.",
 "Reliable extraction of selectable paragraphs is not proof of inset OCR.",
]);
const [embedded]=await hybrid.embedPdf(input,[0]);
p3.drawPage(embedded,{x:60,y:80,width:320,height:460});
const hybridFile=join(dir,"hybrid_native_scan_inset.pdf");
await writeFile(hybridFile,await hybrid.save());

const complex=await PDFDocument.create();
const cf=await complex.embedFont(StandardFonts.Helvetica);
const cp=complex.addPage([595,842]);
cp.drawText("Combined Water Supply Status  -  spanning title",{x:40,y:790,size:15,font:cf});
cp.drawText("Location",{x:40,y:751,size:12,font:cf});
cp.drawText("Scheme metadata (two nested subcolumns)",{x:165,y:751,size:12,font:cf});
cp.drawText("Village",{x:40,y:722,size:11,font:cf});
cp.drawText("Capacity",{x:170,y:722,size:11,font:cf});
cp.drawText("Status",{x:330,y:722,size:11,font:cf});
for(let i=0;i<8;i++){
  const y=680-i*35;
  cp.drawText("Sector "+(i+1),{x:40,y,size:11,font:cf});
  cp.drawText(String(1000+i*250),{x:170,y,size:11,font:cf});
  cp.drawText(i%2?"Repair needed":"Functional",{x:330,y,size:11,font:cf});
}
await writeFile(join(dir,"complex_nested_header.pdf"),await complex.save());

const continuation=await PDFDocument.create();
const nf=await continuation.embedFont(StandardFonts.Helvetica);
for(let pageIndex=0;pageIndex<2;pageIndex++){
  const p=continuation.addPage([595,842]);
  p.drawText("Water Scheme Register",{x:45,y:795,size:15,font:nf});
  const x=[45,115,260,400];
  ["Sl No","Name of Scheme","Status","Remarks"].forEach((v,i)=>
    p.drawText(v,{x:x[i],y:760,size:11,font:nf}));
  for(let n=1;n<=9;n++){
    const serial=pageIndex*9+n;
    [String(serial),"Scheme "+serial,serial%2?"Functional":"Review","Area "+serial].forEach((v,i)=>
      p.drawText(v,{x:x[i],y:722-32*n,size:10,font:nf}));
  }
}
await writeFile(join(dir,"two_page_continuation.pdf"),await continuation.save());
console.log(JSON.stringify({generated:[hybridFile,join(dir,"complex_nested_header.pdf"),join(dir,"two_page_continuation.pdf")],scope:"synthetic-only"}));
