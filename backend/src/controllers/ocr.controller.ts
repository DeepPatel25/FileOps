import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { RequestHandler } from 'express'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

const runFile = promisify(execFile)
const MAX_PDF_PAGES = 20
const languagePath = join(dirname(fileURLToPath(import.meta.url)), '../../node_modules/@tesseract.js-data/eng/4.0.0')

const prepareImage = (buffer: Buffer) => sharp(buffer, { failOn: 'error' })
  .rotate()
  .flatten({ background: '#ffffff' })
  .grayscale()
  .normalize()
  .png()
  .toBuffer()

export const recognizeText: RequestHandler = async (request, response, next) => {
  if (!request.file) {
    response.status(400).json({ success: false, error: { message: 'Please upload a PDF or image file' } })
    return
  }

  let directory: string | undefined
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined
  try {
    const images: Array<{ page: number; buffer: Buffer }> = []
    if (request.file.mimetype === 'application/pdf') {
      let document: PDFDocument
      try {
        document = await PDFDocument.load(request.file.buffer, { ignoreEncryption: false })
      } catch (error) {
        if (error instanceof Error && /encrypted/i.test(error.message)) {
          response.status(422).json({ success: false, error: { message: 'Password-protected PDFs are not supported by OCR' } })
          return
        }
        throw error
      }
      const pageCount = document.getPageCount()
      if (pageCount < 1 || pageCount > MAX_PDF_PAGES) {
        response.status(422).json({ success: false, error: { message: `PDF OCR supports between 1 and ${MAX_PDF_PAGES} pages` } })
        return
      }
      directory = await mkdtemp(join(tmpdir(), 'fileflow-ocr-'))
      const inputPath = join(directory, 'source.pdf')
      await writeFile(inputPath, request.file.buffer)
      await runFile('pdftocairo', ['-png', '-r', '180', inputPath, join(directory, 'page')], {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 3 * 60 * 1000,
      })
      const pageFiles = (await readdir(directory))
        .filter((name) => /^page-\d+\.png$/.test(name))
        .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]))
      for (const [index, name] of pageFiles.entries()) images.push({ page: index + 1, buffer: await readFile(join(directory, name)) })
    } else {
      images.push({ page: 1, buffer: await prepareImage(request.file.buffer) })
    }

    worker = await createWorker('eng', 1, { langPath: languagePath, cacheMethod: 'none', gzip: true })
    const pages: Array<{ page: number; text: string; confidence: number }> = []
    for (const image of images) {
      const result = await worker.recognize(image.buffer)
      pages.push({
        page: image.page,
        text: result.data.text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
        confidence: Math.round(result.data.confidence),
      })
    }
    const text = pages.map((page) => pages.length > 1 ? `Page ${page.page}\n${page.text}` : page.text).join('\n\n').trim()
    response.json({
      success: true,
      data: {
        text,
        pages,
        pageCount: pages.length,
        words: text ? text.split(/\s+/).length : 0,
        characters: text.length,
        averageConfidence: pages.length ? Math.round(pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length) : 0,
        fileName: request.file.originalname,
        language: 'eng',
      },
    })
  } catch (error) {
    next(error)
  } finally {
    await worker?.terminate().catch(() => undefined)
    if (directory) await rm(directory, { recursive: true, force: true })
  }
}
