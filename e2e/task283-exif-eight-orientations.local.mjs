import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

function withExifOrientation(jpegBytes,orientation){
  if(!Number.isInteger(orientation)||orientation<1||orientation>8)throw new Error("Invalid EXIF orientation");
  const exif=Buffer.from([
    0x45,0x78,0x69,0x66,0x00,0x00,
    0x49,0x49,0x2a,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,
    0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,
    orientation,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00
  ]);
  const length=exif.length+2;
  const app1=Buffer.from([0xff,0xe1,(length>>8)&0xff,length&0xff]);
  return Buffer.concat([jpegBytes.subarray(0,2),app1,exif,jpegBytes.subarray(2)]);
}

async function syntheticExifJpeg(page,orientation){
  const dataUrl=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=64; canvas.height=32;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas unavailable");
    context.fillStyle="#e00000"; context.fillRect(0,0,32,16);
    context.fillStyle="#00c800"; context.fillRect(32,0,32,16);
    context.fillStyle="#0000e0"; context.fillRect(0,16,32,16);
    context.fillStyle="#e0d000"; context.fillRect(32,16,32,16);
    return canvas.toDataURL("image/jpeg",1);
  });
  const payload=dataUrl.split(",")[1];
  if(!payload)throw new Error("Synthetic JPEG payload missing");
  return withExifOrientation(Buffer.from(payload,"base64"),orientation);
}

async function syntheticPdf(pageCount,orientation,consumer){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK283_"+consumer+"_EXIF_"+orientation+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:40,y:720,size:14,font});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

function observePrivacy(page,sourceBytes,imageBytes,markers){
  const secrets=[
    sourceBytes,
    Buffer.from(sourceBytes.toString("base64"),"utf8"),
    Buffer.from("%PDF-","utf8"),
    imageBytes,
    Buffer.from(imageBytes.toString("base64"),"utf8"),
    ...markers.map(marker=>Buffer.from(marker,"utf8"))
  ];
  const suspiciousWriteMethods=[];
  let writeRequestCount=0;
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&secrets.some(secret=>body.includes(secret)))suspiciousWriteMethods.push(request.method());
  });
  return {suspiciousWriteMethods,getWriteRequestCount:()=>writeRequestCount};
}

function inspectPdf(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,encoding:"utf8",maxBuffer:256*1024
  });
}

const stampInspection = [
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==1",
  "page=doc[0]",
  "assert sys.argv[2] in page.get_text('text')",
  "orientation=int(sys.argv[3])",
  "expected={1:(64,32,('red','green','blue','yellow')),2:(64,32,('green','red','yellow','blue')),3:(64,32,('yellow','blue','green','red')),4:(64,32,('blue','yellow','red','green')),5:(32,64,('red','blue','green','yellow')),6:(32,64,('blue','red','yellow','green')),7:(32,64,('yellow','green','blue','red')),8:(32,64,('green','yellow','red','blue'))}",
  "width,height,corners=expected[orientation]",
  "candidate=next((img for img in page.get_images(full=True) if img[2]==width and img[3]==height),None)",
  "assert candidate is not None, 'Normalized dimensions do not match orientation'",
  "extracted=doc.extract_image(candidate[0])['image']",
  "assert b'Exif'+bytes([0,0]) not in extracted, 'EXIF metadata remained'",
  "pix=fitz.Pixmap(extracted)",
  "assert (pix.width,pix.height)==(width,height)",
  "points=[(8,4),(56,4),(8,28),(56,28)] if width==64 else [(4,8),(28,8),(4,56),(28,56)]",
  "def sample(x,y):",
  "    offset=(y*pix.width+x)*pix.n",
  "    return tuple(pix.samples[offset:offset+3])",
  "def matches(rgb,name):",
  "    r,g,b=rgb",
  "    if name=='red': return r>135 and r>g+45 and r>b+45",
  "    if name=='green': return g>105 and g>r+40 and g>b+40",
  "    if name=='blue': return b>105 and b>r+40 and b>g+40",
  "    if name=='yellow': return r>125 and g>125 and b<115",
  "    return False",
  "actual=[sample(x,y) for x,y in points]",
  "for index,(rgb,name) in enumerate(zip(actual,corners)): assert matches(rgb,name), f'Orientation {orientation} corner {index} expected {name}, got {rgb}'",
  "rects=page.get_image_rects(candidate[0])",
  "assert rects and abs((rects[0].width/rects[0].height)-(width/height))<0.05",
  "assert not doc.is_repaired",
  "print('TASK283_EXIF_MATRIX_OK')"
].join("\n");

