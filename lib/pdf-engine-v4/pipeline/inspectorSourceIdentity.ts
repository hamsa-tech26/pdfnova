/**
 * The internal Inspector adds this digest ONLY to a locally downloaded
 * evidence JSON, at export time. It does not upload PDF bytes or make a
 * rights/independent-human-review attestation.
 */
export async function createInspectorSourceIdentity(source: Blob) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 is unavailable; Inspector evidence export is withheld.");
  }
  const bytes = await source.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    schema: "kukureku-v4-browser-original-source-v1" as const,
    algorithm: "SHA-256" as const,
    sha256,
    fileSizeBytes: source.size,
    provenance: "INSPECTOR_FILE_OBJECT_AT_JSON_EXPORT" as const,
    warning: "The digest binds this JSON export to a browser File object; it does not certify provenance, rights or reviewer independence.",
  };
}
