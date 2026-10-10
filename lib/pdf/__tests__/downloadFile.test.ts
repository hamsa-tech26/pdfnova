import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "../../downloadFile";

describe("downloadFile browser lifecycle", () => {
  let click: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let appendChild: ReturnType<typeof vi.fn>;
  let revoke: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let link: {href:string;download:string;click:()=>void;remove:()=>void};

  beforeEach(() => {
    vi.useFakeTimers();
    click=vi.fn();remove=vi.fn();appendChild=vi.fn();revoke=vi.fn();
    create=vi.fn(()=>"blob:kukureku-test");
    link={href:"",download:"",click,remove};
    vi.stubGlobal("document",{
      createElement:vi.fn((tag:string)=>{expect(tag).toBe("a");return link}),
      body:{appendChild},
    });
    vi.stubGlobal("URL",{createObjectURL:create,revokeObjectURL:revoke});
  });
  afterEach(() => {vi.useRealTimers();vi.unstubAllGlobals();});

  it("keeps the blob URL valid during browser click, then revokes after a bounded delay",()=>{
    downloadFile(new Uint8Array([37,80,68,70]),"fixture.pdf");
    expect(link.download).toBe("fixture.pdf");
    expect(link.href).toBe("blob:kukureku-test");
    expect(click).toHaveBeenCalledOnce();
    expect(appendChild).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(14_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:kukureku-test");
  });

  it("uses explicit output name and MIME, even for generated text",()=>{
    downloadFile(new Uint8Array([65,66]),"test-output.txt","text/plain");
    const createdBlob=create.mock.calls[0][0] as Blob;
    expect(createdBlob.type).toBe("text/plain");
    expect(link.download).toBe("test-output.txt");
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledOnce();
  });
});
