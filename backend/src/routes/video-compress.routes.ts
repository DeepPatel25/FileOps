import { Router } from "express";
import { createCompressionJob, downloadCompressedVideo, getCompressionJob } from "../controllers/video-compress.controller.js";
import { videoUpload } from "../middleware/video-upload.js";

export const videoCompressRouter = Router();

videoCompressRouter.post("/", videoUpload.single("file"), createCompressionJob);
videoCompressRouter.get("/jobs/:id", getCompressionJob);
videoCompressRouter.get("/jobs/:id/download", downloadCompressedVideo);
