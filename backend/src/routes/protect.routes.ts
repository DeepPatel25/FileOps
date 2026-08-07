import { Router } from 'express'
import { protectPdf } from '../controllers/protect.controller.js'
import { pdfUpload } from '../middleware/pdf-upload.js'

export const protectRouter = Router()

protectRouter.post('/', pdfUpload.single('file'), protectPdf)
