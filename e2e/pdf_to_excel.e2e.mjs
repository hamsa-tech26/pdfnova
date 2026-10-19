import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { execFileSync } from "node:child_process";

test("browser downloads real XLSX from an independent five-column PDF", async ({ page }) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const sheet = pdf.addPage([900, 760]);
  const columns = [45, 120, 285, 450, 605];
  const rows = [
    ["Sl No", "Code", "Name", "Amount", "Remarks"],
    ...Array.from({length: 12}, (_, i) => [
      String(i+1), String(71+i).padStart(5,"0"),
      "Station " + (i+1), String(1000+i*11), "Reviewed " + (i+1),
    ]),
  ];
  rows.forEach((row, i) => row.forEach((cell,j) => {
    sheet.drawText(cell, {x:columns[j], y:690-i*36, size:12,font});
  }));
  const buffer = Buffer.from(await pdf.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"R57_five_column_table.pdf", mimeType:"application/pdf", buffer,
  });
  const [download] = await Promise.all([
    page.waitForEvent("download", {timeout:120000}),
    page.getByRole("button", {name:/Convert to Excel/i}).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs/promises");
  const zip = await JSZip.loadAsync(await fs.readFile(path));
  const workbook = await zip.file("xl/workbook.xml")?.async("string");
  expect(workbook).toContain('<sheet name="Table 1"');
  const worksheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  expect(worksheet).toContain("Station 12");
  expect(worksheet).toContain("00071");
  expect(worksheet).not.toContain("<f>");
  expect(worksheet).toMatch(/<dimension ref="A1:[A-Z]+1[0-9]"/);
  // The review sheet is intentionally separate from detected table sheets.
  expect(await zip.file("xl/worksheets/sheet2.xml")?.async("string"))
    .toContain("EXTRACTION NOT VERIFIED");

  // Separate OOXML implementation reads actual downloaded file;
  // ZIP string inspection alone does not establish Excel interoperability.
  const independentlyParsed = execFileSync("python", [
    "-c",
    "import sys,io; from openpyxl import load_workbook; " +
      "w=load_workbook(io.BytesIO(open(sys.argv[1], 'rb').read()), read_only=True, data_only=False); " +
      "s=w['Table 1']; r=list(s.values); " +
      "assert any(len(x)>=5 and x[1]=='00071' and x[2]=='Station 1' and x[3]=='1000' for x in r), 'row/column mismatch'; " +
      "assert any(len(x)>=5 and x[2]=='Station 12' for x in r), 'missing final row'; " +
      "assert w['Review Notes']['A1'].value.startswith('EXTRACTION NOT VERIFIED'); print('OPENPYXL_OK')",
    path,
  ], {encoding:"utf8"}).trim();
  expect(independentlyParsed).toContain("OPENPYXL_OK");

  // A real successful conversion must remain readable in BOTH theme modes.
  // Browser-computed colors detect failures caused by conflicting dark styles.
  await expect(page.getByRole("heading", {name: "Excel workbook created"})).toBeVisible();
  await expect(page.getByText("Extraction review — not certified")).toBeVisible();
  const themeToggle = page.getByRole("button", {name: "Toggle theme"});
  const html = page.locator("html");
  if (await html.evaluate(element => element.classList.contains("dark"))) {
    await themeToggle.click();
  }
  await expect(html).not.toHaveClass(/dark/);

  async function inspectResultContrast() {
    return page.evaluate(() => {
      const title = [...document.querySelectorAll("h2")].find(
        element => element.textContent?.trim() === "Excel workbook created");
      const reviewTitle = [...document.querySelectorAll("p")].find(
        element => element.textContent?.trim() === "Extraction review — not certified");
      if (!title || !reviewTitle || !reviewTitle.parentElement) {
        throw new Error("Missing success/review result panel");
      }
      const reviewPanel = reviewTitle.parentElement;
      const reviewMessage = reviewTitle.nextElementSibling;
      if (!reviewMessage) throw new Error("Missing review warning");
      function rgba(value) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas color support unavailable");
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      }
      function luminance(color) {
        return rgba(color).map(x => {
          const value = x / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, component, index) =>
          sum + component * [0.2126, 0.7152, 0.0722][index], 0);
      }
      function ratio(fg, bg) {
        const a = luminance(fg), b = luminance(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      const background = getComputedStyle(reviewPanel).backgroundColor;
      return {
        titleColor: getComputedStyle(title).color,
        successGradient: getComputedStyle(title.closest("section")).backgroundImage,
        reviewBackground: background,
        reviewTitleContrast: ratio(getComputedStyle(reviewTitle).color, background),
        reviewTextContrast: ratio(getComputedStyle(reviewMessage).color, background),
      };
    });
  }
  const lightStyles = await inspectResultContrast();
  await themeToggle.click();
  await expect(html).toHaveClass(/dark/);
  const darkStyles = await inspectResultContrast();
  for (const result of [lightStyles, darkStyles]) {
    expect(result.reviewTitleContrast).toBeGreaterThanOrEqual(4.5);
    expect(result.reviewTextContrast).toBeGreaterThanOrEqual(4.5);
  }
  expect(lightStyles.titleColor).not.toBe(darkStyles.titleColor);
  expect(lightStyles.successGradient).not.toBe(darkStyles.successGradient);
  expect(lightStyles.reviewBackground).not.toBe(darkStyles.reviewBackground);

});


test("scanned-only or empty PDF is explicitly rejected without an XLSX download", async ({page}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 400]).drawRectangle({x:50,y:50,width:450,height:200});
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"R57_scanned_only.pdf", mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  let wasDownloaded = false;
  page.on("download", () => { wasDownloaded = true; });
  await page.getByRole("button", {name:/Convert to Excel/i}).click();
  await expect(page.getByText(/image-only or low-text pages/)).toBeVisible();
  expect(wasDownloaded).toBe(false);
});


