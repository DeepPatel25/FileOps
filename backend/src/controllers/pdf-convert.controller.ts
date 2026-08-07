import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { RequestHandler } from 'express'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

const runFile = promisify(execFile)
const formats = new Set(['png', 'jpeg', 'webp'])
const pageSizes = {
  a4: [595.28, 841.89],
  letter: [612, 792],
} as const

export const pdfToImages: RequestHandler = async (request, response, next) => {
  if (!request.file) { response.status(400).json({ success: false, error: { message: 'Please upload a PDF file' } }); return }
  const format = String(request.body.format ?? 'png')
  const dpi = Number(request.body.dpi ?? 150)
  if (!formats.has(format)) { response.status(400).json({ success: false, error: { message: 'Format must be PNG, JPEG, or WebP' } }); return }
  if (!Number.isInteger(dpi) || dpi < 72 || dpi > 300) { response.status(400).json({ success: false, error: { message: 'DPI must be between 72 and 300' } }); return }
  const directory = await mkdtemp(join(tmpdir(), 'fileflow-pdf-images-'))
  try {
    const input = join(directory, 'source.pdf'); const prefix = join(directory, 'page')
    await writeFile(input, request.file.buffer)
    await runFile('pdftocairo', ['-png', '-r', String(dpi), input, prefix], { timeout: 5 * 60 * 1000, maxBuffer: 2 * 1024 * 1024 })
    const pages = (await readdir(directory)).filter((name) => /^page-\d+\.png$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
    if (!pages.length) throw new Error('No PDF pages were rendered')
    const zip = new JSZip(); const baseName = request.file.originalname.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'document'
    for (const [index, page] of pages.entries()) {
      const source = sharp(await readFile(join(directory, page)))
      const output = format === 'png' ? await source.png({ compressionLevel: 8 }).toBuffer() : format === 'jpeg' ? await source.jpeg({ quality: 88, mozjpeg: true }).toBuffer() : await source.webp({ quality: 88 }).toBuffer()
      zip.file(`${baseName}-page-${index + 1}.${format === 'jpeg' ? 'jpg' : format}`, output)
    }
    const result = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE', streamFiles: true })
    response.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${baseName}-${format}-pages.zip"`, 'X-Page-Count': String(pages.length) }).send(result)
  } catch (error) { next(error) } finally { await rm(directory, { recursive: true, force: true }) }
}

export const imagesToPdf: RequestHandler = async (request, response, next) => {
  const files = request.files as Express.Multer.File[] | undefined
  try {
    if (!files?.length) { response.status(400).json({ success: false, error: { message: 'Please upload at least one image' } }); return }
    const requestedSize = String(request.body.pageSize ?? 'auto')
    const orientation = String(request.body.orientation ?? 'auto')
    if (requestedSize !== 'auto' && !(requestedSize in pageSizes)) { response.status(400).json({ success: false, error: { message: 'Page size must be auto, A4, or letter' } }); return }
    if (!['auto', 'portrait', 'landscape'].includes(orientation)) { response.status(400).json({ success: false, error: { message: 'Orientation must be auto, portrait, or landscape' } }); return }
    const output = await PDFDocument.create()
    for (const file of files) {
      const normalized = await sharp(file.path || file.buffer, { failOn: 'error' }).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      const image = await output.embedJpg(normalized)
      let width = image.width; let height = image.height
      if (requestedSize !== 'auto') [width, height] = pageSizes[requestedSize as keyof typeof pageSizes]
      if (orientation === 'portrait' && width > height || orientation === 'landscape' && height > width) [width, height] = [height, width]
      const page = output.addPage([width, height]); const scale = Math.min(width / image.width, height / image.height)
      const drawWidth = image.width * scale; const drawHeight = image.height * scale
      page.drawImage(image, { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight })
    }
    const result = Buffer.from(await output.save({ useObjectStreams: true }))
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="images.pdf"', 'X-Page-Count': String(files.length) }).send(result)
  } catch (error) { next(error) } finally {
    await Promise.all((files ?? []).map((file) => file.path ? rm(file.path, { force: true }).catch(() => undefined) : undefined))
  }
}
