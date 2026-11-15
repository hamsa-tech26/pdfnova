import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

// Runs against deployed kukureku.com in Linux Playwright WebKit, not an iPhone.
// Synthetic PDFs are generated in the runner; no private documents are used.
async function nativeTable(){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const sheet=pdf.addPage([900,760]);
  const xs=[45,120,285,450,605];
  const rows=[
    ["Sl No","Code","Name","Amount","Remarks"],
    ...Array.from({length:12},(_,i)=>[
      String(i+1),String(i+71).padStart(5,"0"),"Station "+(i+1),
      String(1000+i*11),"Reviewed "+(i+1)
    ])
  ];
  rows.forEach((row,i)=>row.forEach((value,j)=>{
    sheet.drawText(value,{x:xs[j],y:690-i*36,size:12,font});
  }));
  return Buffer.from(await pdf.save());
}

test("WebKit at 390px uploads a native PDF and downloads an independently verified XLSX",async({page,browserName})=>{
  expect(browserName).toBe("webkit");
  test.setTimeout(180000);
  await page.goto("/pdf-to-excel",{waitUntil:"networkidle"});
  const source=await nativeTable();
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK224_WEBKIT_TABLE.pdf",
    mimeType:"application/pdf",buffer:source,
  });
  const convert=page.getByRole("button",{name:/Convert to Excel/i});
  await expect(convert).toBeVisible({timeout:15000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await convert.click();
  const downloaded=await pending;
  expect(downloaded.suggestedFilename()).toMatch(/\.xlsx$/);
  const p=await downloaded.path();
  expect(p).toBeTruthy();
  const raw=await readFile(p);
  expect(raw.subarray(0,2).toString("ascii")).toBe("PK");
  // Explicit BytesIO: Playwright's temporary filenames have no .xlsx suffix.
  // Independent Python/openpyxl validates every source row, cell and order.
  const reader=[
    "import sys,io",
    "from openpyxl import load_workbook",
    "w=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=False,data_only=False)",
    "assert w.sheetnames==['Table 1','Review Notes'],w.sheetnames",
    "expected=[('Sl No','Code','Name','Amount','Remarks')]+[(str(i+1),str(i+71).zfill(5),'Station '+str(i+1),str(1000+i*11),'Reviewed '+str(i+1)) for i in range(12)]",
    "assert list(w['Table 1'].values)==expected,'Source-to-XLSX row/column/cell mismatch'",
    "assert w['Review Notes']['A1'].value.startswith('EXTRACTION NOT VERIFIED')",
    "assert all(c.data_type!='f' for row in w['Table 1'] for c in row)",
    "print('TASK224_WEBKIT_SOURCE_FIDELITY_PASS')",
  ].join("\n");
  const verify=execFileSync("python",["-c",reader,p],{encoding:"utf8",timeout:30000});
  expect(verify).toContain("TASK224_WEBKIT_SOURCE_FIDELITY_PASS");
  await expect(page.getByRole("heading",{name:"Excel workbook created"})).toBeVisible();
  console.log(JSON.stringify({check:"LIVE_TASK224_WEBKIT_XLSX",status:"PASS",
    engine:"Playwright WebKit",viewport:"390x844",source:"SYNTHETIC_ONLY",
    sourceRows:13,sourceColumns:5,independentWorkbookReader:"openpyxl",
    actualIPhoneTested:false,realDocumentCertification:false}));
});

test("WebKit visibly refuses a text-free source without an XLSX download",async({page,browserName})=>{
  expect(browserName).toBe("webkit");
  test.setTimeout(120000);
  const pdf=await PDFDocument.create();
  pdf.addPage([600,400]).drawRectangle({x:50,y:50,width:300,height:120});
  await page.goto("/pdf-to-excel",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK224_NO_TEXT.pdf",
    mimeType:"application/pdf",buffer:Buffer.from(await pdf.save()),
  });
  let downloaded=false;
  page.on("download",()=>{downloaded=true;});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  await expect(page.getByText(/image-only or low-text pages/i)).toBeVisible({timeout:30000});
  expect(downloaded).toBe(false);
  console.log(JSON.stringify({check:"LIVE_TASK224_WEBKIT_SAFE_REFUSAL",
    status:"PASS",engine:"Playwright WebKit",source:"SYNTHETIC_ONLY",
    actualIPhoneTested:false}));
});


