import { Router } from 'express'
import { convertDocument } from '../controllers/document-convert.controller.js'
import { contentUpload } from '../middleware/content-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const documentConvertRouter = Router()
documentConvertRouter.post('/', contentUpload.single('file'), validateFileSignatures, convertDocument)
