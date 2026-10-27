import {test, expect} from "@playwright/test";
import upngModule from "@pdf-lib/upng";
const UPNG = upngModule.default;

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

function luminance(rgb) {
  const linear = rgb.map(value => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

async function expectReadableLabel(label) {
  const color = await label.evaluate(el => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    context.fillStyle = getComputedStyle(el).color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
  });
  // Decode the actual rendered label, including the decorative hover overlay.
  // Corners are outside the glyphs and sample the background behind the text.
  const png = UPNG.decode(Uint8Array.from(await label.screenshot({
    animations: "disabled",
    // Next's local development launcher can overlap a label corner at 320px.
    // Exclude that test-environment chrome only while sampling product pixels.
    style: "nextjs-portal { visibility: hidden !important; }",
  })).buffer);
  const pixels = new Uint8Array(UPNG.toRGBA8(png)[0]);
  const foreground = luminance(color);
  for (const pixel of [0, png.width - 1, (png.height - 1) * png.width, png.width * png.height - 1]) {
    const background = luminance([...pixels.slice(pixel * 4, pixel * 4 + 3)]);
    expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05))
      .toBeGreaterThanOrEqual(4.5);
  }
}

for (const theme of ["light", "dark"]) {
  test(`${theme}: mobile file limits and browse hints remain readable, including hover`, async ({page}) => {
    await page.setViewportSize({width: 320, height: 680});
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    for (const tool of tools) {
      await page.goto(tool.path);
      await settledLayout(page);
      if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
      else await expect(page.locator("html")).not.toHaveClass(/dark/);
      const group = page.getByRole("group").filter({has: page.getByRole("button", {name: tool.picker, exact: true})});
      const limits = group.getByText(/Maximum file size:|Maximum 50 images/);
      const hint = group.getByText("You can drag files here or use the browse button above.", {exact: true});
      for (const label of [limits, hint]) {
        const box = await label.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(680);
      }
      for (const hover of [false, true]) {
        if (hover) await group.hover();
        else await page.mouse.move(0, 0);
        await page.waitForTimeout(350); // Allow the existing 300ms hover transition to settle.
        await expectReadableLabel(limits);
        await expectReadableLabel(hint);
      }
    }
  });
}
