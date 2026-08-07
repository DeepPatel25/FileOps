import { Router } from 'express'
import { organizePdfPages, previewPdfPages } from '../controllers/pdf-organize.controller.js'
import { pdfUpload } from '../middleware/pdf-upload.js'

export const pdfOrganizeRouter = Router()

pdfOrganizeRouter.post('/preview', pdfUpload.single('file'), previewPdfPages)
pdfOrganizeRouter.post('/', pdfUpload.single('file'), organizePdfPages)
