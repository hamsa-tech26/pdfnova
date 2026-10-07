import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildIsEncryptedQpdfArgs,
  buildProtectQpdfArgs,
  buildUnlockQpdfArgs,
} from "../qpdf";

describe("qpdf security command builders", () => {
  it("builds an AES-256 protect command with separate user and owner passwords", () => {
    expect(
      buildProtectQpdfArgs(
        "user-secret",
        "owner-secret",
      ),
    ).toEqual([
      "--encrypt",
      "--user-password=user-secret",
      "--owner-password=owner-secret",
      "--bits=256",
      "--",
      "input.pdf",
      "protected.pdf",
    ]);
  });

  it("preserves custom input and output names for protection", () => {
    const args =
      buildProtectQpdfArgs(
        "p@ss",
        "owner",
        "source.pdf",
        "result.pdf",
      );

    expect(args.at(-2)).toBe(
      "source.pdf",
    );
    expect(args.at(-1)).toBe(
      "result.pdf",
    );
  });

  it("builds the encryption inspection command", () => {
    expect(
      buildIsEncryptedQpdfArgs(),
    ).toEqual([
      "--is-encrypted",
      "input.pdf",
    ]);
  });

  it("builds the expected unlock command", () => {
    expect(
      buildUnlockQpdfArgs(
        "correct-password",
      ),
    ).toEqual([
      "--password=correct-password",
      "--decrypt",
      "--",
      "protected.pdf",
      "unlocked.pdf",
    ]);
  });
});
