import type { RequestHandler } from 'express'
import sharp from 'sharp'

const contentTypes = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const

export const compressImage: RequestHandler = async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ success: false, error: { message: 'Please upload an image file' } })
      return
    }

    const requestedQuality = Number(request.body.quality ?? 75)
    if (!Number.isInteger(requestedQuality) || requestedQuality < 20 || requestedQuality > 95) {
      response.status(400).json({ success: false, error: { message: 'Quality must be between 20 and 95' } })
      return
    }

    const image = sharp(request.file.buffer, { failOn: 'error' }).rotate()
    const metadata = await image.metadata()
    const format = metadata.format

    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') {
      response.status(400).json({ success: false, error: { message: 'Only PNG, JPEG, and WebP images are supported' } })
      return
    }

    const compressed = format === 'jpeg'
      ? await image.jpeg({ quality: requestedQuality, mozjpeg: true }).toBuffer()
      : format === 'webp'
        ? await image.webp({ quality: requestedQuality, effort: 4 }).toBuffer()
        : await image.png({ compressionLevel: 9, palette: true, quality: requestedQuality }).toBuffer()

    const baseName = request.file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'image'
    const extension = format === 'jpeg' ? 'jpg' : format

    response.set({
      'Content-Type': contentTypes[format],
      'Content-Disposition': `attachment; filename="${baseName}-compressed.${extension}"`,
      'Content-Length': String(compressed.length),
      'X-Original-Size': String(request.file.size),
      'X-Compressed-Size': String(compressed.length),
    }).send(compressed)
  } catch (error) {
    next(error)
  }
}
