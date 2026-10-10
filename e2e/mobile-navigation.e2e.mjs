import { test, expect } from "@playwright/test";

test("mobile public navigation remains accessible and closes on selected page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "Open site menu" });
  await expect(open).toBeVisible();
  await expect(open).toHaveAttribute("aria-expanded", "false");

  await open.click();
  const menu = page.getByRole("navigation", { name: "Mobile primary navigation" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("button", { name: "Close site menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "AI PDF" })).toHaveAttribute("href", "/#ai");
  await menu.getByRole("link", { name: "Trust" }).click();
  await expect(page).toHaveURL(/\/trust$/);
  await expect(page.getByRole("button", { name: "Open site menu" })).toBeVisible();
});

test("320px public menu supports Escape and keyboard focus restoration", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open site menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile primary navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Mobile primary navigation" })).toHaveCount(0);
  const toggle = page.getByRole("button", { name: "Open site menu" });
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("mobile workspace exposes its actual tool and workflow links", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Open workspace menu" })).toBeVisible();
  await page.getByRole("button", { name: "Open workspace menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile workspace navigation" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Workflow Recipes" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Privacy Controls" })).toBeVisible();
  await nav.getByRole("link", { name: "Merge PDF" }).click();
  await expect(page).toHaveURL(/\/merge-pdf$/);
  await expect(page.getByRole("button", { name: "Open workspace menu" })).toHaveAttribute("aria-expanded", "false");
});

test("workspace drawer can close by Escape, returning focus to its trigger", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open workspace menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile workspace navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Mobile workspace navigation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open workspace menu" })).toBeFocused();
});

test("desktop navigation remains usable without the mobile controls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open site menu" })).toBeHidden();
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Desktop workspace navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open workspace menu" })).toBeHidden();
});
