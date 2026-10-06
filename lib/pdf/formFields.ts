import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
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

export function describePdfFormFields(
  pdf: PDFDocument,
): {
  fields: PdfFormFieldDescriptor[];
  hasXfa: boolean;
} {
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
    hasXfa: form.hasXFA(),
  };
}

export function applyPdfFormValues(
  pdf: PDFDocument,
  values: PdfFormValues,
  flatten: boolean,
) {
  const form = pdf.getForm();

  for (
    const field of form.getFields()
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
    }
  }

  if (flatten) {
    form.flatten({
      updateFieldAppearances:
        true,
    });
  } else {
    form.updateFieldAppearances();
  }
}
