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
