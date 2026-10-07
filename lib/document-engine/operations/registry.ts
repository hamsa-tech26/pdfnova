import type {
  KukurekuOperationDescriptor,
  KukurekuOperationId,
} from "./types";

const operations: KukurekuOperationDescriptor[] =
  [
    {
      id: "add-image-stamp-pdf",
      title: "Add Image / Stamp PDF",
      route: "/add-image-stamp-pdf",
      inputMimeTypes: ["application/pdf"],
      localProcessing: true,
      reversible: false,
      requirements: ["valid-pdf", "stamp-or-image"],
      effectProfiles: [
        {
          mode: "page-overlay",
          description:
            "Adds a user-selected image or generated stamp onto one or more PDF pages.",
          preserves: [
            "page-count",
            "page-geometry",
            "common-metadata",
            "interactive-forms",
            "selectable-text",
          ],
          modifies: [
            "page-content",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
          ],
        },
      ],
    },
    {
      id: "crop-pdf",
      title: "Crop PDF",
      route: "/crop-pdf",
      inputMimeTypes: ["application/pdf"],
      localProcessing: true,
      reversible: false,
      requirements: ["valid-pdf", "crop-margins"],
      effectProfiles: [
        {
          mode: "visible-crop-box",
          description:
            "Changes visible page crop geometry while retaining the underlying page content.",
          preserves: [
            "page-count",
            "page-content",
            "common-metadata",
            "selectable-text",
          ],
          modifies: [
            "page-geometry",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "Cropping can hide content outside the visible CropBox without deleting the underlying page objects.",
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
          ],
        },
      ],
    },
    {
      id: "edit-pdf-metadata",
      title: "Edit PDF Metadata",
      route: "/edit-pdf-metadata",
      inputMimeTypes: ["application/pdf"],
      localProcessing: true,
      reversible: false,
      requirements: ["valid-pdf"],
      effectProfiles: [
        {
          mode: "common-metadata",
          description:
            "Updates common document-information metadata fields in a derived PDF copy.",
          preserves: [
            "page-count",
            "page-geometry",
            "page-content",
            "interactive-forms",
            "selectable-text",
          ],
          modifies: [
            "common-metadata",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "This does not claim to edit every XMP or forensic metadata location.",
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
          ],
        },
      ],
    },
    {
      id: "reorder-pdf-pages",
      title: "Reorder PDF Pages",
      route: "/reorder-pdf-pages",
      inputMimeTypes: ["application/pdf"],
      localProcessing: true,
      reversible: false,
      requirements: ["valid-pdf", "page-order"],
      effectProfiles: [
        {
          mode: "page-order",
          description:
            "Rebuilds the page tree using the user-selected page sequence.",
          preserves: [
            "page-count",
            "page-geometry",
            "page-content",
            "common-metadata",
            "selectable-text",
          ],
          modifies: [
            "page-order",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "Document-level navigation structures may not preserve their original semantics after page reordering.",
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
          ],
        },
      ],
    },
    {
      id: "resize-pdf-pages",
      title: "Resize PDF Pages",
      route: "/resize-pdf-pages",
      inputMimeTypes: ["application/pdf"],
      localProcessing: true,
      reversible: false,
      requirements: ["valid-pdf", "target-page-size"],
      effectProfiles: [
        {
          mode: "proportional-fit",
          description:
            "Resizes page geometry and proportionally fits existing content into the selected target page size.",
          preserves: [
            "page-count",
            "common-metadata",
            "selectable-text",
          ],
          modifies: [
            "page-geometry",
            "page-content",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "Page geometry changes can affect print layout and annotation positioning.",
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
          ],
        },
      ],
    },
    {
      id: "rotate-pdf",
      title: "Rotate PDF",
      route: "/rotate-pdf",
      inputMimeTypes: ["application/pdf"],
      localProcessing: true,
      reversible: false,
      requirements: ["valid-pdf", "rotation"],
      effectProfiles: [
        {
          mode: "page-rotation",
          description:
            "Changes the rotation entry for every page in a derived PDF copy.",
          preserves: [
            "page-count",
            "page-content",
            "common-metadata",
            "interactive-forms",
            "selectable-text",
          ],
          modifies: [
            "page-geometry",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
          ],
        },
      ],
    },
    {
      id: "remove-metadata",
      title: "Remove PDF Metadata",
      route: "/remove-pdf-metadata",
      inputMimeTypes: [
        "application/pdf",
      ],
      localProcessing: true,
      reversible: false,
      requirements: [
        "valid-pdf",
      ],
      effectProfiles: [
        {
          mode: "common-metadata",
          description:
            "Removes common document-information metadata handled by the current pdf-lib metadata workflow. This is not forensic sanitization.",
          preserves: [
            "page-count",
            "page-geometry",
            "page-content",
            "interactive-forms",
            "selectable-text",
          ],
          modifies: [
            "common-metadata",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "XMP, attachments, annotations, hidden layers, JavaScript/actions, and other embedded structures are outside this operation's sanitization claim.",
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
            "common-metadata-empty",
          ],
        },
      ],
    },
    {
      id: "flatten-form",
      title: "Flatten PDF",
      route: "/flatten-pdf",
      inputMimeTypes: [
        "application/pdf",
      ],
      localProcessing: true,
      reversible: false,
      requirements: [
        "valid-pdf",
        "standard-acroform",
        "no-xfa",
      ],
      effectProfiles: [
        {
          mode: "standard-acroform",
          description:
            "Converts supported standard AcroForm field appearances into ordinary page content.",
          preserves: [
            "page-count",
            "page-geometry",
            "common-metadata",
          ],
          modifies: [
            "page-content",
            "pdf-structure",
          ],
          destroys: [
            "interactive-forms",
          ],
          risks: [
            "Unsupported custom widgets are not guaranteed to flatten correctly.",
            "XFA is refused by the current tool.",
            "Rewriting a signed PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
            "forms-flattened",
          ],
        },
      ],
    },
    {
      id: "compress-pdf",
      title: "Compress PDF",
      route: "/compress-pdf",
      inputMimeTypes: [
        "application/pdf",
      ],
      localProcessing: true,
      reversible: false,
      requirements: [
        "valid-pdf",
      ],
      effectProfiles: [
        {
          mode: "structure-preserving",
          description:
            "QPDF or pdf-lib compression rewrites PDF structure while aiming to preserve document content and geometry.",
          preserves: [
            "page-count",
            "page-geometry",
            "page-content",
          ],
          modifies: [
            "file-size",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "A rewritten PDF can invalidate cryptographic signatures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
            "file-size-at-most",
          ],
        },
        {
          mode: "visual-raster",
          description:
            "Image-only compression rebuilds pages from JPEG renderings and is intentionally destructive to interactive/non-page structures.",
          preserves: [
            "page-count",
          ],
          modifies: [
            "file-size",
            "page-content",
            "page-geometry",
            "pdf-structure",
          ],
          destroys: [
            "common-metadata",
            "interactive-forms",
            "selectable-text",
            "annotations",
            "links",
            "bookmarks",
            "attachments",
            "digital-signatures",
            "javascript-actions",
            "vector-content",
          ],
          risks: [
            "Rasterization removes selectable text and interactive/non-page structures.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
            "file-size-at-most",
            "rasterized-pages",
          ],
        },
      ],
    },
    {
      id: "redact-pdf",
      title: "Redact PDF",
      route: "/redact-pdf",
      inputMimeTypes: [
        "application/pdf",
      ],
      localProcessing: true,
      reversible: false,
      requirements: [
        "valid-pdf",
        "redaction-areas",
      ],
      effectProfiles: [
        {
          mode: "raster-redaction",
          description:
            "Renders each visible page, paints approved redaction areas into page pixels, and rebuilds a raster PDF.",
          preserves: [
            "page-count",
          ],
          modifies: [
            "page-content",
            "page-geometry",
            "pdf-structure",
          ],
          destroys: [
            "common-metadata",
            "interactive-forms",
            "selectable-text",
            "annotations",
            "links",
            "bookmarks",
            "attachments",
            "digital-signatures",
            "javascript-actions",
            "vector-content",
          ],
          risks: [
            "The output is rasterized and loses interactive/non-page PDF structures.",
            "This operation does not claim complete forensic sanitization of every possible PDF structure.",
          ],
          verifiableEffects: [
            "pdf-openable",
            "page-count-equals",
            "rasterized-pages",
          ],
        },
      ],
    },
    {
      id: "protect-pdf",
      title: "Protect PDF",
      route: "/protect-pdf",
      inputMimeTypes: [
        "application/pdf",
      ],
      localProcessing: true,
      reversible: true,
      requirements: [
        "valid-pdf",
        "password",
      ],
      effectProfiles: [
        {
          mode: "aes-256",
          description:
            "Uses the browser QPDF engine to create an AES-256 password-protected PDF copy.",
          preserves: [
            "page-count",
            "page-geometry",
            "page-content",
          ],
          modifies: [
            "encryption",
            "pdf-structure",
          ],
          destroys: [],
          risks: [
            "A rewritten PDF can invalidate existing cryptographic signatures.",
            "Encryption is verified after creation with an independent PDF parser that rejects encrypted documents.",
          ],
          verifiableEffects: [
            "encryption-applied",
          ],
        },
      ],
    },
  ];

const byId = new Map(
  operations.map(
    (operation) => [
      operation.id,
      operation,
    ],
  ),
);

export function listKukurekuOperations() {
  return [...operations];
}

export function getKukurekuOperation(
  id: KukurekuOperationId,
) {
  return byId.get(id);
}
