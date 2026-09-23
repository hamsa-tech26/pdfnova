import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import {
  PDFDocument,
} from "pdf-lib";

const outputDir =
  path.resolve(
    "test-fixtures/phase10_14",
  );

const outputPdf =
  path.join(
    outputDir,
    "phase10_14b_faint_print_noisy_background.pdf",
  );

const rows = [
  [
    "1",
    "Rani Para Scheme",
    "Damcherra RF",
    "Functional",
    "Normal",
  ],
  [
    "2",
    "Khahamthai Para",
    "West Damcherra",
    "Functional",
    "Normal",
  ],
  [
    "3",
    "Jalidhan Para Scheme",
    "Uttamjoy VC",
    "Functional",
    "Normal",
  ],
  [
    "4",
    "Nilbusan Para Scheme",
    "Kacharicherra",
    "Repair",
    "Motor fault",
  ],
  [
    "5",
    "Kamalacherri Scheme",
    "Thumsarai",
    "Functional",
    "Normal",
  ],
  [
    "6",
    "Purnaram Para Scheme",
    "Thumsarai",
    "Low source",
    "Tanker used",
  ],
  [
    "7",
    "Gouranga Para Scheme",
    "West Damcherra",
    "Repair",
    "Pipe damage",
  ],
  [
    "8",
    "Halam Para Scheme",
    "Damcherra",
    "Functional",
    "Normal",
  ],
  [
    "9",
    "Serechandra Para",
    "Thumsarai",
    "Low pressure",
    "Tail end",
  ],
];

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const columnX = [
  90,
  210,
  730,
  1110,
  1370,
];

const verticalLines = [
  70,
  190,
  710,
  1090,
  1350,
  1560,
];

const tableTop = 420;
const rowHeight = 125;

const header = [
  "Sl No",
  "Name of Scheme",
  "GP / VC",
  "Status",
  "Remarks",
];

const textRows = [
  header,
  ...rows,
];

const horizontalLines =
  Array.from(
    {
      length:
        textRows.length + 1,
    },
    (_, index) =>
      tableTop +
      index * rowHeight,
  );
const backgroundBands =
  Array.from(
    { length: 18 },
    (_, index) => {
      const y =
        330 + index * 95;
      const opacity =
        index % 2 === 0
          ? 0.032
          : 0.018;

      return `
        <rect
          x="0"
          y="${y}"
          width="1630"
          height="42"
          fill="rgb(232,232,232)"
          opacity="${opacity}"
        />
      `;
    },
  ).join("");

const backgroundSpeckles =
  Array.from(
    { length: 650 },
    (_, index) => {
      const x =
        (index * 37) % 1630;
      const y =
        320 +
        ((index * 61) % 1760);
      const radius =
        0.8 + (index % 3) * 0.45;
      const shade =
        212 - (index % 5) * 8;
      const opacity =
        0.035 +
        (index % 4) * 0.012;

      return `
        <circle
          cx="${x}"
          cy="${y}"
          r="${radius.toFixed(2)}"
          fill="rgb(${shade},${shade},${shade})"
          opacity="${opacity.toFixed(3)}"
        />
      `;
    },
  ).join("");


const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1630"
  height="2200"
  viewBox="0 0 1630 2200"
>
  <rect
    width="1630"
    height="2200"
    fill="white"
  />

  ${backgroundBands}
  ${backgroundSpeckles}

  <text
    x="815"
    y="190"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="64"
    font-weight="700"
    fill="black"
  >
    WATER SUPPLY SCHEME STATUS REPORT
  </text>

  <text
    x="815"
    y="275"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="32"
    fill="black"
  >
    PHASE 10.14B - FAINT PRINT / NOISY BACKGROUND TEST
  </text>

  ${verticalLines
    .map(
      (x) => `
        <line
          x1="${x}"
          y1="${tableTop}"
          x2="${x}"
          y2="${
            horizontalLines[
              horizontalLines.length - 1
            ]
          }"
          stroke="black"
          stroke-width="5"
        />
      `,
    )
    .join("")}

  ${horizontalLines
    .map(
      (y) => `
        <line
          x1="70"
          y1="${y}"
          x2="1560"
          y2="${y}"
          stroke="black"
          stroke-width="5"
        />
      `,
    )
    .join("")}

  ${textRows
    .map((row, rowIndex) => {
      const y =
        tableTop +
        rowIndex * rowHeight +
        78;

      const weight =
        rowIndex === 0
          ? "700"
          : "400";

      return row
        .map(
          (cell, columnIndex) => `
            <text
              x="${columnX[columnIndex]}"
              y="${y}"
              font-family="Arial, sans-serif"
              font-size="${
                rowIndex === 0
                  ? 35
                  : 32
              }"
              font-weight="${weight}"
              fill="black"
            >
              ${escapeXml(cell)}
            </text>
          `,
        )
        .join("");
    })
    .join("")}

  <text
    x="815"
    y="1920"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="28"
    fill="black"
  >
    CONTROLLED PDFNOVA OCR TORTURE FIXTURE
  </text>
</svg>
`;

const fadedSvg =
  svg
    .replace(
      /fill="black"/g,
      'fill="rgb(112,112,112)"',
    )
    .replace(
      /stroke="black"/g,
      'stroke="rgb(148,148,148)"',
    );

await fs.mkdir(
  outputDir,
  {
    recursive: true,
  },
);

const faintPrintPng =
  await sharp(
    Buffer.from(fadedSvg),
  )
    .resize({
      width: 1100,
    })
    .grayscale()
    .linear(0.92, 10)
    .png({
      compressionLevel: 9,
    })
    .toBuffer();;

const pdf =
  await PDFDocument.create();

const page =
  pdf.addPage([
    595.28,
    841.89,
  ]);

const image =
  await pdf.embedPng(
    faintPrintPng,
  );

const margin = 18;

const availableWidth =
  page.getWidth() -
  margin * 2;

const availableHeight =
  page.getHeight() -
  margin * 2;

const scale =
  Math.min(
    availableWidth /
      image.width,
    availableHeight /
      image.height,
  );

const width =
  image.width * scale;

const height =
  image.height * scale;

page.drawImage(
  image,
  {
    x:
      (
        page.getWidth() -
        width
      ) / 2,
    y:
      (
        page.getHeight() -
        height
      ) / 2,
    width,
    height,
  },
);

await fs.writeFile(
  outputPdf,
  await pdf.save(),
);

console.log(
  `Created: ${outputPdf}`,
);