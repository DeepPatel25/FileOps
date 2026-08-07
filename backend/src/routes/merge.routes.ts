import { Router } from 'express'
import { mergeFiles } from '../controllers/merge.controller.js'
import { mergeUpload } from '../middleware/merge-upload.js'
import { validateFileSignatures } from '../middleware/file-signature.js'

export const mergeRouter = Router()

mergeRouter.post('/', mergeUpload.array('files', 10), validateFileSignatures, mergeFiles)
