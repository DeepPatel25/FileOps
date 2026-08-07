import { Router } from "express";
import { cancelCompressionJob, clearCompressionHistory, createCompressionJob, downloadCompressedVideo, getCompressionJob, listCompressionJobs, removeCompressionHistory } from "../controllers/video-compress.controller.js";
import { videoUpload } from "../middleware/video-upload.js";
import { validateFileSignatures } from '../middleware/file-signature.js'

export const videoCompressRouter = Router();

videoCompressRouter.post("/", videoUpload.single("file"), validateFileSignatures, createCompressionJob);
videoCompressRouter.get('/jobs', listCompressionJobs);
videoCompressRouter.get("/jobs/:id", getCompressionJob);
videoCompressRouter.get("/jobs/:id/download", downloadCompressedVideo);
videoCompressRouter.delete('/jobs/:id', cancelCompressionJob);
videoCompressRouter.delete('/history', clearCompressionHistory);
videoCompressRouter.delete('/history/:id', removeCompressionHistory);
