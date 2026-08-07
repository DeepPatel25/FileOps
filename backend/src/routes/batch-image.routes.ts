import { Router } from 'express'
import { processBatchImages } from '../controllers/batch-image.controller.js'
import { batchImageUpload } from '../middleware/batch-image-upload.js'

export const batchImageRouter = Router()

batchImageRouter.post('/', batchImageUpload.array('files', 10), processBatchImages)
