import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { extensionFromMime, normalizeBase64Image } from "@/lib/base64";

export async function savePlantImage(image: string) {
  const { mime, content } = normalizeBase64Image(image);
  const extension = extensionFromMime(mime);
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = `/uploads/${fileName}`;
  const outputDirectory = path.join(process.cwd(), "public", "uploads");
  const outputPath = path.join(outputDirectory, fileName);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, Buffer.from(content, "base64"));

  return relativePath;
}
