import { Router } from 'express'
import { extractContent } from '../controllers/extract.controller.js'
import { contentUpload } from '../middleware/content-upload.js'

export const extractRouter = Router()

extractRouter.post('/', contentUpload.single('file'), extractContent)
