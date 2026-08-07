import { Router } from 'express'
import { mergeFiles } from '../controllers/merge.controller.js'
import { mergeUpload } from '../middleware/merge-upload.js'

export const mergeRouter = Router()

mergeRouter.post('/', mergeUpload.array('files', 10), mergeFiles)
