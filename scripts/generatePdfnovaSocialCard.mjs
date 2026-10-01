import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const iconPath = path.join(
  root,
  "public",
  "icons",
  "pdfnova-icon-512.png",
);

const outputPath = path.join(
  root,
  "app",
  "opengraph-image.png",
);

const width = 1200;
const height = 630;

const icon = await sharp(iconPath)
  .resize(112, 112)
  .png()
  .toBuffer();

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="48%" stop-color="#0f1f4d"/>
      <stop offset="100%" stop-color="#0c4a6e"/>
    </linearGradient>

    <radialGradient id="glow1">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="glow2">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <circle cx="1040" cy="80" r="360" fill="url(#glow1)"/>
  <circle cx="1050" cy="560" r="320" fill="url(#glow2)"/>

  <rect
    x="70"
    y="52"
    width="1060"
    height="526"
    rx="38"
    fill="#ffffff"
    fill-opacity="0.035"
    stroke="#ffffff"
    stroke-opacity="0.10"
  />

  <text
    x="220"
    y="100"
    font-family="Arial, Helvetica, sans-serif"
    font-size="39"
    font-weight="800"
    fill="#ffffff"
  >
    PDFNova
  </text>

  <text
    x="220"
    y="131"
    font-family="Arial, Helvetica, sans-serif"
    font-size="19"
    font-weight="500"
    fill="#bae6fd"
  >
    Private PDF workspace
  </text>

  <rect
    x="84"
    y="194"
    width="250"
    height="42"
    rx="21"
    fill="#38bdf8"
    fill-opacity="0.12"
    stroke="#67e8f9"
    stroke-opacity="0.30"
  />

  <text
    x="209"
    y="221"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="15"
    font-weight="700"
    letter-spacing="2"
    fill="#a5f3fc"
  >
    PRIVATE PDF WORKSPACE
  </text>

  <text
    x="84"
    y="318"
    font-family="Arial, Helvetica, sans-serif"
    font-size="64"
    font-weight="800"
    letter-spacing="-2"
    fill="#ffffff"
  >
    Powerful PDF tools.
  </text>

  <text
    x="84"
    y="390"
    font-family="Arial, Helvetica, sans-serif"
    font-size="64"
    font-weight="800"
    letter-spacing="-2"
    fill="#ffffff"
  >
    Private by design.
  </text>

  <text
    x="84"
    y="448"
    font-family="Arial, Helvetica, sans-serif"
    font-size="23"
    font-weight="400"
    fill="#dbeafe"
  >
    Merge, split, compress, convert, organize, watermark and unlock PDFs
  </text>

  <text
    x="84"
    y="482"
    font-family="Arial, Helvetica, sans-serif"
    font-size="23"
    font-weight="400"
    fill="#dbeafe"
  >
    directly in your browser.
  </text>

  <circle cx="94" cy="535" r="5" fill="#22d3ee"/>
  <text
    x="112"
    y="542"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="600"
    fill="#bae6fd"
  >
    10 working tools
  </text>

  <circle cx="314" cy="535" r="5" fill="#22d3ee"/>
  <text
    x="332"
    y="542"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="600"
    fill="#bae6fd"
  >
    Browser-based processing
  </text>

  <circle cx="590" cy="535" r="5" fill="#22d3ee"/>
  <text
    x="608"
    y="542"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="600"
    fill="#bae6fd"
  >
    No installation
  </text>
</svg>
`;

const background = await sharp(
  Buffer.from(svg),
).png().toBuffer();

await sharp(background)
  .composite([
    {
      input: icon,
      left: 84,
      top: 67,
    },
  ])
  .png()
  .toFile(outputPath);

const stats = await fs.stat(outputPath);

console.log(
  `Created ${outputPath} (${stats.size.toLocaleString()} bytes)`,
);