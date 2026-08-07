import { Router } from "express";
import { splitVideo } from "../controllers/video-split.controller.js";
import { videoUpload } from "../middleware/video-upload.js";

export const videoSplitRouter = Router();

videoSplitRouter.post("/", videoUpload.single("file"), splitVideo);
