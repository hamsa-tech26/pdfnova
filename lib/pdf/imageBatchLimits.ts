export type RasterImageKind =
  | "png"
  | "jpeg";

export type RasterImageFileLike = {
  name: string;
  size: number;
  type: string;
};

export const MAX_RASTER_IMAGE_BYTES =
  25 * 1024 * 1024;

export const MAX_RASTER_BATCH_BYTES =
  100 * 1024 * 1024;

export const MAX_RASTER_BATCH_COUNT =
  50;

export function getRasterImageKind(
  file: Pick<
    RasterImageFileLike,
    "name" | "type"
  >,
): RasterImageKind | null {
  const type =
    file.type.toLowerCase();

  if (type === "image/png") {
    return "png";
  }

  if (
    type === "image/jpeg" ||
    type === "image/jpg"
  ) {
    return "jpeg";
  }

  const name =
    file.name.toLowerCase();

  if (name.endsWith(".png")) {
    return "png";
  }

  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  ) {
    return "jpeg";
  }

  return null;
}

export function validateRasterImageBatch(
  existingFiles: RasterImageFileLike[],
  addedFiles: RasterImageFileLike[],
) {
  if (addedFiles.length === 0) {
    return "Please select at least one JPG or PNG image.";
  }

  const unsupported =
    addedFiles.find(
      (file) =>
        !getRasterImageKind(file),
    );

  if (unsupported) {
    return `${unsupported.name} is not a supported JPG or PNG image.`;
  }

  const oversized =
    addedFiles.find(
      (file) =>
        !Number.isFinite(
          file.size,
        ) ||
        file.size < 0 ||
        file.size >
          MAX_RASTER_IMAGE_BYTES,
    );

  if (oversized) {
    return `${oversized.name} is larger than the 25 MB per-image limit.`;
  }

  const combined = [
    ...existingFiles,
    ...addedFiles,
  ];

  if (
    combined.length >
    MAX_RASTER_BATCH_COUNT
  ) {
    return `Choose no more than ${MAX_RASTER_BATCH_COUNT} images at a time.`;
  }

  const totalBytes =
    combined.reduce(
      (sum, file) =>
        sum + file.size,
      0,
    );

  if (
    totalBytes >
    MAX_RASTER_BATCH_BYTES
  ) {
    return "The selected images exceed the 100 MB combined browser-processing limit.";
  }

  return null;
}
