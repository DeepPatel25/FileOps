import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import type { RequestHandler } from "express";

const runFile = promisify(execFile);
const JOB_TTL_MS = 60 * 60 * 1000;
const ENCODER_THREADS = Math.max(
  1,
  Math.floor(availableParallelism() * 0.75),
);

const qualityProfiles = {
  high: { crf: "20", preset: "fast", bitrate: "1800k", maxrate: "2400k", bufsize: "3600k", audio: "160k" },
  balanced: { crf: "26", preset: "veryfast", bitrate: "1200k", maxrate: "1600k", bufsize: "2400k", audio: "128k" },
  small: { crf: "32", preset: "veryfast", bitrate: "700k", maxrate: "950k", bufsize: "1400k", audio: "96k" },
} as const;

const videoToolboxAvailable = runFile(
  "ffmpeg",
  [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=size=64x64:rate=1",
    "-frames:v", "1", "-an", "-c:v", "h264_videotoolbox",
    "-f", "null", "-",
  ],
  { timeout: 10_000 },
)
  .then(() => true)
  .catch(() => false);

const resolutionFilters = {
  original: "scale=trunc(iw/2)*2:trunc(ih/2)*2",
  "1080":
    "scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2",
  "720":
    "scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2",
  "480":
    "scale=854:480:force_original_aspect_ratio=decrease:force_divisible_by=2",
} as const;

type JobStatus = "queued" | "processing" | "completed" | "failed";
type CompressionJob = {
  id: string;
  status: JobStatus;
  progress: number;
  inputPath: string;
  outputDirectory: string;
  outputPath: string;
  downloadName: string;
  originalSize: number;
  compressedSize?: number;
  reductionPercent?: number;
  encoder?: "h264_videotoolbox" | "libx264";
  error?: string;
  expiresAt: number;
};

const jobs = new Map<string, CompressionJob>();
type QueuedJob = {
  job: CompressionJob;
  profile: (typeof qualityProfiles)[keyof typeof qualityProfiles];
  scale: string;
};
const jobQueue: QueuedJob[] = [];
let workerRunning = false;

const removeJob = async (job: CompressionJob) => {
  jobs.delete(job.id);
  await Promise.all([
    rm(job.inputPath, { force: true }).catch(() => undefined),
    rm(job.outputDirectory, { recursive: true, force: true }).catch(
      () => undefined,
    ),
  ]);
};

const scheduleCleanup = (job: CompressionJob) => {
  const timer = setTimeout(() => void removeJob(job), JOB_TTL_MS);
  timer.unref();
};

const probeDuration = async (inputPath: string) => {
  const { stdout } = await runFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("Could not determine video duration");
  return duration;
};

const runCompression = async (
  job: CompressionJob,
  profile: (typeof qualityProfiles)[keyof typeof qualityProfiles],
  scale: string,
) => {
  try {
    job.status = "processing";
    const duration = await probeDuration(job.inputPath);
    const useVideoToolbox = await videoToolboxAvailable;
    job.encoder = useVideoToolbox ? "h264_videotoolbox" : "libx264";
    const videoEncoderArguments = useVideoToolbox
      ? [
          "-c:v", "h264_videotoolbox",
          "-b:v", profile.bitrate,
          "-maxrate", profile.maxrate,
          "-bufsize", profile.bufsize,
          "-allow_sw", "1",
        ]
      : [
          "-c:v", "libx264",
          "-preset", profile.preset,
          "-crf", profile.crf,
          "-threads", String(ENCODER_THREADS),
        ];
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        job.inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        scale,
        ...videoEncoderArguments,
        "-filter_threads",
        String(ENCODER_THREADS),
        "-c:a",
        "aac",
        "-b:a",
        profile.audio,
        "-movflags",
        "+faststart",
        "-map_metadata",
        "-1",
        "-progress",
        "pipe:1",
        "-nostats",
        "-y",
        job.outputPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let progressBuffer = "";
    let errorOutput = "";
    ffmpeg.stdout.setEncoding("utf8");
    ffmpeg.stderr.setEncoding("utf8");
    ffmpeg.stderr.on("data", (chunk: string) => {
      errorOutput = (errorOutput + chunk).slice(-8000);
    });
    ffmpeg.stdout.on("data", (chunk: string) => {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const separator = line.indexOf("=");
        if (separator < 0) continue;
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1);
        if (key === "out_time_us" || key === "out_time_ms") {
          const processedSeconds = Number(value) / 1_000_000;
          if (Number.isFinite(processedSeconds))
            job.progress = Math.min(
              99,
              Math.max(
                job.progress,
                Math.floor((processedSeconds / duration) * 100),
              ),
            );
        }
      }
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      ffmpeg.once("error", reject);
      ffmpeg.once("close", resolve);
    });
    if (exitCode !== 0)
      throw new Error(
        errorOutput.trim() || `FFmpeg exited with code ${exitCode}`,
      );

    job.compressedSize = (await stat(job.outputPath)).size;
    job.reductionPercent = Math.round(
      (1 - job.compressedSize / job.originalSize) * 100,
    );
    job.progress = 100;
    job.status = "completed";
    await rm(job.inputPath, { force: true });
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error ? error.message : "Video compression failed";
    await rm(job.inputPath, { force: true }).catch(() => undefined);
  }
};

