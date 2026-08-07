import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { RequestHandler } from 'express'
import { degrees, PDFDocument } from 'pdf-lib'

const runFile = promisify(execFile)
const MAX_PAGES = 100
const rotations = new Set([0, 90, 180, 270])

type PageOperation = { page: number; rotation: number }

const loadPdf = async (buffer: Buffer) => {
  try {
    return await PDFDocument.load(buffer, { ignoreEncryption: false })
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message)) {
      throw new Error('Password-protected PDFs are not supported by the page organizer')
    }
    throw error
  }
}

export const previewPdfPages: RequestHandler = async (request, response, next) => {
  if (!request.file) {
    response.status(400).json({ success: false, error: { message: 'Please upload a PDF file' } })
    return
  }

  let directory: string | undefined
  try {
    const source = await loadPdf(request.file.buffer)
    const pageCount = source.getPageCount()
    if (pageCount < 1 || pageCount > MAX_PAGES) {
      response.status(422).json({ success: false, error: { message: `PDF organizer supports between 1 and ${MAX_PAGES} pages` } })
      return
    }

    directory = await mkdtemp(join(tmpdir(), 'fileflow-pdf-preview-'))
    const sourcePath = join(directory, 'source.pdf')
    const prefix = join(directory, 'page')
    await writeFile(sourcePath, request.file.buffer)
    await runFile('pdftocairo', ['-jpeg', '-scale-to', '240', '-jpegopt', 'quality=65,progressive=y,optimize=y', sourcePath, prefix], {
      maxBuffer: 2 * 1024 * 1024,
      timeout: 2 * 60 * 1000,
    })
    const files = (await readdir(directory))
      .filter((name) => /^page-\d+\.jpg$/.test(name))
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]))
    if (files.length !== pageCount) throw new Error('Could not create every page preview')
    const pages = await Promise.all(files.map(async (name, index) => ({
      page: index + 1,
      thumbnail: `data:image/jpeg;base64,${(await readFile(join(directory!, name))).toString('base64')}`,
    })))
    response.json({ success: true, data: { pageCount, pages } })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Password-protected')) {
      response.status(422).json({ success: false, error: { message: error.message } })
      return
    }
    next(error)
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true })
  }
}

export const organizePdfPages: RequestHandler = async (request, response, next) => {
  if (!request.file) {
    response.status(400).json({ success: false, error: { message: 'Please upload a PDF file' } })
    return
  }

  try {
    const source = await loadPdf(request.file.buffer)
    const pageCount = source.getPageCount()
    let operations: unknown
    try {
      operations = JSON.parse(String(request.body.operations ?? ''))
    } catch {
      operations = undefined
    }
    if (!Array.isArray(operations) || operations.length < 1 || operations.length > pageCount) {
      response.status(400).json({ success: false, error: { message: 'Page operations must contain between 1 and the document page count' } })
      return
    }
    const parsed = operations as PageOperation[]
    const valid = parsed.every((item) => Number.isInteger(item?.page) && item.page >= 1 && item.page <= pageCount && rotations.has(item.rotation))
    const uniquePages = new Set(parsed.map((item) => item.page))
    if (!valid || uniquePages.size !== parsed.length) {
      response.status(400).json({ success: false, error: { message: 'Each page must be unique and use a rotation of 0, 90, 180, or 270 degrees' } })
      return
    }

    const output = await PDFDocument.create()
    const copied = await output.copyPages(source, parsed.map((item) => item.page - 1))
    copied.forEach((page, index) => {
      const operation = parsed[index]
      if (!operation) return
      page.setRotation(degrees((page.getRotation().angle + operation.rotation) % 360))
      output.addPage(page)
    })
    const result = Buffer.from(await output.save({ useObjectStreams: true, addDefaultPage: false }))
    const baseName = request.file.originalname.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'document'
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseName}-organized.pdf"`,
      'Content-Length': String(result.length),
      'X-Page-Count': String(parsed.length),
    }).send(result)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Password-protected')) {
      response.status(422).json({ success: false, error: { message: error.message } })
      return
    }
    next(error)
  }
}
