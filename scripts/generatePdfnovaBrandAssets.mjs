import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const source = path.join(
  root,
  "public",
  "brand",
  "pdfnova-icon-final.png",
);

const publicIcons = path.join(root, "public", "icons");
const appDir = path.join(root, "app");
const brandDir = path.join(root, "public", "brand");

await fs.mkdir(publicIcons, { recursive: true });
await fs.mkdir(brandDir, { recursive: true });

const master = sharp(source).resize(1024, 1024, {
  fit: "cover",
  position: "centre",
  kernel: "lanczos3",
});

await master
  .clone()
  .png({ compressionLevel: 9 })
  .toFile(
    path.join(brandDir, "pdfnova-icon-master-1024.png"),
  );

const sizes = [32, 64, 96, 180, 192, 512];

for (const size of sizes) {
  const pipeline = sharp(source)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    });

  if (size <= 64) {
    pipeline.sharpen({
      sigma: 0.55,
      m1: 0.8,
      m2: 0.35,
    });
  }

  await pipeline
    .png({ compressionLevel: 9 })
    .toFile(
      path.join(
        publicIcons,
        `pdfnova-icon-${size}.png`,
      ),
    );

  console.log(`Created ${size}x${size} icon`);
}

/*
  Android / PWA maskable icons.

  The approved master already has a full square background
  and the Nova P remains inside the safe central region,
  so we preserve the exact same artwork rather than creating
  a second, visually inconsistent icon.
*/
for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .png({ compressionLevel: 9 })
    .toFile(
      path.join(
        publicIcons,
        `pdfnova-maskable-${size}.png`,
      ),
    );

  console.log(`Created ${size}x${size} maskable icon`);
}

/*
  Next.js metadata icons.
*/
await sharp(source)
  .resize(512, 512, {
    fit: "cover",
    position: "centre",
    kernel: "lanczos3",
  })
  .png({ compressionLevel: 9 })
  .toFile(path.join(appDir, "icon.png"));

await sharp(source)
  .resize(180, 180, {
    fit: "cover",
    position: "centre",
    kernel: "lanczos3",
  })
  .png({ compressionLevel: 9 })
  .toFile(path.join(appDir, "apple-icon.png"));

console.log("Created Next.js app icon");
console.log("Created Apple touch icon");
console.log("PDFNova final brand asset generation complete.");