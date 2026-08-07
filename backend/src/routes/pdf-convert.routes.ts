import { Router } from 'express'
import { imagesToPdf, pdfToImages } from '../controllers/pdf-convert.controller.js'
import { batchImageUpload } from '../middleware/batch-image-upload.js'
import { pdfUpload } from '../middleware/pdf-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const pdfConvertRouter = Router()
pdfConvertRouter.post('/to-images', pdfUpload.single('file'), validateFileSignatures, pdfToImages)
pdfConvertRouter.post('/from-images', batchImageUpload.array('files', 10), validateFileSignatures, imagesToPdf)
