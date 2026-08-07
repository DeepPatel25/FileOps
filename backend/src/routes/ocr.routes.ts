import { Router } from 'express'
import { recognizeText } from '../controllers/ocr.controller.js'
import { ocrUpload } from '../middleware/ocr-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const ocrRouter = Router()

ocrRouter.post('/', ocrUpload.single('file'), validateFileSignatures, recognizeText)
