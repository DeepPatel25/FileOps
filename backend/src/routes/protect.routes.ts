import { Router } from 'express'
import { protectPdf } from '../controllers/protect.controller.js'
import { pdfUpload } from '../middleware/pdf-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const protectRouter = Router()

protectRouter.post('/', pdfUpload.single('file'), validateFileSignatures, protectPdf)
