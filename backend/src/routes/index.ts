import { Router } from 'express'
import { healthRouter } from './health.routes.js'
import { toolRouter } from './tool.routes.js'
import { convertRouter } from './convert.routes.js'
import { compressRouter } from './compress.routes.js'
import { mergeRouter } from './merge.routes.js'
import { splitRouter } from './split.routes.js'
import { protectRouter } from './protect.routes.js'
import { extractRouter } from './extract.routes.js'
import { videoSplitRouter } from "./video-split.routes.js";
import { videoCompressRouter } from "./video-compress.routes.js";
import { pdfCompressRouter } from './pdf-compress.routes.js'
import { pdfOrganizeRouter } from './pdf-organize.routes.js'
import { batchImageRouter } from './batch-image.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/tools', toolRouter)
apiRouter.use('/convert', convertRouter)
apiRouter.use('/compress', compressRouter)
apiRouter.use('/merge', mergeRouter)
apiRouter.use('/split', splitRouter)
apiRouter.use('/protect', protectRouter)
apiRouter.use('/extract', extractRouter)
apiRouter.use("/video-split", videoSplitRouter);
apiRouter.use("/video-compress", videoCompressRouter);
apiRouter.use('/pdf-compress', pdfCompressRouter)
apiRouter.use('/pdf-organize', pdfOrganizeRouter)
apiRouter.use('/batch-images', batchImageRouter)
