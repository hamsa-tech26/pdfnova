import { describe, expect, it } from "vitest";
import { dataUrlToBytes } from "../dataUrlBytes";

describe("dataUrlToBytes", () => {
  it("decodes a base64 JPEG data URL without a fetch request", () => {
    expect(dataUrlToBytes("data:image/jpeg;base64,/9j/2Q==")).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );
  });

  it("decodes percent-encoded text payloads", () => {
    expect(dataUrlToBytes("data:text/plain,Hello%20World")).toEqual(
      new TextEncoder().encode("Hello World"),
    );
  });

  it("preserves literal plus signs in non-base64 data URL payloads", () => {
    expect(dataUrlToBytes("data:text/plain,A+B")).toEqual(
      new TextEncoder().encode("A+B"),
    );
  });

  it("decodes percent-encoded binary bytes without UTF-8 normalization", () => {
    expect(
      dataUrlToBytes("data:application/octet-stream,%00%FF%D8%FF%00"),
    ).toEqual(new Uint8Array([0x00, 0xff, 0xd8, 0xff, 0x00]));
  });

  it("decodes percent-escaped characters inside a base64 payload", () => {
    expect(
      dataUrlToBytes("data:application/octet-stream;base64,%2Fw%3D%3D"),
    ).toEqual(new Uint8Array([0xff]));
  });

  it("accepts case-insensitive data schemes and base64 metadata", () => {
    expect(
      dataUrlToBytes("DATA:application/octet-stream;BASE64,AQID"),
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("encodes unescaped Unicode payload text as UTF-8", () => {
    expect(dataUrlToBytes("data:text/plain,☃")).toEqual(
      new TextEncoder().encode("☃"),
    );
  });

  it("rejects values that are not data URLs", () => {
    expect(() => dataUrlToBytes("https://example.com/image.jpg")).toThrow(
      "Expected a data URL",
    );
  });

  it("rejects data URLs without a payload separator", () => {
    expect(() => dataUrlToBytes("data:image/jpeg;base64")).toThrow(
      "payload separator",
    );
  });

  it("rejects malformed base64 data URL payloads", () => {
    expect(() => dataUrlToBytes("data:image/jpeg;base64,%%%")).toThrow();
  });

  it("recognizes base64 metadata when charset parameters are present", () => {
    expect(
      dataUrlToBytes("data:image/png;charset=utf-8;base64,AQID"),
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects malformed percent-encoded payloads", () => {
    expect(() => dataUrlToBytes("data:text/plain,%E0%A4%A")).toThrow(
      "Malformed percent escape",
    );
    expect(() => dataUrlToBytes("data:text/plain,%")).toThrow(
      "Malformed percent escape",
    );
  });
});
