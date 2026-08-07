import { Router } from "express";
import { splitVideo } from "../controllers/video-split.controller.js";
import { videoUpload } from "../middleware/video-upload.js";
import { validateFileSignatures } from '../middleware/file-signature.js'

export const videoSplitRouter = Router();

videoSplitRouter.post("/", videoUpload.single("file"), validateFileSignatures, splitVideo);
