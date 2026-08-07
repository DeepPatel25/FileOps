import { Router } from 'express'
import { compressPdf } from '../controllers/pdf-compress.controller.js'
import { pdfCompressUpload } from '../middleware/pdf-compress-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const pdfCompressRouter = Router()

pdfCompressRouter.post('/', pdfCompressUpload.single('file'), validateFileSignatures, compressPdf)
