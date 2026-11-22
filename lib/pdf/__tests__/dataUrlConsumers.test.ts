import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const consumerFiles = [
  "app/(workspace)/pdf-to-jpg/page.tsx",
  "app/(workspace)/add-image-stamp-pdf/page.tsx",
  "app/(workspace)/sign-pdf/page.tsx",
];

describe("shared browser-local data URL decoder consumers", () => {
  for (const filePath of consumerFiles) {
    it(`${filePath} uses the shared decoder`, () => {
      const source = readFileSync(resolve(process.cwd(), filePath), "utf8");

      expect(source).toContain(
        'import { dataUrlToBytes } from "@/lib/pdf/dataUrlBytes";',
      );
      expect(source).not.toMatch(/function\\s+dataUrlToBytes\\s*\\(/);
    });
  }
});
