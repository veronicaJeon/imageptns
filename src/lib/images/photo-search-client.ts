export const PHOTO_SEARCH_SELECTED_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const PHOTO_SEARCH_REQUEST_MAX_FILE_BYTES = 3_500_000;
export const PHOTO_SEARCH_MAX_EDGE = 1_600;

const PHOTO_SEARCH_CLIENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function scaledPhotoSearchDimensions(width: number, height: number, maxEdge = PHOTO_SEARCH_MAX_EDGE) {
  if (width <= 0 || height <= 0 || maxEdge <= 0) throw new Error("Invalid photo dimensions");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function preparePhotoSearchImage(file: File) {
  if (!PHOTO_SEARCH_CLIENT_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Unsupported photo search format");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const dimensions = scaledPhotoSearchDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo search canvas is unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("Photo search image conversion failed")),
        "image/jpeg",
        0.86,
      );
    });
    if (blob.size > PHOTO_SEARCH_REQUEST_MAX_FILE_BYTES) {
      throw new Error("Photo search image conversion is too large");
    }
    return new File([blob], "photo-search.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