const signInspection = [
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==2",
  "assert sys.argv[2] in doc[0].get_text('text')",
  "assert sys.argv[3] in doc[1].get_text('text')",
  "assert len(doc[0].get_images(full=True))==0, 'Signature appeared on unselected page'",
  "page=doc[1]",
  "orientation=int(sys.argv[4])",
  "expected={1:(64,32,('red','green','blue','yellow')),2:(64,32,('green','red','yellow','blue')),3:(64,32,('yellow','blue','green','red')),4:(64,32,('blue','yellow','red','green')),5:(32,64,('red','blue','green','yellow')),6:(32,64,('blue','red','yellow','green')),7:(32,64,('yellow','green','blue','red')),8:(32,64,('green','yellow','red','blue'))}",
  "width,height,corners=expected[orientation]",
  "candidate=next((img for img in page.get_images(full=True) if img[2]==width and img[3]==height),None)",
  "assert candidate is not None, 'Normalized signature dimensions do not match orientation'",
  "extracted=doc.extract_image(candidate[0])['image']",
  "assert b'Exif'+bytes([0,0]) not in extracted, 'EXIF metadata remained in signature'",
  "pix=fitz.Pixmap(extracted)",
  "assert (pix.width,pix.height)==(width,height)",
  "points=[(8,4),(56,4),(8,28),(56,28)] if width==64 else [(4,8),(28,8),(4,56),(28,56)]",
  "def sample(x,y):",
  "    offset=(y*pix.width+x)*pix.n",
  "    return tuple(pix.samples[offset:offset+3])",
  "def matches(rgb,name):",
  "    r,g,b=rgb",
  "    if name=='red': return r>135 and r>g+45 and r>b+45",
  "    if name=='green': return g>105 and g>r+40 and g>b+40",
  "    if name=='blue': return b>105 and b>r+40 and b>g+40",
  "    if name=='yellow': return r>125 and g>125 and b<115",
  "    return False",
  "actual=[sample(x,y) for x,y in points]",
  "for index,(rgb,name) in enumerate(zip(actual,corners)): assert matches(rgb,name), f'Orientation {orientation} corner {index} expected {name}, got {rgb}'",
  "rects=page.get_image_rects(candidate[0])",
  "assert rects and abs((rects[0].width/rects[0].height)-(width/height))<0.05",
  "assert not doc.is_repaired",
  "print('TASK283_EXIF_MATRIX_OK')"
].join("\n");

test("Add Image Stamp preserves all eight EXIF orientations in downloaded PDFs",async({page,browserName})=>{
  test.setTimeout(600000);
  for(let orientation=1;orientation<=8;orientation+=1){
    const imageBytes=await syntheticExifJpeg(page,orientation);
    const {bytes,markers}=await syntheticPdf(1,orientation,"STAMP");
    const privacy=observePrivacy(page,bytes,imageBytes,markers);
    await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
    await page.locator('input[type="file"]').first().setInputFiles({
      name:"TASK283_STAMP_EXIF_"+orientation+"_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
    });
    await page.getByRole("button",{name:"Upload image",exact:true}).click();
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name:"TASK283_STAMP_EXIF_"+orientation+".jpg",mimeType:"image/jpeg",buffer:imageBytes
    });
    await expect(page.getByText("TASK283_STAMP_EXIF_"+orientation+".jpg",{exact:true})).toBeVisible({timeout:30000});
    const action=page.getByRole("button",{name:"Add and Download PDF"});
    await expect(action).toBeEnabled({timeout:45000});
    const pending=page.waitForEvent("download",{timeout:120000});
    await action.click();
    const download=await pending;
    expect(download.suggestedFilename()).toBe("TASK283_STAMP_EXIF_"+orientation+"_SOURCE-image-stamp.pdf");
    const outputPath=await download.path();
    expect(outputPath).toBeTruthy();
    expect(inspectPdf(outputPath,stampInspection,[markers[0],String(orientation)])).toContain("TASK283_EXIF_MATRIX_OK");
    expect(privacy.getWriteRequestCount()).toBe(0);
    expect(privacy.suspiciousWriteMethods).toEqual([]);
    console.log(JSON.stringify({task:283,consumer:"add-image-stamp",orientation,browser:browserName,source:"synthetic-only",downloadedPdf:true,allFourCornersVerified:true,exifMetadataRemoved:true,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
  }
});

test("Sign PDF preserves all eight EXIF orientations on selected page 2 only",async({page,browserName})=>{
  test.setTimeout(600000);
  for(let orientation=1;orientation<=8;orientation+=1){
    const imageBytes=await syntheticExifJpeg(page,orientation);
    const {bytes,markers}=await syntheticPdf(2,orientation,"SIGN");
    const privacy=observePrivacy(page,bytes,imageBytes,markers);
    await page.goto("/sign-pdf",{waitUntil:"networkidle"});
    await page.locator('input[type="file"]').first().setInputFiles({
      name:"TASK283_SIGN_EXIF_"+orientation+"_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
    });
    await page.getByRole("button",{name:"Upload",exact:true}).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name:"TASK283_SIGN_EXIF_"+orientation+".jpg",mimeType:"image/jpeg",buffer:imageBytes
    });
    await expect(page.getByAltText("Uploaded signature preview")).toBeVisible({timeout:30000});
    await expect(page.getByText("TASK283_SIGN_EXIF_"+orientation+".jpg",{exact:true})).toBeVisible({timeout:30000});
    await page.getByLabel("Sign page").selectOption("2");
    await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});
    const action=page.getByRole("button",{name:"Sign and Download PDF"});
    await expect(action).toBeEnabled({timeout:30000});
    const pending=page.waitForEvent("download",{timeout:120000});
    await action.click();
    const download=await pending;
    expect(download.suggestedFilename()).toBe("TASK283_SIGN_EXIF_"+orientation+"_SOURCE-signed.pdf");
    const outputPath=await download.path();
    expect(outputPath).toBeTruthy();
    expect(inspectPdf(outputPath,signInspection,[markers[0],markers[1],String(orientation)])).toContain("TASK283_EXIF_MATRIX_OK");
    expect(privacy.getWriteRequestCount()).toBe(0);
    expect(privacy.suspiciousWriteMethods).toEqual([]);
    console.log(JSON.stringify({task:283,consumer:"sign-pdf",orientation,browser:browserName,source:"synthetic-only",downloadedPdf:true,allFourCornersVerified:true,exifMetadataRemoved:true,signatureOnSelectedPageOnly:2,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
  }
});
