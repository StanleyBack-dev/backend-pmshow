// Limits of profile photos. The browser already shrinks the photo before
// sending it; the server checks and re-encodes it anyway.

/** Formats accepted, detected from the file content. */
export const PROFILE_PHOTO_FORMATS = ["jpeg", "png", "webp"] as const;
/** Largest file accepted (after the browser's resize it is far smaller). */
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Largest source image, against decompression bombs. */
export const PROFILE_PHOTO_MAX_PIXELS = 40_000_000;
/** Side of the stored square image. */
export const PROFILE_PHOTO_SIZE = 512;

/** Base64 (no data: prefix) -> bytes; null if not base64 or too large. */
export function decodePhoto(base64: string): Buffer | null {
  const text = base64.trim();
  if (
    text.length === 0 ||
    text.length > Math.ceil((PROFILE_PHOTO_MAX_BYTES * 4) / 3) + 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(text)
  ) {
    return null;
  }
  const data = Buffer.from(text, "base64");
  return data.length > 0 && data.length <= PROFILE_PHOTO_MAX_BYTES
    ? data
    : null;
}
