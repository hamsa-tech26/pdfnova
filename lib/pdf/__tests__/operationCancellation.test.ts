import { describe, expect, it } from "vitest";
import { PdfOperationCancelledError, throwIfPdfOperationCancelled } from "../operationCancellation";

describe("cooperative PDF operation cancellation", () => {
  it("does not stop active work before an abort request", () => {
    const controller = new AbortController();
    expect(() => throwIfPdfOperationCancelled(controller.signal)).not.toThrow();
  });
  it("aborts only at safe boundaries and uses an identifiable error", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfPdfOperationCancelled(controller.signal)).toThrow(PdfOperationCancelledError);
    try { throwIfPdfOperationCancelled(controller.signal); }
    catch (error) { expect((error as Error).name).toBe("AbortError"); }
  });
});
