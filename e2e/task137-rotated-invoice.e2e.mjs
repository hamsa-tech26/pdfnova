import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect,test} from "@playwright/test";

const referencePath=process.env.KUKUREKU_INVOICE_REFERENCE_PATH;
test.skip(!referencePath,"Source-pinned public real invoice is not provided locally.");

test("Task137 rotated invoice: reviewed XLSX keeps UPC identifiers, nine positions and all four source rows",async({page})=>{
  test.setTimeout(180000);
  const original=readFileSync(referencePath);
  expect(createHash("sha256").update(original).digest("hex")).toBe(
    "0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b");
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"issue-140-example.pdf",mimeType:"application/pdf",buffer:original,
  });
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByText("Table 1 — Page 1 — 5 rows × 9 columns")).toBeVisible({timeout:60000});
  await page.getByRole("radio",{name:/Table 1 — Page 1 — 5 rows × 9 columns/}).check();
  const preview=page.getByRole("region",{name:"Scrollable extracted spreadsheet preview"});
  await expect(preview).toContainText("0085648100305");
  await expect(preview).toContainText("253.15");
  const exportButton=page.getByRole("button",{name:"Export selected table (.xlsx)"});
  await expect(exportButton).toBeDisabled();
  await page.getByRole("checkbox",{name:"Acknowledge scientific table source review"}).check();
  await expect(exportButton).toBeEnabled();
  const [download]=await Promise.all([
    page.waitForEvent("download",{timeout:60000}),exportButton.click(),
  ]);
  const file=await download.path();
  expect(file).toBeTruthy();
  const script=[
    "import sys",
    "from openpyxl import load_workbook",
    "w=load_workbook(sys.argv[1],read_only=False,data_only=False)",
    "s=[s for s in w if s.title!='Review Notes']",
    "assert len(s)==1,w.sheetnames",
    "r=list(s[0].values)",
    "assert len(r)==5,(len(r),r)",
    "assert all(len(row)==9 for row in r),r",
    "assert r[0]==('Line no','UPC code','Location','Item Description','Item Quantity','Bill Amount','Accrued Amount','Handling Rate','PO number'),r[0]",
    "assert [row[1] for row in r[1:]]==['0085648100305','0085648100380','0085648100303','0085648100300'],r",
    "assert [row[3] for row in r[1:]]==['LILYS 40% SLTD ALMND CHOC','LILYS DRK CHC CRMLZD SLTD','LILYS ALMND 55% DARK CHOC','LILYS 55% DARK CHOC BAR'],r",
    "assert all((row[0] is None or row[0]=='') and (row[8] is None or row[8]=='') for row in r[1:]),r",
    "assert all(row[5]=='$ 0.61' for row in r[1:]),r",
    "assert all(all(s[0].cell(i,j).data_type!='f' for j in range(1,10)) for i in range(1,6)), 'formula injection'",
    "notes=' '.join(str(row[0]) for row in w['Review Notes'].values)",
    "assert 'ROTATED INVOICE SOURCE REVIEW' in notes,notes",
    "print('TASK137_REAL_INVOICE_XLSX_37_CELLS_PASS')",
  ].join("; ");
  expect(execFileSync("python",["-c",script,file],{encoding:"utf8"}))
    .toContain("TASK137_REAL_INVOICE_XLSX_37_CELLS_PASS");
});