test("WebKit does not silently corrupt captioned 4-column and 3-column native tables",async({page,browserName})=>{
  expect(browserName).toBe("webkit");
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const [p1,p2,p3]=[pdf.addPage([595,842]),pdf.addPage([595,842]),pdf.addPage([595,842])];
  const draw=(p,t,x,y,strong=false)=>
    p.drawText(t,{x,y,size:10,font:strong?bold:font});
  draw(p1,"Two columns of explanatory prose",48,780,true);
  for(let k=0;k<6;k++){
    draw(p1,"Routine explanation and service review.",48,700-k*21);
    draw(p1,"These lines must not be spreadsheet rows.",310,700-k*21);
  }
  const drawFour=(caption,headers,rows,captionY)=>{
    const x=[66,247,338,437];
    draw(p2,caption,57,captionY,true);
    headers.forEach((v,i)=>draw(p2,v,x[i],captionY-30,true));
    rows.forEach((row,k)=>row.forEach((v,i)=>{
      const px=i===1?321-font.widthOfTextAtSize(v,10):
        i===2?419-font.widthOfTextAtSize(v,10):x[i];
      draw(p2,v,px,captionY-61-k*31.5);
    }));
  };
  drawFour("TABLE A - Supply Summary",
    ["Scheme","Homes","Target KLD","Status"],
    [["Alpha","120","8.40","Active"],["Beta","80","5.60","Active"],
     ["Gamma","60","4.20","Review"],["TOTAL","260","18.20","-"]],686);
  drawFour("TABLE B - Material Summary",
    ["Material","Quantity","Rate INR","Amount INR"],
    [["Pipe 32 mm","20","150","3000"],["Valve","4","250","1000"],
     ["Coupler","10","60","600"],["TOTAL","34","-","4600"]],494);
  draw(p3,"TABLE C - Service Requests",48,710,true);
  ["Service","Requests","Result"].forEach((v,i)=>
    draw(p3,v,[59,363.5,500][i],655,true));
  const three=[["Repair call","12","Closed"],["Meter reading","8","Pending"],
    ["Water testing","5","Closed"],["TOTAL","25","-"]];
  three.forEach((row,k)=>row.forEach((v,i)=>{
    const x=i===0?59:i===1?413-font.widthOfTextAtSize(v,10):
      534-font.widthOfTextAtSize(v,10);
    draw(p3,v,x,607-k*48,k===3);
  }));
  await page.goto("/pdf-to-excel",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK230_CAPTIONED_MIXED_TABLES.pdf",
    mimeType:"application/pdf",buffer:Buffer.from(await pdf.save())
  });
  await expect(page.getByRole("button",{name:/Convert to Excel/i})).toBeVisible();
  const downloaded=page.waitForEvent("download",{timeout:100000})
    .then(d=>({kind:"download",download:d}));
  const withheld=page.getByRole("heading",{name:"Excel conversion withheld"})
    .waitFor({state:"visible",timeout:100000})
    .then(()=>({kind:"withheld"}));
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const result=await Promise.any([downloaded,withheld]);
  if(result.kind==="withheld"){
    await expect(page.getByText(/uncertain|review|reliable|overlap|unsupported|select/i).first()).toBeVisible();
    console.log(JSON.stringify({check:"LIVE_TASK230_WEBKIT_MIXED_NATIVE",
      result:"SAFE_REFUSAL",source:"SYNTHETIC_ONLY",
      sourceTableCount:3,sourcePages:3,sourceCellCount:55,
      corruptionObserved:false,fullConversionNotProven:true}));
    return;
  }
  const path=await result.download.path();
  expect(path).toBeTruthy();
  const reader=[
    "import sys,io",
    "from openpyxl import load_workbook",
    "w=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=True,data_only=False)",
    "sheets=[s for s in w if s.title!='Review Notes']",
    "assert len(sheets)==3,('Expected three source tables',w.sheetnames)",
    "norm=lambda v:'' if v is None else str(v)",
    "rows=[[[norm(v) for v in row] for row in s.values] for s in sheets]",
    "expected=[",
    "[['Scheme','Homes','Target KLD','Status'],['Alpha','120','8.40','Active'],['Beta','80','5.60','Active'],['Gamma','60','4.20','Review'],['TOTAL','260','18.20','-']],",
    "[['Material','Quantity','Rate INR','Amount INR'],['Pipe 32 mm','20','150','3000'],['Valve','4','250','1000'],['Coupler','10','60','600'],['TOTAL','34','-','4600']],",
    "[['Service','Requests','Result'],['Repair call','12','Closed'],['Meter reading','8','Pending'],['Water testing','5','Closed'],['TOTAL','25','-']]]",
    "assert rows==expected, 'Truncated, invented, reordered or transformed source cells'",
    "assert 'Review Notes' in w.sheetnames",
    "assert w['Review Notes']['A1'].value.startswith('EXTRACTION NOT VERIFIED')",
    "print('TASK230_WEBKIT_3_TABLES_55_CELLS_OK')"
  ].join("\n");
  expect(execFileSync("python",["-c",reader,path],{
    encoding:"utf8",timeout:30000
  })).toContain("TASK230_WEBKIT_3_TABLES_55_CELLS_OK");
  console.log(JSON.stringify({check:"LIVE_TASK230_WEBKIT_MIXED_NATIVE",
    result:"PASS",source:"SYNTHETIC_ONLY",
    sourcePages:3,sourceTablesVerified:3,sourceCellsVerified:55,
    independentWorkbookReader:"openpyxl",physicalIPhoneTested:false,
    independentRealDocumentCertified:false}));
});
