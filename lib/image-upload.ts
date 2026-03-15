export const MAX_PLANT_IMAGE_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_PLANT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
] as const;

export function isSupportedPlantImageMimeType(mime: string) {
  return SUPPORTED_PLANT_IMAGE_MIME_TYPES.includes(
    mime as (typeof SUPPORTED_PLANT_IMAGE_MIME_TYPES)[number]
  );
}
