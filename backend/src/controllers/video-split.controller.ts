import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import { ZipArchive } from "archiver";
import type { RequestHandler } from "express";

const runFile = promisify(execFile);
const MIN_SIZE_MB = 10;
const MAX_SIZE_MB = 1024;

export const splitVideo: RequestHandler = async (request, response, next) => {
  if (!request.file) {
    response.status(400).json({ success: false, error: { message: "Please upload a video file" } });
    return;
  }

  let outputDirectory: string | undefined;
  const cleanup = async () => {
    await Promise.all([
      rm(request.file?.path ?? "", { force: true }).catch(() => undefined),
      outputDirectory ? rm(outputDirectory, { recursive: true, force: true }).catch(() => undefined) : undefined,
    ]);
  };

  try {
    const targetSizeMb = Number(request.body.targetSizeMb ?? 100);
    if (!Number.isFinite(targetSizeMb) || targetSizeMb < MIN_SIZE_MB || targetSizeMb > MAX_SIZE_MB) {
      response.status(400).json({ success: false, error: { message: `Chunk size must be between ${MIN_SIZE_MB} MB and ${MAX_SIZE_MB} MB` } });
      await cleanup();
      return;
    }

    const { stdout } = await runFile("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "json", request.file.path], { maxBuffer: 1024 * 1024 });
    const metadata = JSON.parse(stdout) as { format?: { duration?: string; size?: string } };
    const duration = Number(metadata.format?.duration);
    const fileSize = Number(metadata.format?.size ?? request.file.size);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fileSize) || fileSize <= 0) throw new Error("Could not read video duration or size");

    const targetBytes = targetSizeMb * 1024 * 1024;
    const segmentSeconds = Math.max(1, (targetBytes / (fileSize / duration)) * 0.96);
    outputDirectory = await mkdtemp(join(tmpdir(), "fileflow-video-split-"));
    const extension = extname(request.file.originalname).toLowerCase();
    const outputPattern = join(outputDirectory, `part-%03d${extension}`);
    await runFile("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", request.file.path, "-map", "0", "-c", "copy", "-f", "segment", "-segment_time", segmentSeconds.toFixed(3), "-reset_timestamps", "1", outputPattern], { maxBuffer: 4 * 1024 * 1024 });

    const chunks = (await readdir(outputDirectory)).filter((name) => name.startsWith("part-")).sort();
    if (!chunks.length) throw new Error("No video chunks were created");
    const sizes = await Promise.all(chunks.map(async (name) => (await stat(join(outputDirectory!, name))).size));
    const baseName = basename(request.file.originalname, extension).replace(/[^a-zA-Z0-9_-]/g, "-") || "video";

    response.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${baseName}-split.zip"`,
      "X-Chunk-Count": String(chunks.length),
      "X-Largest-Chunk-MB": (Math.max(...sizes) / 1024 / 1024).toFixed(1),
    });
    const archive = new ZipArchive({ store: true });
    archive.on("error", (error: Error) => response.destroy(error));
    response.on("close", cleanup);
    archive.pipe(response);
    chunks.forEach((name, index) => archive.file(join(outputDirectory!, name), { name: `${baseName}-part-${String(index + 1).padStart(3, "0")}${extension}` }));
    await archive.finalize();
  } catch (error) {
    await cleanup();
    next(error);
  }
};
