import {test, expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join} from "node:path";

// Local public-source intake only. Never fabricate a pass when the corpus is absent.
const cases = [
  ["FBI", "pdfplumber/examples/pdfs/background-checks.pdf", "4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407", /No reliable selectable-text table/],
  ["USDA", "pdfplumber/examples/pdfs/ag-energy-round-up-2017-02-24.pdf", "4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb", /uncertain row or column structure/],
  ["Invoice", "pdfplumber/tests/pdfs/issue-140-example.pdf", "0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b", /No reliable selectable-text table/],
  ["NREL", "camelot/tests/files/foo.pdf", "7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82", /No reliable selectable-text table/],
];
for (const [label, path, sha256, reason] of cases) {
  test(`${label}: known real-table coverage failure remains fail-closed`, async ({page}) => {
    if (!process.env.KUKUREKU_REFERENCE_ROOT) throw new Error("KUKUREKU_REFERENCE_ROOT must identify the downloaded public corpus.");
    const buffer = await readFile(join(process.env.KUKUREKU_REFERENCE_ROOT, path));
    expect(createHash("sha256").update(buffer).digest("hex")).toBe(sha256);
    const downloads = [];
    page.on("download", d => downloads.push(d.suggestedFilename()));
    await page.goto("/pdf-to-excel");
    await page.locator('input[type="file"]').setInputFiles({name: label + ".pdf", mimeType: "application/pdf", buffer});
    await page.getByRole("button", {name: "Convert to Excel (.xlsx)"}).click();
    await expect(page.getByText("Excel conversion withheld", {exact: true})).toBeVisible();
    await expect(page.getByText(reason)).toBeVisible();
    expect(downloads).toEqual([]);
  });
}
