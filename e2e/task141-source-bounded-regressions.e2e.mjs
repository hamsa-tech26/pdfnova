import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect,test} from "@playwright/test";

// All four real PDFs are pinned public references, provided outside Git by
// environment variables. A missing fixture is NOT evidence of a passing test.
const sources=[
  {
    name:"invoice",path:process.env.KUKUREKU_INVOICE_REFERENCE_PATH,
    sha:"0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b",
    rows:5,columns:9,preview:"0085648100305",
    reviewNote:"ROTATED INVOICE SOURCE REVIEW",
  },
  {
    name:"usda",path:process.env.KUKUREKU_USDA_REFERENCE_PATH,
    sha:"4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb",
    rows:42,columns:5,preview:"Iowa",
    reviewNote:"SOURCE-BOUNDED USDA PANEL REVIEW",
    refusedCandidate:/1 rows × 8 columns/,
  },
  {
    name:"fbi",path:process.env.KUKUREKU_FBI_REFERENCE_PATH,
    sha:"4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407",
    rows:58,columns:25,preview:"18,870",
    reviewNote:"FBI NICS DENSE GRID SOURCE REVIEW",
  },
  {
    name:"nrel",path:process.env.KUKUREKU_NREL_REFERENCE_PATH,
    sha:"7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82",
    rows:7,columns:7,preview:"2012_2",
    reviewNote:"NREL TABLE 2-1 SOURCE REVIEW",
    refusedCandidate:/6 rows × 7 columns/,
  },
];

// For the dedicated qualification run, do not silently convert missing
// reference files into a green test report with four skips.
if(process.env.KUKUREKU_TASK141_REQUIRE_REFERENCES==="1"){
  const absent=sources.filter(source=>!source.path).map(source=>source.name);
  if(absent.length)throw new Error(`Task141 requires pinned PDFs: ${absent.join(", ")}`);
}

const independentReader=`
import io,sys
from openpyxl import load_workbook
kind, path, expected_note = sys.argv[1:]
book=load_workbook(io.BytesIO(open(path,'rb').read()), data_only=False)
tables=[s for s in book if s.title!='Review Notes']
assert len(tables)==1, book.sheetnames
sheet=tables[0]
rows=list(sheet.values)
dims={'invoice':(5,9),'usda':(42,5),'fbi':(58,25),'nrel':(7,7)}
assert (len(rows),len(rows[0]))==dims[kind], (kind,len(rows),len(rows[0]))
assert all(len(row)==dims[kind][1] for row in rows)
assert all(cell.data_type!='f' for row in sheet for cell in row), 'untrusted formula'
notes=' '.join(str(r[0]) for r in book['Review Notes'].values)
assert expected_note in notes, notes
assert 'EXTRACTION NOT VERIFIED' in notes, notes
if kind=='invoice':
    assert rows[0]==('Line no','UPC code','Location','Item Description','Item Quantity','Bill Amount','Accrued Amount','Handling Rate','PO number')
    assert [r[1] for r in rows[1:]]==['0085648100305','0085648100380','0085648100303','0085648100300']
    assert all(r[0] in (None,'') and r[8] in (None,'') for r in rows[1:])
elif kind=='usda':
    assert rows[0][0] in (None,'')
    assert rows[0][1:]==('W/E 02/24/17','Last Week','Year Ago','Internet Report Link')
    assert rows[2]==('Iowa','1.35 - 1.42','1.38 - 1.43','1.27 - 1.35','Iowa Ethanol')
    assert rows[-1]==('NYMEX Heating Oil ($/gal)','1.6567','1.6291','1.0792','CME Group')
    assert all('2.60'!=v for row in rows for v in row), 'chart text leaked'
elif kind=='fbi':
    assert rows[2][0]=='Alabama' and rows[2][1]=='18,870'
    assert rows[6][0]=='California' and rows[6][1]=='98 452' and rows[6][24]=='180 116'
    assert all(rows[r][16] in (None,'') and rows[r][17] in (None,'') for r in range(2,57))
    assert rows[57][0]=='Totals' and rows[57][16]=='0' and rows[57][17]=='0' and rows[57][24]=='2,236,457'
elif kind=='nrel':
    assert rows[0][3]=='Percent Fuel Savings'
    assert rows[1]==('Cycle Name','KI (1/km)','Distance (mi)','Improved Speed','Decreased Accel','Eliminate Stops','Decreased Idle')
    assert rows[2]==('2012_2','3.30','1.3','5.9%','9.5%','29.2%','17.4%')
    assert rows[6]==('4171_1','0.07','173.9','58.1%','1.6%','2.1%','0.5%')
print('TASK141_'+kind.upper()+'_REVIEWED_XLSX_PASS')
`;

for(const source of sources){
  test(`Task141 ${source.name}: published PDF stays review-only and downloads source-aligned XLSX`,async({page})=>{
    test.skip(!source.path,`${source.name}: pinned external reference not provided`);
    test.setTimeout(180000);
    const original=readFileSync(source.path);
    expect(createHash("sha256").update(original).digest("hex")).toBe(source.sha);
    let downloadCount=0;
    page.on("download",()=>downloadCount++);
    await page.goto("/pdf-to-excel");
    await page.locator('input[type="file"]').setInputFiles({
      name:`task141-${source.name}.pdf`,mimeType:"application/pdf",buffer:original,
    });
    await page.getByRole("button",{name:"Inspect & choose a table"}).click();
    const choice=page.getByRole("radio",{
      name:new RegExp(`${source.rows} rows × ${source.columns} columns`),
    });
    await expect(choice).toBeEnabled({timeout:90000});
    if(source.refusedCandidate){
      await expect(page.getByRole("radio",{name:source.refusedCandidate})).toBeDisabled();
    }
    expect(downloadCount).toBe(0);
    await choice.check();
    await expect(page.getByRole("region",{
      name:"Scrollable extracted spreadsheet preview",
    })).toContainText(source.preview);
    const exportButton=page.getByRole("button",{name:"Export selected table (.xlsx)"});
    await expect(exportButton).toBeDisabled();
    await page.getByRole("checkbox",{
      name:"Acknowledge scientific table source review",
    }).check();
    await expect(exportButton).toBeEnabled();
    const [download]=await Promise.all([
      page.waitForEvent("download",{timeout:90000}),exportButton.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    const path=await download.path();
    expect(path).toBeTruthy();
    expect(execFileSync("python",["-c",independentReader,
      source.name,path,source.reviewNote],{encoding:"utf8",timeout:25000}))
      .toContain(`TASK141_${source.name.toUpperCase()}_REVIEWED_XLSX_PASS`);
    expect(downloadCount).toBe(1);
  });
}
