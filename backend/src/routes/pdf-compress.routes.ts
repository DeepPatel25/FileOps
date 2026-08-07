import { Router } from 'express'
import { compressPdf } from '../controllers/pdf-compress.controller.js'
import { pdfCompressUpload } from '../middleware/pdf-compress-upload.js'

export const pdfCompressRouter = Router()

pdfCompressRouter.post('/', pdfCompressUpload.single('file'), compressPdf)
