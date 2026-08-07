import { Router } from 'express'
import { convertImage } from '../controllers/convert.controller.js'
import { imageUpload } from '../middleware/upload.js'

export const convertRouter = Router()

convertRouter.post('/', imageUpload.single('file'), convertImage)
