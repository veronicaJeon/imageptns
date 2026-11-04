export const MAX_UPLOAD_FILE_BYTES = 20_000_000;
export const MAX_UPLOAD_SIZE_MB = 20;
export const MAX_UPLOAD_IMAGE_PIXELS = 100_000_000;
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
