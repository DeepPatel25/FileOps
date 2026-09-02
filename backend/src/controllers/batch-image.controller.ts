import type { RequestHandler } from "express";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ZipArchive } from "archiver";
import JSZip from "jszip";
import sharp from "sharp";

const outputFormats = new Set(["png", "jpeg", "webp", "avif"]);
type ImageFormat = "png" | "jpeg" | "webp" | "avif";

const normalizeName = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-") || "image";

const encodePipeline = (
  source: Buffer | string,
  format: ImageFormat,
  quality: number,
) => {
  const pipeline = sharp(source, { failOn: "error" }).rotate();
  if (format === "jpeg") return pipeline.jpeg({ quality, mozjpeg: true });
  if (format === "webp") return pipeline.webp({ quality, effort: 4 });
  if (format === "avif")
    return pipeline.avif({ quality: Math.min(quality, 80), effort: 5 });
  return pipeline.png({ compressionLevel: 9, palette: true, quality });
};

export const processBatchImages: RequestHandler = async (
  request,
  response,
  next,
) => {
  const files = request.files as Express.Multer.File[] | undefined;
  let outputDirectory: string | undefined;
  let streaming = false;
  const cleanupInputs = () =>
    Promise.all(
      (files ?? []).map((file) =>
        file.path
          ? rm(file.path, { force: true }).catch(() => undefined)
          : undefined,
      ),
    );
  const cleanupAll = async () => {
    await cleanupInputs();
    if (outputDirectory)
      await rm(outputDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
  };
  try {
    if (!files?.length) {
      response.status(400).json({
        success: false,
        error: { message: "Please upload at least one image" },
      });
      return;
    }

    const operation = String(request.body.operation ?? "compress");
    if (operation !== "compress" && operation !== "convert") {
      await cleanupInputs();
      response.status(400).json({
        success: false,
        error: { message: "Operation must be compress or convert" },
      });
      return;
    }
    const requestedQuality = Number(request.body.quality ?? 75);
    if (
      !Number.isInteger(requestedQuality) ||
      requestedQuality < 20 ||
      requestedQuality > 95
    ) {
      await cleanupInputs();
      response.status(400).json({
        success: false,
        error: { message: "Quality must be between 20 and 95" },
      });
      return;
    }
    const requestedFormat = String(request.body.format ?? "webp").toLowerCase();
    if (operation === "convert" && !outputFormats.has(requestedFormat)) {
      await cleanupInputs();
      response.status(400).json({
        success: false,
        error: { message: "Output format must be PNG, JPEG, WebP, or AVIF" },
      });
      return;
    }

    const usesDisk = files.some((file) => Boolean(file.path));
    const archive = usesDisk ? undefined : new JSZip();
    outputDirectory = usesDisk
      ? await mkdtemp(join(tmpdir(), "fileflow-batch-output-"))
      : undefined;
    const outputFiles: Array<{ path: string; name: string }> = [];
    let originalSize = 0;
    let outputSize = 0;
    for (const [index, file] of files.entries()) {
      const source = file.path || file.buffer;
      const metadata = await sharp(source, { failOn: "error" }).metadata();
      if (
        metadata.format !== "png" &&
        metadata.format !== "jpeg" &&
        metadata.format !== "webp" &&
        metadata.format !== "heif"
      ) {
        await cleanupAll();
        response.status(400).json({
          success: false,
          error: { message: `${file.originalname} is not a supported image` },
        });
        return;
      }
      const format =
        operation === "convert"
          ? (requestedFormat as ImageFormat)
          : metadata.format === "heif"
            ? "avif"
            : metadata.format;
      const extension = format === "jpeg" ? "jpg" : format;
      const suffix = operation === "compress" ? "-compressed" : "";
      const outputName = `${String(index + 1).padStart(2, "0")}-${normalizeName(file.originalname)}${suffix}.${extension}`;
      if (outputDirectory) {
        const outputPath = join(outputDirectory, outputName);
        await encodePipeline(source, format, requestedQuality).toFile(
          outputPath,
        );
        outputSize += (await stat(outputPath)).size;
        outputFiles.push({ path: outputPath, name: outputName });
      } else {
        const output = await encodePipeline(
          source,
          format,
          requestedQuality,
        ).toBuffer();
        archive?.file(outputName, output);
        outputSize += output.length;
      }
      originalSize += file.size;
    }
    if (usesDisk && outputDirectory) {
      const completedOutputDirectory = outputDirectory;
      await cleanupInputs();
      response.set({
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="fileflow-batch-images.zip"',
        "X-Processed-Count": String(files.length),
        "X-Original-Size": String(originalSize),
        "X-Compressed-Size": String(outputSize),
        "X-Reduction-Percent": String(
          Math.round((1 - outputSize / originalSize) * 100),
        ),
      });

      const stream = new ZipArchive({ store: true });
      const cleanup = () =>
        void rm(completedOutputDirectory, { recursive: true, force: true });

      response.on("close", cleanup);

      stream.on("error", (error: Error) => response.destroy(error));
      stream.pipe(response);

      streaming = true;
      outputFiles.forEach((file) =>
        stream.file(file.path, { name: file.name }),
      );
      await stream.finalize();
      return;
    }

    const result = await archive!.generateAsync({
      type: "nodebuffer",
      compression: "STORE",
      streamFiles: true,
    });

    response
      .set({
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="fileflow-batch-images.zip"',
        "Content-Length": String(result.length),
        "X-Processed-Count": String(files.length),
        "X-Original-Size": String(originalSize),
        "X-Compressed-Size": String(outputSize),
        "X-Reduction-Percent": String(
          Math.round((1 - outputSize / originalSize) * 100),
        ),
      })
      .send(result);
  } catch (error) {
    if (!streaming) await cleanupAll();
    next(error);
  }
};
