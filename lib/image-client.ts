import {
  isSupportedPlantImageMimeType,
  MAX_PLANT_IMAGE_BYTES
} from "@/lib/image-upload";

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

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the image file"));
    reader.readAsDataURL(file);
  });
}