test("two-page selectable tables retain first/last records and source-page review notes", async ({page}) => {
  test.setTimeout(180_000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const xs=[45,120,285,450,605];
  for(let p=0;p<2;p++){
    const sheet=pdf.addPage([900,760]);
    const rows=[
      ["Sl No","Code","Name","Amount","Remarks"],
      ...Array.from({length:10},(_,i)=>{
        const serial=p*10+i+1;
        return [String(serial),String(70+serial).padStart(5,"0"),
          "Record "+serial,String(1100+serial*13),"Checked "+serial];
      }),
    ];
    rows.forEach((row,i)=>row.forEach((value,j)=>{
      sheet.drawText(value,{x:xs[j],y:690-i*42,size:12,font});
    }));
  }
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"R60_two_page_continuation.pdf",
    mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  const [download]=await Promise.all([
    page.waitForEvent("download",{timeout:120000}),
    page.getByRole("button",{name:/Convert to Excel/i}).click(),
  ]);
  const file=await download.path();
  expect(file).toBeTruthy();
  const verified=execFileSync("python",["-c",
    "import sys,io; from openpyxl import load_workbook; "+
    "w=load_workbook(io.BytesIO(open(sys.argv[1], 'rb').read()),read_only=True,data_only=False); "+
    "tabs=[s for s in w if s.title!='Review Notes']; "+
    "rows=[r for s in tabs for r in s.values]; "+
    "assert any(len(r)>=5 and r[1]=='00071' and r[2]=='Record 1' for r in rows), 'missing first-page data'; "+
    "assert any(len(r)>=5 and r[1]=='00090' and r[2]=='Record 20' for r in rows), 'missing second-page data'; "+
    "notes=' '.join(str(r[0] or '') for r in w['Review Notes'].values); "+
    "assert 'Page 1' in notes or 'Pages 1-2' in notes, 'missing source page 1 provenance'; "+
    "assert 'Page 2' in notes or 'Pages 1-2' in notes, 'missing source page 2 provenance'; "+
    "print('R60_MULTIPAGE_OPENPYXL_OK')",
    file],{encoding:"utf8"}).trim();
  expect(verified).toContain("R60_MULTIPAGE_OPENPYXL_OK");
});


test("3-page sanitized eight-field PDF never silently downloads collapsed five-column XLSX", async ({ page }) => {
  test.setTimeout(180_000);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const xs = [38, 82, 132, 231, 344, 470, 603, 714, 815];
  for (let p = 0; p < 3; p++) {
    const sheet = pdf.addPage([1000, 790]);
    if (p === 0) {
      const headers = ["Row", "Identifier", "District", "Block", "Group",
        "Habitation", "Households", "Connections", "Flag"];
      headers.forEach((v, j) => sheet.drawText(v, { x: xs[j], y: 754, size: 10, font }));
    }
    for (let i = 0; i < 12; i++) {
      const n = p * 12 + i + 1;
      const cells = [String(n), String(9000 + n), "District Alpha", "Block Beta",
        "Group Gamma", "Site " + n, String(50 + n), String(40 + n), "N"];
      cells.forEach((v, j) => sheet.drawText(v, {
        x: xs[j], y: 715 - i * 36, size: 10, font,
      }));
    }
  }
  const buffer = Buffer.from(await pdf.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic_8_field_3page_structure.pdf",
    mimeType: "application/pdf", buffer,
  });

  const downloadPromise = page.waitForEvent("download", { timeout: 110_000 })
    .then(download => ({ kind: "download", download }));
  const refusalPromise = page.getByText("Excel conversion withheld")
    .waitFor({ timeout: 110_000 })
    .then(() => ({ kind: "refused" }));
  await page.getByRole("button", { name: /Convert to Excel/i }).click();
  const outcome = await Promise.race([downloadPromise, refusalPromise]);

  if (outcome.kind === "refused") {
    // Safe, reviewable refusal is acceptable while nonconforming geometry is
    // still unsupported. A downloadable but silently damaged table is not.
    await expect(page.getByText(/columns are merged|uncertain|reliable/i).first())
      .toBeVisible();
    return;
  }
  const file = await outcome.download.path();
  expect(file).toBeTruthy();
  const script = [
    "import sys, io",
    "from openpyxl import load_workbook",
    "w=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=True)",
    "sheets=[s for s in w if s.title!='Review Notes']",
    "assert len(sheets)==1, 'Continuation split across worksheets'",
    "rows=list(sheets[0].values)",
    "data=[list(map(lambda x: str(x or ''),r)) for r in rows]",
    "ids=[str(9000+i) for i in range(1,37)]",
    "matches=[r for r in data if len(r)>=8 and any(v in r for v in ids)]",
    "assert len(matches)==36,'Missing source rows'",
    "assert all('District Alpha' in r and 'Block Beta' in r and 'Group Gamma' in r for r in matches),'Source columns fused'",
    "assert all(len(r)>=8 for r in matches),'Collapsed source table'",
    "assert any('9036' in r and 'Site 36' in r for r in matches),'Missing final page'",
    "print('STRUCTURAL_XLSX_OK')",
  ].join("; ");
  expect(execFileSync("python", ["-c", script, file], {
    encoding: "utf8",
  })).toContain("STRUCTURAL_XLSX_OK");
});


