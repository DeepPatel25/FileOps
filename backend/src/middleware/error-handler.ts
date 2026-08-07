import type { ErrorRequestHandler, RequestHandler } from 'express'
import multer from 'multer'
import { env } from '../config/env.js'

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    success: false,
    error: { message: `Route ${request.method} ${request.originalUrl} not found` },
  })
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large for this operation'
      : error.code === 'LIMIT_FILE_COUNT'
        ? 'You can upload a maximum of 10 files'
      : error.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'This file type is not supported'
        : error.message
    response.status(400).json({ success: false, error: { message } })
    return
  }

  const message = error instanceof Error ? error.message : 'Internal server error'

  if (!env.isProduction) console.error(error)

  response.status(500).json({
    success: false,
    error: { message: env.isProduction ? 'Internal server error' : message },
  })
}
