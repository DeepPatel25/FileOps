import type { RequestHandler } from 'express'
import JSZip from 'jszip'
import sharp from 'sharp'

const outputFormats = new Set(['png', 'jpeg', 'webp'])
type ImageFormat = 'png' | 'jpeg' | 'webp'

const normalizeName = (name: string) => name
  .replace(/\.[^.]+$/, '')
  .replace(/[^a-zA-Z0-9_-]/g, '-') || 'image'

const encodeImage = async (buffer: Buffer, format: ImageFormat, quality: number) => {
  const pipeline = sharp(buffer, { failOn: 'error' }).rotate()
  if (format === 'jpeg') return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
  if (format === 'webp') return pipeline.webp({ quality, effort: 4 }).toBuffer()
  return pipeline.png({ compressionLevel: 9, palette: true, quality }).toBuffer()
}

export const processBatchImages: RequestHandler = async (request, response, next) => {
  try {
    const files = request.files as Express.Multer.File[] | undefined
    if (!files?.length) {
      response.status(400).json({ success: false, error: { message: 'Please upload at least one image' } })
      return
    }

    const operation = String(request.body.operation ?? 'compress')
    if (operation !== 'compress' && operation !== 'convert') {
      response.status(400).json({ success: false, error: { message: 'Operation must be compress or convert' } })
      return
    }
    const requestedQuality = Number(request.body.quality ?? 75)
    if (!Number.isInteger(requestedQuality) || requestedQuality < 20 || requestedQuality > 95) {
      response.status(400).json({ success: false, error: { message: 'Quality must be between 20 and 95' } })
      return
    }
    const requestedFormat = String(request.body.format ?? 'webp').toLowerCase()
    if (operation === 'convert' && !outputFormats.has(requestedFormat)) {
      response.status(400).json({ success: false, error: { message: 'Output format must be PNG, JPEG, or WebP' } })
      return
    }

    const archive = new JSZip()
    let originalSize = 0
    let outputSize = 0
    for (const [index, file] of files.entries()) {
      const metadata = await sharp(file.buffer, { failOn: 'error' }).metadata()
      if (metadata.format !== 'png' && metadata.format !== 'jpeg' && metadata.format !== 'webp') {
        response.status(400).json({ success: false, error: { message: `${file.originalname} is not a supported image` } })
        return
      }
      const format = operation === 'convert' ? requestedFormat as ImageFormat : metadata.format
      const output = await encodeImage(file.buffer, format, requestedQuality)
      const extension = format === 'jpeg' ? 'jpg' : format
      const suffix = operation === 'compress' ? '-compressed' : ''
      archive.file(`${String(index + 1).padStart(2, '0')}-${normalizeName(file.originalname)}${suffix}.${extension}`, output)
      originalSize += file.size
      outputSize += output.length
    }

    const result = await archive.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE',
      streamFiles: true,
    })
    response.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="fileflow-batch-images.zip"',
      'Content-Length': String(result.length),
      'X-Processed-Count': String(files.length),
      'X-Original-Size': String(originalSize),
      'X-Compressed-Size': String(outputSize),
      'X-Reduction-Percent': String(Math.round((1 - outputSize / originalSize) * 100)),
    }).send(result)
  } catch (error) {
    next(error)
  }
}
