import type { RequestHandler } from 'express'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'

const parsePageSelection = (value: string, pageCount: number) => {
  const pages = new Set<number>()
  for (const part of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      pages.add(Number(part))
      continue
    }
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (!range) throw new Error('Use page numbers like 1,3-5')
    const start = Number(range[1])
    const end = Number(range[2])
    if (start > end) throw new Error(`Invalid page range: ${part}`)
    for (let page = start; page <= end; page += 1) pages.add(page)
  }
  const result = [...pages].sort((a, b) => a - b)
  if (!result.length) throw new Error('Enter at least one page number')
  if (result.some((page) => page < 1 || page > pageCount)) throw new Error(`Page selection must be between 1 and ${pageCount}`)
  return result
}

export const splitPdf: RequestHandler = async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ success: false, error: { message: 'Please upload a PDF file' } })
      return
    }
    const source = await PDFDocument.load(request.file.buffer, { ignoreEncryption: false })
    const pageCount = source.getPageCount()
    const mode = request.body.mode === 'all' ? 'all' : 'selected'
    const baseName = request.file.originalname.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'document'

    if (mode === 'all') {
      const zip = new JSZip()
      for (let index = 0; index < pageCount; index += 1) {
        const document = await PDFDocument.create()
        const [page] = await document.copyPages(source, [index])
        if (page) document.addPage(page)
        zip.file(`${baseName}-page-${index + 1}.pdf`, await document.save())
      }
      const result = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      response.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${baseName}-pages.zip"`, 'Content-Length': String(result.length), 'X-Page-Count': String(pageCount) }).send(result)
      return
    }

    const selectedPages = parsePageSelection(String(request.body.pages ?? ''), pageCount)
    const document = await PDFDocument.create()
    const copied = await document.copyPages(source, selectedPages.map((page) => page - 1))
    copied.forEach((page) => document.addPage(page))
    const result = await document.save({ useObjectStreams: true })
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${baseName}-extracted.pdf"`, 'Content-Length': String(result.length), 'X-Page-Count': String(selectedPages.length) }).send(Buffer.from(result))
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Use page') || error.message.startsWith('Invalid page') || error.message.startsWith('Enter at') || error.message.startsWith('Page selection'))) {
      response.status(400).json({ success: false, error: { message: error.message } })
      return
    }
    next(error)
  }
}
