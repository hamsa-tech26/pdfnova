import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFName,
  PDFTextField,
} from "pdf-lib";

export type PdfFormFieldKind =
  | "text"
  | "checkbox"
  | "dropdown"
  | "option-list"
  | "radio"
  | "unsupported";

export type PdfFormFieldValue =
  | string
  | string[]
  | boolean
  | null;

export type PdfFormFieldDescriptor = {
  name: string;
  kind: PdfFormFieldKind;
  value: PdfFormFieldValue;
  options?: string[];
  multiline?: boolean;
};

export type PdfFormValues = Record<
  string,
  PdfFormFieldValue
>;

export function hasPdfXfa(
  pdf: PDFDocument,
) {
  return (
    pdf.catalog
      .AcroForm()
      ?.has(PDFName.of("XFA")) ??
    false
  );
}

export function describePdfFormFields(
  pdf: PDFDocument,
): {
  fields: PdfFormFieldDescriptor[];
  hasXfa: boolean;
} {
  const hasXfa = hasPdfXfa(pdf);

  if (hasXfa) {
    return {
      fields: [],
      hasXfa: true,
    };
  }

  const form = pdf.getForm();

  const fields =
    form.getFields().map(
      (field): PdfFormFieldDescriptor => {
        const name =
          field.getName();

        if (
          field instanceof
          PDFTextField
        ) {
          return {
            name,
            kind: "text",
            value:
              field.getText() ??
              "",
            multiline:
              field.isMultiline(),
          };
        }

        if (
          field instanceof
          PDFCheckBox
        ) {
          return {
            name,
            kind: "checkbox",
            value:
              field.isChecked(),
          };
        }

        if (
          field instanceof
          PDFDropdown
        ) {
          return {
            name,
            kind: "dropdown",
            value:
              field.getSelected()[0] ??
              "",
            options:
              field.getOptions(),
          };
        }

        if (
          field instanceof
          PDFOptionList
        ) {
          return {
            name,
            kind: "option-list",
            value:
              field.getSelected(),
            options:
              field.getOptions(),
          };
        }

        if (
          field instanceof
          PDFRadioGroup
        ) {
          return {
            name,
            kind: "radio",
            value:
              field.getSelected() ??
              "",
            options:
              field.getOptions(),
          };
        }

        return {
          name,
          kind: "unsupported",
          value: null,
        };
      },
    );

  return {
    fields,
    hasXfa,
  };
}

export function applyPdfFormValues(
  pdf: PDFDocument,
  values: PdfFormValues,
  flatten: boolean,
) {
  const form = pdf.getForm();
  const allFields =
    form.getFields();

  const unsupportedFields =
    allFields.filter(
      (field) =>
        !(
          field instanceof
            PDFTextField ||
          field instanceof
            PDFCheckBox ||
          field instanceof
            PDFDropdown ||
          field instanceof
            PDFOptionList ||
          field instanceof
            PDFRadioGroup
        ),
    );

  if (
    flatten &&
    unsupportedFields.length >
      0
  ) {
    throw new Error(
      "Flattening is unavailable because this PDF contains unsupported form field types. Save an editable copy instead.",
    );
  }

  const font =
    form.getDefaultFont();

  for (
    const field of allFields
  ) {
    const name =
      field.getName();

    if (!(name in values)) {
      continue;
    }

    const value =
      values[name];

    if (
      field instanceof
      PDFTextField
    ) {
      field.setText(
        typeof value ===
          "string"
          ? value
          : "",
      );

      field.defaultUpdateAppearances(
        font,
      );
      continue;
    }

    if (
      field instanceof
      PDFCheckBox
    ) {
      if (value === true) {
        field.check();
      } else {
        field.uncheck();
      }

      field.defaultUpdateAppearances();
      continue;
    }

    if (
      field instanceof
      PDFDropdown
    ) {
      if (
        typeof value ===
          "string" &&
        value
      ) {
        field.select(value);
      } else {
        field.clear();
      }

      field.defaultUpdateAppearances(
        font,
      );
      continue;
    }

    if (
      field instanceof
      PDFOptionList
    ) {
      if (
        Array.isArray(value) &&
        value.length
      ) {
        field.select(value);
      } else if (
        typeof value ===
          "string" &&
        value
      ) {
        field.select(value);
      } else {
        field.clear();
      }

      field.defaultUpdateAppearances(
        font,
      );
      continue;
    }

    if (
      field instanceof
      PDFRadioGroup
    ) {
      if (
        typeof value ===
          "string" &&
        value
      ) {
        field.select(value);
      } else {
        field.clear();
      }

      field.defaultUpdateAppearances();
    }
  }

  if (flatten) {
    form.flatten({
      updateFieldAppearances:
        false,
    });
  }
}


export function getPdfFormProcessingError(
  error: unknown,
  fallback: string,
) {
  const message =
    error instanceof Error
      ? error.message
      : "";

  if (
    message.includes(
      "WinAnsi cannot encode",
    )
  ) {
    return "This form contains text characters that the built-in PDF form font cannot render. This version supports standard WinAnsi/Latin form appearances; use simpler Latin text or a compatible source form and try again.";
  }

  return message || fallback;
}
