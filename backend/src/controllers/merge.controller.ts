import type { RequestHandler } from 'express'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

const MAX_PAGE_EDGE = 1200

export const mergeFiles: RequestHandler = async (request, response, next) => {
  try {
    const files = request.files as Express.Multer.File[] | undefined
    if (!files || files.length < 2) {
      response.status(400).json({ success: false, error: { message: 'Please upload at least two files' } })
      return
    }

    const output = await PDFDocument.create()

    for (const file of files) {
      if (file.mimetype === 'application/pdf') {
        const source = await PDFDocument.load(file.buffer, { ignoreEncryption: false })
        const pages = await output.copyPages(source, source.getPageIndices())
        pages.forEach((page) => output.addPage(page))
        continue
      }

      const normalized = await sharp(file.buffer).rotate().png().toBuffer()
      const image = await output.embedPng(normalized)
      const scale = Math.min(1, MAX_PAGE_EDGE / Math.max(image.width, image.height))
      const width = image.width * scale
      const height = image.height * scale
      const page = output.addPage([width, height])
      page.drawImage(image, { x: 0, y: 0, width, height })
    }

    const merged = await output.save({ useObjectStreams: true })
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="merged-files.pdf"',
      'Content-Length': String(merged.length),
      'X-Merged-Files': String(files.length),
    }).send(Buffer.from(merged))
  } catch (error) {
    next(error)
  }
}
