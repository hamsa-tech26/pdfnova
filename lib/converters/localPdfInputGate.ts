/**
 * Browser-local PDF header preflight; never uploads, logs or stores file bytes.
 * PDF 1.x/2.0 headers may follow up to 1024 bytes of preamble.
 * This is a type sniff, NOT proof the PDF is unencrypted or structurally safe;
 * the existing parser and strict page/size limits remain authoritative.
 */
export async function validateLocalPdfInput(file:Blob):Promise<void>{
  if(!file||file.size<8||file.size>25*1024*1024)
    throw Error("Choose a PDF document between 8 bytes and 25 MB.");
  const bytes=new Uint8Array(await file.slice(0,1024).arrayBuffer());
  const needle=[37,80,68,70,45]; // %PDF-
  let found=false;
  for(let i=0;i<=bytes.length-8;i++){
    if(needle.every((n,j)=>bytes[i+j]===n)&&
      bytes[i+5]>=48&&bytes[i+5]<=57&&
      bytes[i+6]===46&&bytes[i+7]>=48&&bytes[i+7]<=57){
      found=true;break;
    }
  }
  if(!found)throw Error(
    "The selected file does not contain a valid PDF header. No conversion was attempted.");
}
