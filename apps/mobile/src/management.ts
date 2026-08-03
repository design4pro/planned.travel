const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Keep user-provided names safe and portable when sharing a native file. */
export function safeFileName(name: string, fallback = "planned-travel-export") {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+$/, "");
  return sanitized || fallback;
}

/** Encode API binary responses for Expo FileSystem's base64 writer. */
export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let result = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    result += BASE64_ALPHABET[(combined >> 18) & 63];
    result += BASE64_ALPHABET[(combined >> 12) & 63];
    result += second === undefined ? "=" : BASE64_ALPHABET[(combined >> 6) & 63];
    result += third === undefined ? "=" : BASE64_ALPHABET[combined & 63];
  }

  return result;
}
