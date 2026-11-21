export function dataUrlToBytes(dataUrl: string): Uint8Array {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("Expected a data URL.");
  }

  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0) {
    throw new Error("The data URL is missing its payload separator.");
  }

  const metadata = dataUrl.slice(5, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  const isBase64 = metadata
    .split(";")
    .some((part) => part.toLowerCase() === "base64");

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  return new TextEncoder().encode(
    decodeURIComponent(payload),
  );
}
