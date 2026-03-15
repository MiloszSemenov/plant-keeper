import { ApiError } from "@/lib/http";
import {
  isSupportedPlantImageMimeType,
  MAX_PLANT_IMAGE_BYTES
} from "@/lib/image-upload";

const DATA_URL_PATTERN = /^data:(?<mime>[-\w.+/]+);base64,(?<content>.+)$/;
const BASE64_CONTENT_PATTERN = /^[A-Za-z0-9+/=\s]+$/;

export function normalizeBase64Image(image: string) {
  const trimmed = image.trim();
  const match = trimmed.match(DATA_URL_PATTERN);

  if (!match?.groups?.mime || !match.groups.content) {
    throw new ApiError(400, "Upload a valid image file");
  }

  const mime = match.groups.mime.toLowerCase();
  const content = match.groups.content.replace(/\s+/g, "");

  if (!isSupportedPlantImageMimeType(mime)) {
    throw new ApiError(400, "Use a JPG, PNG, WebP, or HEIC image");
  }

  if (!BASE64_CONTENT_PATTERN.test(content)) {
    throw new ApiError(400, "Upload a valid image file");
  }

  const size = Buffer.byteLength(content, "base64");

  if (size === 0 || size > MAX_PLANT_IMAGE_BYTES) {
    throw new ApiError(400, "Image must be smaller than 5 MB");
  }

  return {
    mime,
    content
  };
}

export function extensionFromMime(mime: string) {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}
