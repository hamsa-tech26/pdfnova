import type {PdfV4PreparedOcrPage} from "./ocrPageRenderer";
import type {PdfV4OcrRectangle} from "./ocrRecognizer";

/**
 * R135: show the exact source-image crop beside a user's optional OCR review.
 * This is display-only and remains in browser memory: never a table finding,
 * accepted OCR cell, persistent document, network upload, or workbook image.
 */
export const SOURCE_PREVIEW_MAX_EDGE=960;
export type EmbeddedImagePreviewSize={width:number;height:number};

export function planEmbeddedImageSourcePreview(
  rectangle:PdfV4OcrRectangle,
  renderedWidth:number,
  renderedHeight:number,
):EmbeddedImagePreviewSize|null{
  const values=[
    rectangle.left,rectangle.top,rectangle.width,rectangle.height,
    renderedWidth,renderedHeight,
  ];
  if(values.some(value=>!Number.isFinite(value))||
    rectangle.left<0||rectangle.top<0||
    rectangle.width<10||rectangle.height<10||
    renderedWidth<10||renderedHeight<10||
    rectangle.left+rectangle.width>renderedWidth||
    rectangle.top+rectangle.height>renderedHeight)return null;
  const ratio=Math.min(1,SOURCE_PREVIEW_MAX_EDGE/
    Math.max(rectangle.width,rectangle.height));
  return {
    width:Math.max(1,Math.round(rectangle.width*ratio)),
    height:Math.max(1,Math.round(rectangle.height*ratio)),
  };
}

export async function createEmbeddedImageSourcePreview(
  page:PdfV4PreparedOcrPage,
  rectangle:PdfV4OcrRectangle,
):Promise<string|null>{
  const dimensions=planEmbeddedImageSourcePreview(
    rectangle,page.width,page.height,
  );
  if(!dimensions||typeof window==="undefined"||
    typeof document==="undefined"||typeof Image==="undefined"||
    !page.imageDataUrl.startsWith("data:image/"))return null;

  const image=new Image();
  try{
    await new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(Error("Source image preview could not be decoded."));
      image.src=page.imageDataUrl;
    });
    if(image.naturalWidth!==page.width||image.naturalHeight!==page.height)
      return null;
    const canvas=document.createElement("canvas");
    canvas.width=dimensions.width;
    canvas.height=dimensions.height;
    const context=canvas.getContext("2d");
    if(!context)return null;
    context.drawImage(image,
      rectangle.left,rectangle.top,rectangle.width,rectangle.height,
      0,0,dimensions.width,dimensions.height);
    // Bounded lossy preview only. OCR still uses the original rendered PNG.
    const preview=canvas.toDataURL("image/jpeg",0.82);
    return preview.startsWith("data:image/jpeg;base64,")&&
      preview.length<=1_500_000?preview:null;
  }finally{
    image.onload=null;
    image.onerror=null;
    image.src="";
  }
}
