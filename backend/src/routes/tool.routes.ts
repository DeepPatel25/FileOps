import { Router } from 'express'
import { getTool, listTools } from '../controllers/tool.controller.js'

export const toolRouter = Router()

toolRouter.get('/', listTools)
toolRouter.get('/:id', getTool)
