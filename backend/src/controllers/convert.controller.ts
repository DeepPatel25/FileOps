import type { RequestHandler } from 'express'
import sharp from 'sharp'

const outputFormats = ['png', 'jpeg', 'webp', 'avif'] as const
type OutputFormat = typeof outputFormats[number]

const contentTypes: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
}

export const convertImage: RequestHandler = async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ success: false, error: { message: 'Please upload an image file' } })
      return
    }

    const requestedFormat = String(request.body.format ?? '').toLowerCase()
    if (!outputFormats.includes(requestedFormat as OutputFormat)) {
      response.status(400).json({ success: false, error: { message: 'Output format must be PNG, JPEG, or WebP' } })
      return
    }

    const format = requestedFormat as OutputFormat
    const pipeline = sharp(request.file.buffer, { failOn: 'error' }).rotate()
    const converted = format === 'png'
      ? await pipeline.png({ compressionLevel: 8 }).toBuffer()
      : format === 'jpeg'
        ? await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
        : format === 'webp'
          ? await pipeline.webp({ quality: 88 }).toBuffer()
          : await pipeline.avif({ quality: 55, effort: 5 }).toBuffer()

    const originalName = request.file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'converted'
    const extension = format === 'jpeg' ? 'jpg' : format

    response
      .set({
        'Content-Type': contentTypes[format],
        'Content-Disposition': `attachment; filename="${originalName}.${extension}"`,
        'Content-Length': String(converted.length),
        'X-Original-Size': String(request.file.size),
      })
      .send(converted)
  } catch (error) {
    next(error)
  }
}
