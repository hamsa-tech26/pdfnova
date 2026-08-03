export async function unlockPdf(
  file: File,
  password: string,
): Promise<Uint8Array> {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF unlocking is only available in the browser.",
    );
  }

  const { createQpdfRunner } = await import("qpdf-run");

  const origin = window.location.origin;

  const qpdf = await createQpdfRunner({
    workerUrl: `${origin}/qpdf/worker.js`,
    qpdfJsUrl: `${origin}/qpdf/qpdf.js`,
    wasmUrl: `${origin}/qpdf/qpdf.wasm`,
    timeoutMs: 60000,
  });

  try {
    const inputBytes = new Uint8Array(
      await file.arrayBuffer(),
    );

    return await qpdf.runOne({
      input: inputBytes,
      inputName: "protected.pdf",
      outputName: "unlocked.pdf",
      args: [
        `--password=${password}`,
        "--decrypt",
        "--",
        "protected.pdf",
        "unlocked.pdf",
      ],
    });
  } finally {
    await qpdf.destroy();
  }
}