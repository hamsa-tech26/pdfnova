import {describe,expect,it} from "vitest";
import {acceptIdentifierLineReview} from "../ocrLowResolutionReview";

describe("Release 108 targeted ID review never silently selects an ambiguous field",()=>{
  it("preserves an unverified alternative for exactly one source-labelled ID",()=>{
    expect(acceptIdentifierLineReview(
      "Record ID: DC-T316\nItems expected: 24",
      "Record ID: DC-7316",90,
    )).toBe("Record ID: DC-7316");
  });
  it("refuses one competing candidate with two different readings",()=>{
    expect(acceptIdentifierLineReview(
      "Record ID: DC-T316",
      "Record ID: DC-7316\nRecord ID: DC-7318",90,
    )).toBeNull();
  });
  it("refuses duplicate source labels even when one alternative looks plausible",()=>{
    expect(acceptIdentifierLineReview(
      "Record ID: DC-T316\nRecord ID: DC-7317",
      "Record ID: DC-7316",90,
    )).toBeNull();
  });
  it("can identify one label among other differently-labelled source fields",()=>{
    expect(acceptIdentifierLineReview(
      "Invoice Number: INV-23\nRecord ID: DC-T316",
      "Record ID: DC-7316",90,
    )).toBe("Record ID: DC-7316");
  });
  it("refuses unrelated labels, same reading, unsafe confidence and malformed strings",()=>{
    expect(acceptIdentifierLineReview("Invoice ID: A123","Record ID: A999",93)).toBeNull();
    expect(acceptIdentifierLineReview("Record ID: A123","Record ID: A123",93)).toBeNull();
    expect(acceptIdentifierLineReview("Record ID: A123","Record ID: A999",NaN)).toBeNull();
    expect(acceptIdentifierLineReview("Record ID: A123","Record ID: A999".repeat(20),93)).toBeNull();
  });
});
