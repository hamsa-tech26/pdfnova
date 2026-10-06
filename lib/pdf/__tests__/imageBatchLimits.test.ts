import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getRasterImageKind,
  MAX_RASTER_IMAGE_BYTES,
  validateRasterImageBatch,
} from "../imageBatchLimits";

function file(
  name: string,
  size: number,
  type = "",
) {
  return {
    name,
    size,
    type,
  };
}

describe("imageBatchLimits", () => {
  it("recognizes supported image MIME types and filename fallbacks", () => {
    expect(
      getRasterImageKind(
        file(
          "scan.bin",
          10,
          "image/png",
        ),
      ),
    ).toBe("png");

    expect(
      getRasterImageKind(
        file(
          "photo.JPEG",
          10,
        ),
      ),
    ).toBe("jpeg");

    expect(
      getRasterImageKind(
        file(
          "notes.gif",
          10,
          "image/gif",
        ),
      ),
    ).toBeNull();
  });

  it("rejects unsupported and oversized additions", () => {
    expect(
      validateRasterImageBatch(
        [],
        [
          file(
            "image.gif",
            100,
            "image/gif",
          ),
        ],
      ),
    ).toContain(
      "not a supported",
    );

    expect(
      validateRasterImageBatch(
        [],
        [
          file(
            "large.jpg",
            MAX_RASTER_IMAGE_BYTES +
              1,
            "image/jpeg",
          ),
        ],
      ),
    ).toContain(
      "25 MB",
    );
  });

  it("enforces combined count and byte limits", () => {
    const many = Array.from(
      { length: 51 },
      (_, index) =>
        file(
          `${index}.jpg`,
          1,
          "image/jpeg",
        ),
    );

    expect(
      validateRasterImageBatch(
        [],
        many,
      ),
    ).toContain(
      "50 images",
    );

    expect(
      validateRasterImageBatch(
        [
          file(
            "existing.jpg",
            80 * 1024 * 1024,
            "image/jpeg",
          ),
        ],
        [
          file(
            "new.jpg",
            21 * 1024 * 1024,
            "image/jpeg",
          ),
        ],
      ),
    ).toContain(
      "100 MB",
    );
  });
});
