export class PdfOperationCancelledError extends Error {
  constructor() {
    super("The PDF operation was cancelled.");
    this.name = "AbortError";
  }
}

/** Cooperative cancellation at safe boundaries; cannot preempt a synchronous PDF library call. */
export function throwIfPdfOperationCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new PdfOperationCancelledError();
}
