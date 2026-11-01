import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {execFileSync} from "node:child_process";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("live Flatten PDF preserves checked and unchecked visible appearances independently",async({page})=>{
  test.setTimeout(240000);
  const temporary=await mkdtemp(join(tmpdir(),"kukureku-task197-"));
  try{
    // Test BOTH polarities to rule out a hardcoded always-on or always-off
    // appearance. The input PDFs contain only invented marker text.
    for(const side of ["left","right"]){
      const pdf=await PDFDocument.create();
      const sheet=pdf.addPage([612,792]);
      const font=await pdf.embedFont(StandardFonts.Helvetica);
      sheet.drawText("SYNTHETIC_TASK197_CONTROL",{x:70,y:710,font,size:14});
      const form=pdf.getForm();
      const left=form.createCheckBox("qa_left");
      const right=form.createCheckBox("qa_right");
      left.addToPage(sheet,{x:125,y:525,width:34,height:34});
      right.addToPage(sheet,{x:350,y:525,width:34,height:34});
      if(side==="left")left.check();
      else right.check();
      const original=Buffer.from(await pdf.save({updateFieldAppearances:false}));
      const inputName="SYNTHETIC_TASK197_"+side.toUpperCase()+".pdf";
      const sourcePath=join(temporary,"original-"+side+".pdf");
      await writeFile(sourcePath,original);

      await page.goto("/flatten-pdf",{waitUntil:"networkidle"});
      await page.locator('input[type="file"]').first().setInputFiles({
        name:inputName,mimeType:"application/pdf",buffer:original
      });
      await expect(page.getByRole("button",{name:"Flatten and Download PDF"})).toBeVisible();
      const pending=page.waitForEvent("download",{timeout:60000});
      await page.getByRole("button",{name:"Flatten and Download PDF"}).click();
      const downloaded=await pending;
      expect(downloaded.suggestedFilename()).toBe(inputName.replace(".pdf","-flattened.pdf"));
      const outputPath=await downloaded.path();
      expect(outputPath).toBeTruthy();

      const readerOutput=execFileSync("python",[
        "scripts/verifySyntheticCheckboxFlatten.py",sourcePath,outputPath,"qa_"+side,
      ],{encoding:"utf8",timeout:30000});
      const readerLines=readerOutput.trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean);
      const reportLine=readerLines.find(line=>line.startsWith('{"result":"PASS"'));
      const diagnostics=readerLines.filter(line=>line!==reportLine);
      if(diagnostics.length){
        // Both files are fictional CI fixtures; diagnostics must be analyzed
        // before accepting a PDF with reader-level format warnings.
        console.log("TASK197_READER_DIAGNOSTICS",JSON.stringify(diagnostics.map(s=>s.slice(0,200))));
      }
      expect(diagnostics,"Independent PDF reader emitted warnings; review before acceptance").toEqual([]);
      expect(reportLine,"Independent reader did not return PASS JSON").toBeTruthy();
      const result=JSON.parse(reportLine);
      expect(result.result).toBe("PASS");
      expect(result.flattenedWidgetCount).toBe(0);
      expect(result.checkboxAppearancePreserved).toBe(true);
      console.log(JSON.stringify({check:"LIVE_V1_CHECKBOX_FLATTEN_"+side.toUpperCase(),
        result:"PASS",syntheticOnly:true,independentReader:"PyMuPDF",
        originalCheckboxes:2,flattenedWidgetCount:0,
        checkedPosition:result.checkedPosition,
        sourceCheckedDarkPixels:result.sourceCheckedDarkPixels,
        flattenedCheckedDarkPixels:result.flattenedCheckedDarkPixels,
        sourceUncheckedDarkPixels:result.sourceUncheckedDarkPixels,
        flattenedUncheckedDarkPixels:result.flattenedUncheckedDarkPixels,
        customerDataLogged:false,
        limitation:"Simple one-page standard AcroForm; does not prove arbitrary XFA/custom widgets or printer rendering"
      }));
    }
  }finally{await rm(temporary,{recursive:true,force:true});}
});
