async function createBrowserQpdfRunner() {
  if (typeof window === "undefined") {
    throw new Error("PDF security tools are only available in the browser.");
  }

  const { createQpdfRunner } = await import("qpdf-run");
  const origin = window.location.origin;

  return createQpdfRunner({
    workerUrl: `${origin}/qpdf/worker.js`,
    qpdfJsUrl: `${origin}/qpdf/qpdf.js`,
    wasmUrl: `${origin}/qpdf/qpdf.wasm`,
    timeoutMs: 60000,
  });
}

function createOwnerPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export async function protectPdf(
  file: File,
  password: string,
): Promise<Uint8Array> {
  if (!password) {
    throw new Error("Please enter a PDF password.");
  }

  const qpdf = await createBrowserQpdfRunner();

  try {
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    const ownerPassword = createOwnerPassword();

    return await qpdf.runOne({
      input: inputBytes,
      inputName: "input.pdf",
      outputName: "protected.pdf",
      args: [
        "--encrypt",
        `--user-password=${password}`,
        `--owner-password=${ownerPassword}`,
        "--bits=256",
        "--",
        "input.pdf",
        "protected.pdf",
      ],
    });
  } finally {
    await qpdf.destroy();
  }
}

export async function unlockPdf(
  file: File,
  password: string,
): Promise<Uint8Array> {
  const qpdf = await createBrowserQpdfRunner();

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
