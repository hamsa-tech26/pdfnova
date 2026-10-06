import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { hasPdfXfa } from "./formFields";
import {
  visibleRectToPdfPlacement,
  type VisibleRect,
} from "./visibleRectGeometry";

export type FillableFieldType =
  | "text"
  | "checkbox"
  | "dropdown";

export type FillableFieldDefinition = {
  id: number;
  name: string;
  type: FillableFieldType;
  page: number;
  rect: VisibleRect;
  options: string[];
};

export async function addFillableFields(
  pdf: PDFDocument,
  definitions: FillableFieldDefinition[],
) {
  if (hasPdfXfa(pdf)) {
    throw new Error(
      "This PDF contains XFA form data and cannot be modified safely by this tool.",
    );
  }

  if (definitions.length === 0) {
    throw new Error(
      "Add at least one form field.",
    );
  }

  const form = pdf.getForm();
  const font = await pdf.embedFont(
    StandardFonts.Helvetica,
  );

  const existingNames = new Set(
    form
      .getFields()
      .map((field) =>
        field.getName(),
      ),
  );

  for (const definition of definitions) {
    const name =
      definition.name.trim();

    if (!name) {
      throw new Error(
        "Every form field needs a name.",
      );
    }

    if (existingNames.has(name)) {
      throw new Error(
        `The PDF already contains a form field named ${name}. Rename the new field and try again.`,
      );
    }

    if (
      definition.page < 1 ||
      definition.page >
        pdf.getPageCount()
    ) {
      throw new Error(
        `Form field ${name} points to an invalid page.`,
      );
    }

    if (
      definition.type ===
        "dropdown" &&
      definition.options.length < 2
    ) {
      throw new Error(
        `Dropdown field ${name} needs at least two options.`,
      );
    }

    const page = pdf.getPage(
      definition.page - 1,
    );

    const placement =
      visibleRectToPdfPlacement(
        page.getCropBox(),
        page.getRotation().angle,
        definition.rect,
      );

    const appearance = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotate: degrees(
        placement.rotation,
      ),
      borderColor: rgb(
        0.25,
        0.35,
        0.5,
      ),
      backgroundColor: rgb(
        1,
        1,
        1,
      ),
      borderWidth: 1,
    };

    if (
      definition.type ===
      "text"
    ) {
      const field =
        form.createTextField(
          name,
        );

      field.addToPage(page, {
        ...appearance,
        font,
      });
    } else if (
      definition.type ===
      "checkbox"
    ) {
      const field =
        form.createCheckBox(
          name,
        );

      field.addToPage(
        page,
        appearance,
      );
    } else {
      const field =
        form.createDropdown(
          name,
        );

      field.setOptions(
        definition.options,
      );

      field.addToPage(page, {
        ...appearance,
        font,
      });
    }

    existingNames.add(name);
  }

}
