import {test, expect} from "@playwright/test";

const tools = [
  {path: "/merge-pdf", name: "Merge PDF", picker: "Choose PDF Files", multiple: true},
  {path: "/compress-pdf", name: "Compress PDF", picker: "Choose PDF File", multiple: false},
  {path: "/jpg-to-pdf", name: "JPG to PDF", picker: "Choose Images", multiple: true},
];

async function settledLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function expectInitialAction(page, action) {
  const box = await action.boundingBox();
  expect(box).not.toBeNull();
  const {width, height} = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await action.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

for (const [width, height] of [[320, 680], [390, 844], [768, 1024], [1440, 900]]) {
  test(`${width}px: primary tool links and file pickers fit the first screen`, async ({page}) => {
    await page.setViewportSize({width, height});
    await page.goto("/");
    await settledLayout(page);
    const navigation = page.getByRole("navigation", {name: "Popular PDF tools"});
    for (const tool of tools) {
      const link = navigation.getByRole("link", {name: tool.name, exact: true});
      await expect(link).toHaveAttribute("href", tool.path);
      await expectInitialAction(page, link);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const tool of tools) {
      await page.goto(tool.path);
      await settledLayout(page);
      await expectInitialAction(page, page.getByRole("button", {name: tool.picker, exact: true}));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.getByText("Files stay on your device", {exact: true}).filter({visible: true})).toBeVisible();
    }
  });
}

for (const tool of tools) {
  test(`keyboard entry opens ${tool.name} directly and invokes its file picker`, async ({page}) => {
    await page.setViewportSize({width: 320, height: 680});
    await page.goto("/");
    const link = page.getByRole("navigation", {name: "Popular PDF tools"})
      .getByRole("link", {name: tool.name, exact: true});
    await link.focus();
    await link.press("Enter");
    await expect(page).toHaveURL(new RegExp(tool.path + "$"));
    const button = page.getByRole("button", {name: tool.picker, exact: true});
    await button.focus();
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), button.press("Enter")]);
    expect(chooser.isMultiple()).toBe(tool.multiple);
    await chooser.setFiles([]);
    await expect(button).toBeEnabled();
  });
}
