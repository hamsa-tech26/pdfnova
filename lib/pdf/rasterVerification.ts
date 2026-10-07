import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";

export type RasterizedPagesEvidence = {
  pageCount: number;
  imageOnlyPageCount: number;
  reason: string | null;
};

function resolveRawStream(
  pdf: PDFDocument,
  value: unknown,
) {
  const resolved =
    value instanceof PDFRef
      ? pdf.context.lookup(
          value,
        )
      : value;

  return resolved instanceof
    PDFRawStream
    ? resolved
    : null;
}

function contentStreamsForPage(
  pdf: PDFDocument,
  pageIndex: number,
) {
  const page =
    pdf.getPage(pageIndex);
  const contents =
    page.node.get(
      PDFName.of("Contents"),
    );

  if (!contents) {
    return [];
  }

  if (
    contents instanceof
    PDFArray
  ) {
    const streams: PDFRawStream[] =
      [];

    for (
      let index = 0;
      index <
      contents.size();
      index += 1
    ) {
      const stream =
        resolveRawStream(
          pdf,
          contents.get(index),
        );

      if (stream) {
        streams.push(stream);
      }
    }

    return streams;
  }

  const single =
    resolveRawStream(
      pdf,
      contents,
    );

  return single
    ? [single]
    : [];
}

function hasOnlyImageXObjects(
  pdf: PDFDocument,
  pageIndex: number,
) {
  const page =
    pdf.getPage(pageIndex);
  const resources =
    page.node.Resources();

  if (!resources) {
    return false;
  }

  const hasEntries = (
    name: string,
  ) => {
    const dictionary =
      resources.lookupMaybe(
        PDFName.of(name),
        PDFDict,
      );

    return Boolean(
      dictionary &&
        dictionary.size() > 0,
    );
  };

  if (
    hasEntries("Font") ||
    hasEntries("Pattern") ||
    hasEntries("Shading")
  ) {
    return false;
  }

  const xObjects =
    resources.lookupMaybe(
      PDFName.of("XObject"),
      PDFDict,
    );

  if (
    !xObjects ||
    xObjects.size() === 0
  ) {
    return false;
  }

  let imageCount = 0;

  for (const key of xObjects.keys()) {
    const candidate =
      xObjects.lookup(
        key,
      );

    if (
      !(
        candidate instanceof
        PDFRawStream
      )
    ) {
      return false;
    }

    const subtype =
      candidate.dict.get(
        PDFName.of("Subtype"),
      );

    if (
      subtype?.toString() !==
      "/Image"
    ) {
      return false;
    }

    imageCount += 1;
  }

  return imageCount > 0;
}

const ALLOWED_RASTER_OPERATORS =
  new Set([
    "q",
    "Q",
    "cm",
    "Do",
  ]);

const KNOWN_PDF_OPERATORS =
  new Set([
    "q",
    "Q",
    "cm",
    "Do",
    "BT",
    "ET",
    "Tf",
    "Tj",
    "TJ",
    "Td",
    "TD",
    "Tm",
    "T*",
    "Tc",
    "Tw",
    "Tz",
    "TL",
    "Ts",
    "Tr",
    "m",
    "l",
    "c",
    "v",
    "y",
    "h",
    "re",
    "S",
    "s",
    "f",
    "F",
    "f*",
    "B",
    "B*",
    "b",
    "b*",
    "n",
    "W",
    "W*",
    "g",
    "G",
    "rg",
    "RG",
    "k",
    "K",
    "cs",
    "CS",
    "sc",
    "SC",
    "scn",
    "SCN",
    "gs",
    "ri",
    "i",
    "d",
    "J",
    "j",
    "M",
    "BI",
    "ID",
    "EI",
  ]);

function hasOnlyRasterOperators(
  stream: PDFRawStream,
) {
  let decoded: Uint8Array;

  try {
    decoded =
      decodePDFRawStream(
        stream,
      ).decode();
  } catch {
    return false;
  }

  const text =
    new TextDecoder().decode(
      decoded,
    );

  const withoutComments =
    text
      .split(
        String.fromCharCode(
          10,
        ),
      )
      .map((line) =>
        line.replace(
          /%.*/,
          " ",
        ),
      )
      .join(" ");
  const withoutStrings =
    withoutComments
      .replace(
        /\((?:\\.|[^\\)])*\)/gs,
        " ",
      )
      .replace(
        /<[^>]*>/gs,
        " ",
      )
      .replace(
        /\/[!-~]+/g,
        " ",
      );

  const tokens =
    withoutStrings.match(
      /[A-Za-z*'"]+/g,
    ) ?? [];

  const operators =
    tokens.filter(
      (token) =>
        KNOWN_PDF_OPERATORS.has(
          token,
        ),
    );

  return (
    operators.includes("Do") &&
    operators.every(
      (operator) =>
        ALLOWED_RASTER_OPERATORS.has(
          operator,
        ),
    )
  );
}

export async function inspectRasterizedPages(
  blob: Blob,
): Promise<RasterizedPagesEvidence> {
  let pdf: PDFDocument;

  try {
    pdf =
      await PDFDocument.load(
        await blob.arrayBuffer(),
        {
          updateMetadata:
            false,
        },
      );
  } catch {
    return {
      pageCount: 0,
      imageOnlyPageCount: 0,
      reason:
        "The PDF could not be opened for raster structure verification.",
    };
  }

  const pageCount =
    pdf.getPageCount();
  let imageOnlyPageCount = 0;

  for (
    let pageIndex = 0;
    pageIndex < pageCount;
    pageIndex += 1
  ) {
    if (
      !hasOnlyImageXObjects(
        pdf,
        pageIndex,
      )
    ) {
      continue;
    }

    const streams =
      contentStreamsForPage(
        pdf,
        pageIndex,
      );

    if (
      streams.length === 0 ||
      !streams.every(
        hasOnlyRasterOperators,
      )
    ) {
      continue;
    }

    imageOnlyPageCount += 1;
  }

  return {
    pageCount,
    imageOnlyPageCount,
    reason:
      imageOnlyPageCount ===
      pageCount
        ? null
        : "One or more pages contain resources or drawing operators beyond a strict image-only page structure.",
  };
}
