import { Router } from 'express'
import { splitPdf } from '../controllers/split.controller.js'
import { pdfUpload } from '../middleware/pdf-upload.js'

export const splitRouter = Router()

splitRouter.post('/', pdfUpload.single('file'), splitPdf)
