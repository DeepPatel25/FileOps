import { Router } from 'express'
import { convertMedia } from '../controllers/media-convert.controller.js'
import { mediaUpload } from '../middleware/media-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const mediaConvertRouter = Router()
mediaConvertRouter.post('/', mediaUpload.single('file'), validateFileSignatures, convertMedia)
