import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { extensionFromMime, normalizeBase64Image } from "@/lib/base64";
import {
  isSupportedPlantImageMimeType,
  MAX_PLANT_IMAGE_BYTES
} from "@/lib/image-upload";
import { ApiError } from "@/lib/http";

async function writePlantImageFile(buffer: Buffer, mime: string) {
  const extension = extensionFromMime(mime);
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = `/uploads/${fileName}`;
  const outputDirectory = path.join(process.cwd(), "public", "uploads");
  const outputPath = path.join(outputDirectory, fileName);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, buffer);

  return relativePath;
}

export async function savePlantImage(image: string) {
  const { mime, content } = normalizeBase64Image(image);
  return writePlantImageFile(Buffer.from(content, "base64"), mime);
}

export async function saveRemotePlantImage(imageUrl: string) {
  console.info("[storage] remote_image_download_start", {
    imageUrl,
  });
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new ApiError(502, "Unable to download plant image");
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();

  console.info("[storage] remote_image_download_response", {
    imageUrl,
    contentType: contentType ?? null,
  });

  if (!contentType || !isSupportedPlantImageMimeType(contentType)) {
    throw new ApiError(400, "Unsupported plant image format");
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_PLANT_IMAGE_BYTES) {
    throw new ApiError(400, "Image must be smaller than 5 MB");
  }

  const relativePath = await writePlantImageFile(buffer, contentType);
  const outputPath = path.join(
    process.cwd(),
    "public",
    ...relativePath.replace(/^\/+/, "").split("/"),
  );

  console.info("[storage] remote_image_saved", {
    imageUrl,
    contentType,
    outputPath,
    relativePath,
  });

  return relativePath;
}
