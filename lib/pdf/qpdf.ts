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

export function buildProtectQpdfArgs(
  password: string,
  ownerPassword: string,
  inputName = "input.pdf",
  outputName = "protected.pdf",
) {
  return [
    "--encrypt",
    `--user-password=${password}`,
    `--owner-password=${ownerPassword}`,
    "--bits=256",
    "--",
    inputName,
    outputName,
  ];
}

export function buildUnlockQpdfArgs(
  password: string,
  inputName = "protected.pdf",
  outputName = "unlocked.pdf",
) {
  return [
    `--password=${password}`,
    "--decrypt",
    "--",
    inputName,
    outputName,
  ];
}

export function buildIsEncryptedQpdfArgs(
  inputName = "input.pdf",
) {
  return [
    "--is-encrypted",
    inputName,
  ];
}

export type PdfEncryptionStatus =
  | "encrypted"
  | "not-encrypted"
  | "unknown";

export async function inspectPdfEncryption(
  input:
    | Blob
    | Uint8Array
    | ArrayBuffer,
): Promise<PdfEncryptionStatus> {
  const qpdf =
    await createBrowserQpdfRunner();

  try {
    const bytes =
      input instanceof Blob
        ? new Uint8Array(
            await input.arrayBuffer(),
          )
        : input instanceof
            Uint8Array
          ? input
          : new Uint8Array(input);

    try {
      const result =
        await qpdf.run({
          inputs: {
            "input.pdf":
              bytes,
          },
          args:
            buildIsEncryptedQpdfArgs(
              "input.pdf",
            ),
        });

      return result.exitCode === 0
        ? "encrypted"
        : result.exitCode === 2
          ? "not-encrypted"
          : "unknown";
    } catch (error) {
      const exitCode =
        typeof error ===
          "object" &&
        error !== null &&
        "exitCode" in error &&
        typeof (
          error as {
            exitCode?: unknown;
          }
        ).exitCode ===
          "number"
          ? (
              error as {
                exitCode: number;
              }
            ).exitCode
          : null;

      if (exitCode === 0) {
        return "encrypted";
      }

      if (exitCode === 2) {
        return "not-encrypted";
      }

      return "unknown";
    }
  } finally {
    await qpdf.destroy();
  }
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
      args: buildProtectQpdfArgs(
        password,
        ownerPassword,
        "input.pdf",
        "protected.pdf",
      ),
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
      args: buildUnlockQpdfArgs(
        password,
        "protected.pdf",
        "unlocked.pdf",
      ),
    });
  } finally {
    await qpdf.destroy();
  }
}
