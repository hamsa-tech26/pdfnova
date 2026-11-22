function decodePercentEncodedPayload(payload: string): Uint8Array {
  const encoder = new TextEncoder();
  let output = new Uint8Array(Math.max(payload.length, 1));
  let outputLength = 0;

  function appendBytes(bytes: Uint8Array) {
    const requiredLength = outputLength + bytes.length;
    if (requiredLength > output.length) {
      let capacity = output.length;
      while (capacity < requiredLength) {
        capacity *= 2;
      }

      const expanded = new Uint8Array(capacity);
      expanded.set(output.subarray(0, outputLength));
      output = expanded;
    }

    output.set(bytes, outputLength);
    outputLength = requiredLength;
  }

  function appendByte(byte: number) {
    if (outputLength + 1 > output.length) {
      const expanded = new Uint8Array(output.length * 2);
      expanded.set(output.subarray(0, outputLength));
      output = expanded;
    }

    output[outputLength] = byte;
    outputLength += 1;
  }

  let cursor = 0;
  while (cursor < payload.length) {
    const percentIndex = payload.indexOf("%", cursor);
    const rawEnd = percentIndex === -1 ? payload.length : percentIndex;

    if (rawEnd > cursor) {
      appendBytes(encoder.encode(payload.slice(cursor, rawEnd)));
    }

    if (percentIndex === -1) {
      break;
    }

    const escape = payload.slice(percentIndex + 1, percentIndex + 3);
    if (!/^[0-9a-f]{2}$/i.test(escape)) {
      throw new Error("Malformed percent escape in data URL payload.");
    }

    appendByte(Number.parseInt(escape, 16));
    cursor = percentIndex + 3;
  }

  return output.slice(0, outputLength);
}

function bytesToAscii(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let value = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (const byte of chunk) {
      if (byte > 0x7f) {
        throw new Error("Base64 data URL payload must contain only ASCII characters.");
      }
    }
    value += String.fromCharCode(...chunk);
  }

  return value;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  if (!/^data:/i.test(dataUrl)) {
    throw new Error("Expected a data URL.");
  }

  const separatorIndex = dataUrl.indexOf(",", 5);
  if (separatorIndex < 0) {
    throw new Error("The data URL is missing its payload separator.");
  }

  const metadata = dataUrl.slice(5, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);
  const isBase64 = metadata
    .split(";")
    .some((part) => part.toLowerCase() === "base64");
  const decodedPayload = decodePercentEncodedPayload(payload);

  if (!isBase64) {
    return decodedPayload;
  }

  const binary = atob(bytesToAscii(decodedPayload));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
