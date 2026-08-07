import { Router } from 'express'
import { organizePdfPages, previewPdfPages } from '../controllers/pdf-organize.controller.js'
import { pdfUpload } from '../middleware/pdf-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const pdfOrganizeRouter = Router()

pdfOrganizeRouter.post('/preview', pdfUpload.single('file'), validateFileSignatures, previewPdfPages)
pdfOrganizeRouter.post('/', pdfUpload.single('file'), validateFileSignatures, organizePdfPages)
