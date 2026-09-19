import type {
  PdfV4OcrWord,
} from "./ocrRecognizer";

type Point = {
  x: number;
  y: number;
};

function rotatePointAroundCenter(
  point: Point,
  centerX: number,
  centerY: number,
  radians: number,
): Point {
  const translatedX =
    point.x - centerX;

  const translatedY =
    point.y - centerY;

  const cosine =
    Math.cos(radians);

  const sine =
    Math.sin(radians);

  return {
    x:
      centerX +
      translatedX * cosine -
      translatedY * sine,
    y:
      centerY +
      translatedX * sine +
      translatedY * cosine,
  };
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

export function remapPdfV4DeskewedOcrWords(
  words: PdfV4OcrWord[],
  renderedWidth: number,
  renderedHeight: number,
  detectedSkewRadians: number,
): PdfV4OcrWord[] {
  if (
    renderedWidth <= 0 ||
    renderedHeight <= 0 ||
    detectedSkewRadians === 0
  ) {
    return words;
  }

  const centerX =
    renderedWidth / 2;

  const centerY =
    renderedHeight / 2;

  return words.map(
    (word) => {
      const corners = [
        {
          x: word.bounds.x0,
          y: word.bounds.y0,
        },
        {
          x: word.bounds.x1,
          y: word.bounds.y0,
        },
        {
          x: word.bounds.x1,
          y: word.bounds.y1,
        },
        {
          x: word.bounds.x0,
          y: word.bounds.y1,
        },
      ].map(
        (corner) =>
          rotatePointAroundCenter(
            corner,
            centerX,
            centerY,
            detectedSkewRadians,
          ),
      );

      const xValues =
        corners.map(
          (corner) =>
            corner.x,
        );

      const yValues =
        corners.map(
          (corner) =>
            corner.y,
        );

      return {
        ...word,
        bounds: {
          x0: clamp(
            Math.min(...xValues),
            0,
            renderedWidth,
          ),
          y0: clamp(
            Math.min(...yValues),
            0,
            renderedHeight,
          ),
          x1: clamp(
            Math.max(...xValues),
            0,
            renderedWidth,
          ),
          y1: clamp(
            Math.max(...yValues),
            0,
            renderedHeight,
          ),
        },
      };
    },
  );
}