export function downloadFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType = "application/pdf",
) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  const blob = new Blob([buffer], {
    type: mimeType,
  });

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);
}