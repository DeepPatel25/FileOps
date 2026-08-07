import { Router } from 'express'
import { compressImage } from '../controllers/compress.controller.js'
import { imageUpload } from '../middleware/upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const compressRouter = Router()

compressRouter.post('/', imageUpload.single('file'), validateFileSignatures, compressImage)
