export const MAX_UPLOAD_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_MB = 100;
export const MAX_UPLOAD_IMAGE_PIXELS = 120_000_000;
export const MAX_UPLOAD_IMAGE_MEGAPIXELS = MAX_UPLOAD_IMAGE_PIXELS / 1_000_000;
export const MAX_UPLOAD_BATCH_FILES = 20;

export function imageDimensionsWithinUploadLimit(width: number, height: number) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width * height <= MAX_UPLOAD_IMAGE_PIXELS
  );
}
