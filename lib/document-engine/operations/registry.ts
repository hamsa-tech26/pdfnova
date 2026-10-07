import type {
  KukurekuOperationDescriptor,
  KukurekuOperationId,
} from "./types";

const operations: KukurekuOperationDescriptor[] =
  [
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
            "Encryption is verified with the browser QPDF runtime after the protected output is created.",
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
