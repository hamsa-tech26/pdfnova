import { test, expect } from "@playwright/test";
import { TOOL_ROUTES } from "../scripts/indexNowRoutes.mjs";

test("mobile About page links to every live PDF tool, including PDF to Excel", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/about");

  await expect(page.getByText(`Explore all ${TOOL_ROUTES.length} currently available`, { exact: false })).toBeVisible();
  const hrefs = await page.locator("main a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  const toolLinks = hrefs.filter((href) => TOOL_ROUTES.includes(href));
  expect(toolLinks.sort()).toEqual([...TOOL_ROUTES].sort());
  expect(new Set(toolLinks).size).toBe(TOOL_ROUTES.length);

  await page.getByRole("link", { name: "PDF to Excel", exact: true }).click();
  await expect(page).toHaveURL(/\/pdf-to-excel$/);
});

test("mobile Press, privacy guide, and homepage agree on current tool count", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  for (const route of ["/", "/press", "/guides/private-pdf-tools"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByText(new RegExp(`${TOOL_ROUTES.length} (?:working|browser-based(?: PDF)?|PDF) tools`)).first()).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
  }

  await page.goto("/guides/private-pdf-tools");
  await page.getByRole("link", { name: `Browse all ${TOOL_ROUTES.length} PDF tools` }).click();
  await expect(page).toHaveURL(/\/#tools$/);
});

test("priority PDF tool pages expose accurate searchable titles and descriptions", async ({ page }) => {
  for (const [route, title, phrase] of [
    ["/merge-pdf", /Merge PDF Online Free/, "25 MB per file"],
    ["/compress-pdf", /Compress PDF Online Free/, "when possible"],
    ["/pdf-to-word", /PDF to Word Converter Online/, "scanned PDFs need OCR"],
  ]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", new RegExp(phrase));
  }
});
