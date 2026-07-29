/**
 * Supabase Storage ultimately forwards this value to fetch as BodyInit.
 * Use a plain ArrayBuffer instead of Node's Buffer so server runtimes never
 * coerce image bytes through UTF-8 text encoding.
 */
export function storageBinaryBody(input: Uint8Array): ArrayBuffer {
  return Uint8Array.from(input).buffer;
}

export function hasJpegSignature(input: Uint8Array) {
  return input.length >= 3
    && input[0] === 0xff
    && input[1] === 0xd8
    && input[2] === 0xff;
}
