import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,rgb} from "pdf-lib";

function pyAssert(lines,args,path){
  const result=execFileSync("python",["-c",lines.join("\n"),path,...args],{
    encoding:"utf8",timeout:30000,maxBuffer:128*1024,
  });
  expect(result).toContain("TASK243_INDEPENDENT_OK");
}

test("live JPG/PNG-to-PDF preserves color image order and fitted page dimensions",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/jpg-to-pdf",{waitUntil:"networkidle"});
  const pngs=await page.evaluate(()=>{
    const make=(color)=>{
      const c=document.createElement("canvas");
      c.width=120;c.height=120;
      const ctx=c.getContext("2d");
      ctx.fillStyle=color;ctx.fillRect(0,0,120,120);
      return c.toDataURL("image/png").split(",")[1];
    };
    return {red:make("#ff0000"),blue:make("#0000ff")};
  });
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"TASK243_RED.png",mimeType:"image/png",buffer:Buffer.from(pngs.red,"base64")},
    {name:"TASK243_BLUE.png",mimeType:"image/png",buffer:Buffer.from(pngs.blue,"base64")},
  ]);
  const fit=page.getByRole("button",{name:/Fit to image/i});
  await expect(fit).toBeVisible({timeout:15000});
  await fit.click();
  const action=page.getByRole("button",{name:"Create and Download PDF"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("kukureku-images.pdf");
  const output=await download.path();expect(output).toBeTruthy();
  pyAssert([
    "import fitz,sys",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for p in doc:",
    "    assert abs(p.rect.width-120)<1 and abs(p.rect.height-120)<1",
    "    assert len(p.get_images(full=True))>=1,'Raster page image absent'",
    "a=doc[0].get_pixmap(alpha=False).pixel(60,60)",
    "b=doc[1].get_pixmap(alpha=False).pixel(60,60)",
    "assert a[0]>220 and a[1]<55 and a[2]<55,'Red page misplaced'",
    "assert b[2]>220 and b[0]<55 and b[1]<55,'Blue page misplaced'",
    "print('TASK243_INDEPENDENT_OK')",
  ],[],output);
  console.log(JSON.stringify({check:"TASK243_LIVE_PNG_TO_PDF",
    status:"PASS",source:"SYNTHETIC_ONLY",images:2,
    orderedColors:["red","blue"],independentReader:"PyMuPDF",
    colorAndPageGeometryVerified:true}));
});

test("live PDF-to-JPG exports a three-page ZIP with exact JPEG names and colors",async({page})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const colors=[rgb(1,0,0),rgb(0,1,0),rgb(0,0,1)];
  for(const color of colors){
    const p=pdf.addPage([300,300]);
    p.drawRectangle({x:0,y:0,width:300,height:300,color,borderWidth:0});
  }
  await page.goto("/pdf-to-jpg",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK243_RASTER_SOURCE.pdf",mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  const action=page.getByRole("button",{name:"Download All as ZIP"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("kukureku-all-jpg-pages.zip");
  const output=await download.path();expect(output).toBeTruthy();
  pyAssert([
    "import sys,zipfile,io",
    "from PIL import Image",
    "z=zipfile.ZipFile(io.BytesIO(open(sys.argv[1],'rb').read()))",
    "assert z.testzip() is None,'ZIP corrupted'",
    "expected=['kukureku-page-'+str(i)+'.jpg' for i in range(1,4)]",
    "assert sorted(z.namelist())==expected,'Unexpected page count or filenames'",
    "for name,dominant in zip(expected,[0,1,2]):",
    "    im=Image.open(io.BytesIO(z.read(name)))",
    "    assert im.format=='JPEG','Unexpected image format'",
    "    im=im.convert('RGB')",
    "    assert im.width>=300 and im.height>=300,'JPG resolution too small'",
    "    pix=im.getpixel((im.width//2,im.height//2))",
    "    assert pix[dominant]>185 and max(pix[i] for i in range(3) if i!=dominant)<95,'Wrong color/page order'",
    "print('TASK243_INDEPENDENT_OK')",
  ],[],output);
  console.log(JSON.stringify({check:"TASK243_LIVE_PDF_TO_JPG_ZIP",
    status:"PASS",source:"SYNTHETIC_ONLY",pages:3,
    zipEntries:3,independentReader:"Python zipfile/Pillow",
    pageOrderColors:["red","green","blue"],jpegFormatVerified:true}));
});