test("native numbered 8-column guide reconstructs 87 fictional rows over three pages into separate XLSX fields",async ({page})=>{
  test.setTimeout(180_000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const counts=[24,33,30], anchors=[109,158,218,295,394,495,598,672];
  let serial=0;
  for(let p=0;p<counts.length;p++){
    const sheet=pdf.addPage([792,730]);
    if(p===0){
      anchors.forEach((x,j)=>sheet.drawText(String(j+1),{
        x:x-3,y:680,size:10,font,
      }));
      const sourceLabels=[
        [101,"Sl No"],[146,"District"],[209,"Block"],
        [251,"Name of GP/VC"],[354,"Habitation Name"],
        [475,"households"],[586,"FHTC"],[662,"PVTG"],
      ];
      sourceLabels.forEach(([x,label])=>sheet.drawText(label,{
        x:Number(x),y:708,size:10,font,
      }));
      sheet.drawText("SYNTHETIC TEST ONLY",{
        x:250,y:723,size:10,font,
      });
    }
    for(let i=0;i<counts[p];i++){
      serial++;
      const y=650-i*16;
      // Two independently placed native PDF text items each contain two
      // visually distinct fields. No customer data is present in this PDF.
      const cells=[
        [94,String(serial)+" "+String(4000+serial)+" North County"],
        [196,"Sector Beta Council Delta"],
        [352,"Settlement "+serial],
        [493,String(50+serial)],
        [596,String(40+serial)],
        ...(serial===15?[]:[[672,"Y"]]),
      ];
      cells.forEach(([x,v])=>sheet.drawText(v,{
        x:Number(x),y,size:10,font,
      }));
    }
  }
  expect(serial).toBe(87);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"synthetic_native_8_column_87_rows.pdf",
    mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  const [download]=await Promise.all([
    page.waitForEvent("download",{timeout:120000}),
    page.getByRole("button",{name:/Convert to Excel/i}).click(),
  ]);
  const saved=await download.path();expect(saved).toBeTruthy();
  const script=[
    "import sys,io",
    "from openpyxl import load_workbook",
    "w=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=False,data_only=False)",
    "assert w.sheetnames==['Table 1','Review Notes'],w.sheetnames",
    "rows=list(w['Table 1'].values)",
    "assert len(rows)==88,('record count',len(rows))",
    "assert all(len(r)==8 for r in rows), 'eight independent columns required'",
    "assert rows[1]==('4001','North County','Sector Beta','Council Delta','Settlement 1',51,41,'Y'),rows[1]",
    "assert rows[15][7] is None or rows[15][7]=='','blank flag damaged'",
    "assert rows[-1]==('4087','North County','Sector Beta','Council Delta','Settlement 87',137,127,'Y'),rows[-1]",
    "assert sum(int(r[5]) for r in rows[1:])==sum(range(51,138))",
    "assert sum(int(r[6]) for r in rows[1:])==sum(range(41,128))",
    "notes=' '.join(str(r[0]) for r in w['Review Notes'].values)",
    "assert rows[0]==('Sl No','District','Block','GP/VC (IMIS)','Habitation Name','Households (IMIS)','FHTCs Provided (IMIS)','PVTG (Y/N)'),rows[0]",
    "assert w['Table 1'].freeze_panes=='A2','header not frozen'",
    "assert w['Table 1'].auto_filter.ref=='A1:H88','table filters missing'",
    "assert isinstance(rows[1][5],int) and isinstance(rows[1][6],int),'metrics not usable as numbers'",
    "assert isinstance(rows[1][0],str),'identifiers wrongly coerced to numbers'",
    "assert 'Abbreviated column labels' in notes and 'EXTRACTION NOT VERIFIED' in notes",
    "print('NATIVE_87_ROWS_8_COLUMNS_OK')",
  ].join("; ");
  expect(execFileSync("python",["-c",script,saved],{encoding:"utf8"}))
    .toContain("NATIVE_87_ROWS_8_COLUMNS_OK");
});


test("R123 public opt-in image OCR: explicit reviewed rows produce separate safe XLSX",async({page})=>{
  test.setTimeout(300000);
  await page.goto("/pdf-to-excel");
  // Independent browser-rendered source bitmap: real embedded raster table
  // inside a page also containing enough selectable native explanatory text.
  const pngBase64=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=1200;canvas.height=430;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw Error("Canvas unavailable");
    ctx.fillStyle="#fff";ctx.fillRect(0,0,1200,430);
    ctx.fillStyle="#000";ctx.font="bold 64px monospace";
    ctx.fillText("ITEM      COST",60,85);
    ctx.font="56px monospace";
    ctx.fillText("StationA  1200",60,180);
    ctx.fillText("StationB  00071",60,275);
    ctx.fillText("StationC  01300",60,370);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const doc=await PDFDocument.create();
  const pdfFont=await doc.embedFont(StandardFonts.Helvetica);
  const sheet=doc.addPage([760,800]);
  for(let i=0;i<24;i++)
    sheet.drawText("Published report narrative sentence "+(i+1)+
      " discussing survey sampling, written in selectable text.",{
      x:35,y:775-i*15,size:10,font:pdfFont,
    });
  const raster=await doc.embedPng(Buffer.from(pngBase64,"base64"));
  sheet.drawImage(raster,{x:80,y:100,width:600,height:255});
  const pdfBytes=Buffer.from(await doc.save());
  await page.locator('input[type="file"]').setInputFiles({
    name:"R123_hybrid_image_table.pdf",mimeType:"application/pdf",buffer:pdfBytes,
  });
  const buttons=page.getByRole("button");
  await expect(buttons.getByText("Inspect embedded images for optional OCR")).toBeVisible();
  await page.getByRole("button",{name:"Inspect embedded images for optional OCR"}).click();
  await expect(page.getByRole("heading",{name:"Optional embedded-image to Excel review"})).toBeVisible({timeout:90000});
  await page.getByRole("button",{name:"Run image OCR on selected page"}).click();
  await expect(page.getByLabel(/Your corrected table/)).toBeVisible({timeout:180000});
  // R127: OCR table proposal is strictly optional. If the renderer/recognizer
  // produces stable row/column geometry, prefilling must NEVER preview,
  // confirm or download by itself. On irregular images show refusal instead.
  const useProposal=page.getByRole("button",{name:"Copy tentative grid for manual correction"});
  if(await useProposal.isVisible().catch(()=>false)){
    await useProposal.click();
    await expect(page.getByLabel(/Your corrected table/)).not.toHaveValue("");
    await expect(page.getByRole("checkbox",{name:/I compared this edited grid/})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Download confirmed image table (.xlsx)"})).toHaveCount(0);
    console.log("R128: tentative image-table cells remain editable, unpreviewed and unapproved");
  }else{
    await expect(page.getByText(/Automatic row\/column suggestion withheld/)).toBeVisible();
    console.log("R128: incomplete image-table evidence is visibly withheld");
  }

  // OCR alone NEVER enables download; require manual cell entry and confirmation.
  await expect(page.getByRole("button",{name:"Download confirmed image table (.xlsx)"})).toHaveCount(0);
  await page.getByLabel(/Your corrected table/).fill(
    "Code\tValue\n00071\t=SUM(A1:A9)\nA2\t00123"
  );
  await page.getByRole("button",{name:"Preview my corrected cells"}).click();
  await expect(page.getByRole("region",{name:"Reviewed image table cell preview"})).toContainText("00071");
  const downloadButton=page.getByRole("button",{name:"Download confirmed image table (.xlsx)"});
  await expect(downloadButton).toBeDisabled();
  await page.getByRole("checkbox",{name:/I compared this edited grid/}).check();
  const [download]=await Promise.all([
    page.waitForEvent("download",{timeout:120000}),downloadButton.click()
  ]);
  expect(download.suggestedFilename()).toBe("R123_hybrid_image_table-user-reviewed-image.xlsx");
  const path=await download.path();
  const fs=await import("node:fs/promises");
  const workbook=await JSZip.loadAsync(await fs.readFile(path));
  const manifest=await workbook.file("xl/workbook.xml")?.async("string");
  expect(manifest).toContain("User-Reviewed Image Table");
  expect(manifest).toContain("Review Notes");
  const grid=await workbook.file("xl/worksheets/sheet1.xml")?.async("string");
  expect(grid).toContain("00071");
  expect(grid).toContain("=SUM(A1:A9)");
  expect(grid).not.toContain("<f>");
  const notes=await workbook.file("xl/worksheets/sheet2.xml")?.async("string");
  expect(notes).toContain("SOURCE: PDF page 1 of 1");
  expect(notes).toContain("No OCR words were inserted into source-native logical tables");
});
