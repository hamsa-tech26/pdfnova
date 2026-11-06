import { expect, test } from "@playwright/test";
import { TOOL_ROUTES } from "../scripts/indexNowRoutes.mjs";

test("homepage tool finder keeps all registered links and filters by task", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#tools a[data-tool-category]");
  await expect(cards).toHaveCount(TOOL_ROUTES.length);
  const links = await cards.evaluateAll(elements => elements.map(link => link.getAttribute("href")));
  expect(links.sort()).toEqual([...TOOL_ROUTES].sort());

  await page.getByRole("searchbox", { name: "Find the right PDF tool" }).fill("smaller size");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("href", "/compress-pdf");
  await expect(page.getByRole("status")).toContainText("Showing 1 of 31 tools");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(cards).toHaveCount(TOOL_ROUTES.length);
  await page.getByRole("button", { name: "Privacy & security" }).click();
  await expect(page.getByRole("button", { name: "Privacy & security" })).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(4);

  await page.getByRole("searchbox", { name: "Find the right PDF tool" }).fill("signature");
  await expect(cards).toHaveCount(0);
  await expect(page.getByText("No matching PDF tool found.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(cards).toHaveCount(TOOL_ROUTES.length);
});

test("320px mobile finder locates OCR without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#tools");
  const input = page.getByRole("searchbox", { name: "Find the right PDF tool" });
  await expect(input).toBeVisible();
  await input.fill("scanned text");
  const result = page.locator("#tools a[data-tool-category]");
  await expect(result).toHaveCount(1);
  await expect(result).toHaveAttribute("href", "/ocr-pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("merge guide has a canonical URL and a direct tool entry", async ({ page }) => {
  await page.goto("/guides/merge-pdf-without-uploading");
  await expect(page.getByRole("heading", { name: "How to merge PDFs without uploading them" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://kukureku.com/guides/merge-pdf-without-uploading");
  await expect(page.getByRole("link", { name: "Open Merge PDF" })).toHaveAttribute("href", "/merge-pdf");
});