const processQueue = async () => {
  if (workerRunning) return;
  workerRunning = true;
  try {
    let next: QueuedJob | undefined;
    while ((next = jobQueue.shift())) {
      await runCompression(next.job, next.profile, next.scale);
      next.job.expiresAt = Date.now() + JOB_TTL_MS;
      scheduleCleanup(next.job);
    }
  } finally {
    workerRunning = false;
    if (jobQueue.length > 0) void processQueue();
  }
};

export const createCompressionJob: RequestHandler = async (
  request,
  response,
  next,
) => {
  if (!request.file) {
    response.status(400).json({
      success: false,
      error: { message: "Please upload a video file" },
    });
    return;
  }

  try {
    const quality = String(
      request.body.quality ?? "balanced",
    ) as keyof typeof qualityProfiles;
    const resolution = String(
      request.body.resolution ?? "original",
    ) as keyof typeof resolutionFilters;
    const profile = qualityProfiles[quality];
    const scale = resolutionFilters[resolution];
    if (!profile || !scale) {
      await rm(request.file.path, { force: true });
      response.status(400).json({
        success: false,
        error: { message: "Invalid quality or resolution option" },
      });
      return;
    }

    const outputDirectory = await mkdtemp(
      join(tmpdir(), "fileflow-video-compress-"),
    );
    const originalExtension = extname(request.file.originalname);
    const baseName =
      basename(request.file.originalname, originalExtension).replace(
        /[^a-zA-Z0-9_-]/g,
        "-",
      ) || "video";
    const id = randomUUID();
    const job: CompressionJob = {
      id,
      status: "queued",
      progress: 0,
      inputPath: request.file.path,
      outputDirectory,
      outputPath: join(outputDirectory, "compressed.mp4"),
      downloadName: `${baseName}-compressed.mp4`,
      originalSize: request.file.size,
      expiresAt: Date.now() + JOB_TTL_MS,
    };
    jobs.set(id, job);
    jobQueue.push({ job, profile, scale });
    void processQueue();
    response.status(202).json({
      success: true,
      jobId: id,
      statusUrl: `/api/v1/video-compress/jobs/${id}`,
      encoderThreads: ENCODER_THREADS,
    });
  } catch (error) {
    await rm(request.file.path, { force: true }).catch(() => undefined);
    next(error);
  }
};

export const getCompressionJob: RequestHandler = (request, response) => {
  const job = jobs.get(String(request.params.id));
  if (!job) {
    response.status(404).json({
      success: false,
      error: { message: "Compression job was not found or has expired" },
    });
    return;
  }
  response.json({
    success: true,
    status: job.status,
    progress: job.progress,
    originalSize: job.originalSize,
    compressedSize: job.compressedSize,
    reductionPercent: job.reductionPercent,
    encoder: job.encoder,
    error: job.error,
    downloadUrl:
      job.status === "completed"
        ? `/api/v1/video-compress/jobs/${job.id}/download`
        : undefined,
    expiresAt: new Date(job.expiresAt).toISOString(),
  });
};

export const downloadCompressedVideo: RequestHandler = (
  request,
  response,
  next,
) => {
  const job = jobs.get(String(request.params.id));
  if (!job) {
    response.status(404).json({
      success: false,
      error: { message: "Compression job was not found or has expired" },
    });
    return;
  }
  if (job.status !== "completed" || !job.compressedSize) {
    response.status(409).json({
      success: false,
      error: { message: "Compressed video is not ready" },
    });
    return;
  }
  response.download(job.outputPath, job.downloadName, (error) => {
    if (error && !response.headersSent) next(error);
  });
};
