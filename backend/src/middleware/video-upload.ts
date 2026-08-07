import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import multer from "multer";

export const videoUploadDirectory = join(tmpdir(), "fileflow-video-uploads");
mkdirSync(videoUploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: videoUploadDirectory,
  filename: (_request, file, callback) => {
    const extension = file.originalname.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".mp4";
    callback(null, `${randomUUID()}${extension.toLowerCase()}`);
  },
});

const supportedExtensions = /\.(mp4|mov|mkv|webm)$/i;

export const videoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("video/") || !supportedExtensions.test(file.originalname)) {
      callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
      return;
    }
    callback(null, true);
  },
});
