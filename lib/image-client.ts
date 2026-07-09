import {
  isSupportedPlantImageMimeType,
  MAX_PLANT_IMAGE_BYTES
} from "@/lib/image-upload";

// Vercel's serverless function payload limit (4.5 MB) is hard and unconfigurable,
// and base64 adds ~33% overhead on top of the raw file — so we downscale/recompress
// client-side before the image ever becomes a data URL.
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export function validatePlantImageFile(file: File) {
  if (!isSupportedPlantImageMimeType(file.type)) {
    throw new Error("Use a JPG, PNG, WebP, or HEIC image");
  }

  if (file.size > MAX_PLANT_IMAGE_BYTES) {
    throw new Error("Image must be smaller than 5 MB");
  }
}

export async function fileToDataUrl(file: File) {
  validatePlantImageFile(file);

  try {
    return await compressImageToDataUrl(file);
  } catch {
    // Compression unsupported or failed (e.g. exotic HEIC variant) — fall back
    // to the original file rather than blocking the upload entirely.
    return readBlobAsDataUrl(file);
  }
}

async function compressImageToDataUrl(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas unsupported");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) {
    throw new Error("Unable to compress image");
  }

  return readBlobAsDataUrl(blob);
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the image file"));
    reader.readAsDataURL(blob);
  });
}
