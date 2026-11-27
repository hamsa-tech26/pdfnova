import { test, expect } from "@playwright/test";

test.describe("Kukureku Motion System V1", () => {
  test("Motion Lab prototype supports sample interactions without file upload", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/motion-lab");

    await expect(
      page.getByRole("heading", { name: /Your documents\./ }),
    ).toBeVisible();
    await expect(
      page.getByText("Design prototype · Sample data only"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Version graph" }).click();
    await expect(
      page.getByText("Illustrative relationship only — not connected to stored workspace data."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Recent files" }).click();
    await page.getByRole("button", { name: /Quarterly report\.pdf/ }).click();
    await expect(
      page.getByText("Selected preview", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Selected sample: Quarterly report.pdf"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Add sample" }).click();
    await expect(
      page.getByText("This is a visual prototype. No file was uploaded or processed."),
    ).toBeVisible();

    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("Motion Lab remains usable on a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/motion-lab");

    await expect(
      page.getByRole("heading", { name: /Your documents\./ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Recent files" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Version graph" }).click();
    await expect(
      page.getByText("Illustrative relationship only — not connected to stored workspace data."),
    ).toBeVisible();
  });

  test("reduced-motion preference keeps homepage and prototype content visible", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Free private PDF tools/ }),
    ).toBeVisible();

    await page.goto("/motion-lab");
    await expect(
      page.getByRole("heading", { name: /Your documents\./ }),
    ).toBeVisible();
  });
});
