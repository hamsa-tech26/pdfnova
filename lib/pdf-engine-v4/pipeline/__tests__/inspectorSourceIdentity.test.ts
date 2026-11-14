import {describe,expect,it} from "vitest";
import {createInspectorSourceIdentity} from "../inspectorSourceIdentity";

describe("Internal V4 Inspector export source identity",()=>{
  it("hashes the original browser File/Blob bytes without exposing their text",async()=>{
    const proof=await createInspectorSourceIdentity(new Blob(["abc"]));
    expect(proof).toMatchObject({
      schema:"kukureku-v4-browser-original-source-v1",
      algorithm:"SHA-256",
      sha256:"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      fileSizeBytes:3,
      provenance:"INSPECTOR_FILE_OBJECT_AT_JSON_EXPORT",
    });
    expect(JSON.stringify(proof)).not.toContain("abc");
  });
});
