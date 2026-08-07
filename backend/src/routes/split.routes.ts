import { Router } from 'express'
import { splitPdf } from '../controllers/split.controller.js'
import { pdfUpload } from '../middleware/pdf-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const splitRouter = Router()

splitRouter.post('/', pdfUpload.single('file'), validateFileSignatures, splitPdf)
