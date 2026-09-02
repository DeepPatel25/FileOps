import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { Router } from "express";
import { getVideoQueueHealth } from "../controllers/video-compress.controller.js";
import { env } from "../config/env.js";

const runFile = promisify(execFile);
export const healthRouter = Router();

const checkCommand = async (command: string, versionArgument = "-version") => {
  await runFile(command, [versionArgument], {
    timeout: 5_000,
    maxBuffer: 256 * 1024,
  });
  return "available";
};

const checkHttp = async (url: string) => {
  const result = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!result.ok) throw new Error(`Health endpoint returned ${result.status}`);
  return "available";
};

healthRouter.get("/", async (_request, response) => {
  const [ffmpeg, ffprobe, poppler, gotenberg, queue, disk] =
    await Promise.allSettled([
      checkCommand("ffmpeg"),
      checkCommand("ffprobe"),
      checkCommand("pdftocairo", "-v"),
      checkHttp(`${env.gotenbergUrl}/health`),
      getVideoQueueHealth(),
      statfs(tmpdir()),
    ]);
  const dependencies = {
    ffmpeg: ffmpeg.status === "fulfilled" ? ffmpeg.value : "unavailable",
    ffprobe: ffprobe.status === "fulfilled" ? ffprobe.value : "unavailable",
    poppler: poppler.status === "fulfilled" ? poppler.value : "unavailable",
    gotenberg:
      gotenberg.status === "fulfilled" ? gotenberg.value : "unavailable",
    redis:
      queue.status === "fulfilled" && queue.value.redis === "PONG"
        ? "available"
        : "unavailable",
  };
  const healthy =
    Object.values(dependencies).every((value) => value === "available") &&
    disk.status === "fulfilled";
  const memory = process.memoryUsage();
  response.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? "healthy" : "degraded",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies,
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
      },
      temporaryDisk:
        disk.status === "fulfilled"
          ? {
              freeBytes: disk.value.bavail * disk.value.bsize,
              totalBytes: disk.value.blocks * disk.value.bsize,
            }
          : undefined,
      videoQueue: queue.status === "fulfilled" ? queue.value : undefined,
    },
  });
});

healthRouter.get("/metrics", async (_request, response, next) => {
  try {
    const queue = await getVideoQueueHealth();
    const memory = process.memoryUsage();
    response.json({
      success: true,
      data: {
        uptimeSeconds: Math.round(process.uptime()),
        memory,
        videoQueue: queue,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});
