import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import multer from "multer";

const supportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);
export const batchImageUploadDirectory = join(
  tmpdir(),
  "fileflow-batch-images",
);
mkdirSync(batchImageUploadDirectory, { recursive: true });

export const batchImageUpload = multer({
  storage: multer.diskStorage({
    destination: batchImageUploadDirectory,
    filename: (_request, file, callback) =>
      callback(
        null,
        `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_request, file, callback) => {
    if (!supportedTypes.has(file.mimetype)) {
      callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "files"));
      return;
    }
    callback(null, true);
  },
});
