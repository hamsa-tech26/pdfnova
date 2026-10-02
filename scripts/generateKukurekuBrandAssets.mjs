import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "brand", "kukureku-icon-final.png");
const publicIcons = path.join(root, "public", "icons");
const appDir = path.join(root, "app");
const brandDir = path.join(root, "public", "brand");

await fs.mkdir(publicIcons, { recursive: true });
await fs.mkdir(brandDir, { recursive: true });

await sharp(source)
  .resize(1024, 1024, {
    fit: "cover",
    position: "centre",
    kernel: "lanczos3",
  })
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, "kukureku-icon-master-1024.png"));

const sizes = [32, 64, 96, 180, 192, 512];

for (const size of sizes) {
  const pipeline = sharp(source).resize(size, size, {
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
    .toFile(path.join(publicIcons, `kukureku-icon-${size}.png`));
}

for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicIcons, `kukureku-maskable-${size}.png`));
}

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

console.log("Kukureku brand asset generation complete.");
