import {describe,expect,it} from "vitest";
import {
  planEmbeddedImageSourcePreview,SOURCE_PREVIEW_MAX_EDGE,
  createEmbeddedImageSourcePreview,
} from "../embeddedImageSourcePreview";
import type {PdfV4PreparedOcrPage} from "../ocrPageRenderer";

describe("R135 browser-local source-image review previews",()=>{
  it("uses the precise crop geometry at native size when small",()=>{
    expect(planEmbeddedImageSourcePreview(
      {left:160,top:320,width:300,height:130},1220,1584,
    )).toEqual({width:300,height:130});
  });
  it("proportionally bounds large image panels without upscaling",()=>{
    expect(planEmbeddedImageSourcePreview(
      {left:100,top:100,width:1600,height:800},2000,1200,
    )).toEqual({width:960,height:480});
    const height=planEmbeddedImageSourcePreview(
      {left:0,top:100,width:400,height:1600},2000,2000,
    );
    expect(height).toEqual({width:240,height:SOURCE_PREVIEW_MAX_EDGE});
  });
  it("refuses impossible crop coordinates and corrupt viewport metadata",()=>{
    const good={left:1,top:1,width:20,height:20};
    expect(planEmbeddedImageSourcePreview({...good,left:-1},100,100)).toBeNull();
    expect(planEmbeddedImageSourcePreview({...good,width:101},100,100)).toBeNull();
    expect(planEmbeddedImageSourcePreview({...good,top:90},100,100)).toBeNull();
    expect(planEmbeddedImageSourcePreview({...good,width:5},100,100)).toBeNull();
    expect(planEmbeddedImageSourcePreview({...good,left:Number.NaN},100,100)).toBeNull();
    expect(planEmbeddedImageSourcePreview(good,0,100)).toBeNull();
  });
  it("does not attempt image processing on the server or from invalid source data",async()=>{
    const page:PdfV4PreparedOcrPage={
      pageNumber:1,width:600,height:900,imageDataUrl:"data:image/png;base64,c2FtcGxl",
      source:"pdf-render",
    };
    expect(await createEmbeddedImageSourcePreview(page,
      {left:10,top:20,width:300,height:180})).toBeNull();
    expect(await createEmbeddedImageSourcePreview({...page,imageDataUrl:"https://example.test/image"},
      {left:10,top:20,width:300,height:180})).toBeNull();
  });
});
