import { PdfOperationCancelledError } from "./operationCancellation";

/**
 * Read a browser File as an ArrayBuffer while allowing the caller to abort
 * the underlying FileReader before its bytes are handed to the PDF parser.
 */
export function readFileAsArrayBuffer(
  file: Blob,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;

    function cleanup() {
      signal.removeEventListener("abort", handleAbort);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
    }

    function resolveOnce(bytes: ArrayBuffer) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(bytes);
    }

    function rejectOnce(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function handleAbort() {
      if (settled) return;
      try {
        // Calling abort while EMPTY is harmless and also lets deterministic
        // browser tests cancel a read scheduled but not yet started.
        reader.abort();
      } catch {
        // The AbortSignal remains authoritative if the browser rejects abort.
      }
      rejectOnce(new PdfOperationCancelledError());
    }

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolveOnce(reader.result);
      } else {
        rejectOnce(new Error("Unable to read the PDF file."));
      }
    };

    reader.onerror = () => {
      rejectOnce(reader.error ?? new Error("Unable to read the PDF file."));
    };

    reader.onabort = () => {
      rejectOnce(new PdfOperationCancelledError());
    };

    if (signal.aborted) {
      handleAbort();
      return;
    }

    signal.addEventListener("abort", handleAbort, { once: true });

    try {
      reader.readAsArrayBuffer(file);
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error("Unable to read the PDF file."));
    }
  });
}
