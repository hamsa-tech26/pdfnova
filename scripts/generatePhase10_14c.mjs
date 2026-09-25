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
    "phase10_14c_uneven_lighting_edge_shadow.pdf",
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
const lightingOverlay = `
  <defs>
    <linearGradient id='pageLighting' x1='0%' y1='0%' x2='100%' y2='0%'>
      <stop offset='0%' stop-color='rgb(105,105,105)' stop-opacity='0.22' />
      <stop offset='18%' stop-color='rgb(175,175,175)' stop-opacity='0.11' />
      <stop offset='52%' stop-color='white' stop-opacity='0' />
      <stop offset='82%' stop-color='rgb(190,190,190)' stop-opacity='0.07' />
      <stop offset='100%' stop-color='rgb(120,120,120)' stop-opacity='0.18' />
    </linearGradient>
  </defs>

  <rect
    x='0'
    y='0'
    width='1630'
    height='2200'
    fill='url(#pageLighting)'
  />

  <rect
    x='0'
    y='0'
    width='85'
    height='2200'
    fill='rgb(90,90,90)'
    opacity='0.10'
  />

  <rect
    x='1560'
    y='0'
    width='70'
    height='2200'
    fill='rgb(95,95,95)'
    opacity='0.08'
  />
`;


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

  ${lightingOverlay}

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
    PHASE 10.14C - UNEVEN LIGHTING / EDGE SHADOW TEST
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

await fs.mkdir(
  outputDir,
  {
    recursive: true,
  },
);

const fixturePng =
  await sharp(
    Buffer.from(svg),
  )
    .grayscale()
    .png({
      compressionLevel: 9,
    })
    .toBuffer();

const pdf =
  await PDFDocument.create();

const page =
  pdf.addPage([
    595.28,
    841.89,
  ]);

const image =
  await pdf.embedPng(
    fixturePng,
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



