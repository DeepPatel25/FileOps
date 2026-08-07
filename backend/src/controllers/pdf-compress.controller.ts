import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { pipeline } from 'node:stream/promises'
import type { RequestHandler } from 'express'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

const runFile = promisify(execFile)
const MAX_PAGES = 1000

const compressionProfiles = {
  high: { dpi: 150, quality: 85 },
  balanced: { dpi: 120, quality: 72 },
  small: { dpi: 96, quality: 58 },
} as const

const fallbackProfiles = {
  high: [{ scale: 1, quality: 85 }, { scale: 0.8, quality: 72 }, { scale: 0.65, quality: 60 }],
  balanced: [{ scale: 1, quality: 72 }, { scale: 0.8, quality: 60 }, { scale: 0.6, quality: 50 }],
  small: [{ scale: 1, quality: 58 }, { scale: 0.75, quality: 50 }, { scale: 0.55, quality: 42 }],
} as const

type CompressionPreset = keyof typeof compressionProfiles

const isPasswordError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const details = `${'message' in error ? String(error.message) : ''} ${'stderr' in error ? String(error.stderr) : ''}`
  return /password|encrypted/i.test(details)
}

export const compressPdf: RequestHandler = async (request, response, next) => {
  if (!request.file) {
    response.status(400).json({ success: false, error: { message: 'Please upload a PDF file' } })
    return
  }

  const preset = String(request.body.preset ?? 'balanced') as CompressionPreset
  const profile = compressionProfiles[preset]
  if (!profile) {
    if (request.file.path) await rm(request.file.path, { force: true })
    response.status(400).json({ success: false, error: { message: 'Preset must be high, balanced, or small' } })
    return
  }
  const password = String(request.body.password ?? '')
  if (password.length > 128) {
    if (request.file.path) await rm(request.file.path, { force: true })
    response.status(400).json({ success: false, error: { message: 'PDF password must not exceed 128 characters' } })
    return
  }

  const directory = await mkdtemp(join(tmpdir(), 'fileflow-pdf-compress-'))
  try {
    const sourcePath = request.file.path || join(directory, 'source.pdf')
    const outputPrefix = join(directory, 'page')
    if (!request.file.path) await writeFile(sourcePath, request.file.buffer)

    const passwordArguments = password ? ['-upw', password] : []
    let pageCount: number
    try {
      const { stdout } = await runFile('pdfinfo', [...passwordArguments, sourcePath], {
        maxBuffer: 1024 * 1024,
        timeout: 30_000,
      })
      pageCount = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1])
    } catch (error) {
      if (isPasswordError(error)) {
        response.status(401).json({ success: false, error: { message: 'This PDF is password-protected. Enter the correct password and try again.' } })
        return
      }
      throw error
    }
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      response.status(422).json({ success: false, error: { message: 'The PDF does not contain any pages' } })
      return
    }
    if (pageCount > MAX_PAGES) {
      response.status(422).json({ success: false, error: { message: `PDF compression supports up to ${MAX_PAGES} pages` } })
      return
    }

    try {
      await runFile('pdftocairo', [
        ...passwordArguments,
        '-jpeg', '-r', String(profile.dpi),
        '-jpegopt', `quality=${profile.quality},progressive=y,optimize=y`,
        sourcePath, outputPrefix,
      ], { maxBuffer: 4 * 1024 * 1024, timeout: 5 * 60 * 1000 })
    } catch (error) {
      if (isPasswordError(error)) {
        response.status(401).json({ success: false, error: { message: 'This PDF is password-protected. Enter the correct password and try again.' } })
        return
      }
      throw error
    }

    const images = (await readdir(directory))
      .filter((name) => /^page-\d+\.jpg$/.test(name))
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]))
    if (images.length !== pageCount) throw new Error('Could not render every PDF page')

    const buildCandidate = async ({ scale, quality }: { scale: number; quality: number }) => {
      const output = await PDFDocument.create()
      for (const imageName of images) {
        const sourceImage = sharp(await readFile(join(directory, imageName)))
        const metadata = await sourceImage.metadata()
        if (!metadata.width || !metadata.height) throw new Error('Could not determine rendered page dimensions')
        const imageBuffer = scale === 1
          ? await sourceImage.toBuffer()
          : await sourceImage
            .resize({ width: Math.max(1, Math.round(metadata.width * scale)), withoutEnlargement: true })
            .jpeg({ quality, progressive: true, mozjpeg: true })
            .toBuffer()
        const image = await output.embedJpg(imageBuffer)
        const width = metadata.width * 72 / profile.dpi
        const height = metadata.height * 72 / profile.dpi
        const page = output.addPage([width, height])
        page.drawImage(image, { x: 0, y: 0, width, height })
      }
      return Buffer.from(await output.save({ useObjectStreams: true, addDefaultPage: false }))
    }

    let compressed: Buffer | undefined
    let compressedLength = request.file.size
    let compressionApplied = false
    for (const candidateProfile of fallbackProfiles[preset]) {
      const candidate = await buildCandidate(candidateProfile)
      if (candidate.length < compressedLength) {
        compressed = candidate
        compressedLength = candidate.length
        compressionApplied = true
      }
      if (compressedLength <= request.file.size * 0.9) break
    }
    const reduction = Math.round((1 - compressedLength / request.file.size) * 100)
    const baseName = request.file.originalname.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'document'
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseName}-compressed.pdf"`,
      'Content-Length': String(compressedLength),
      'X-Original-Size': String(request.file.size),
      'X-Compressed-Size': String(compressedLength),
      'X-Reduction-Percent': String(reduction),
      'X-Compression-Applied': String(compressionApplied),
      'X-Page-Count': String(pageCount),
    })
    if (compressed) response.send(compressed)
    else if (request.file.path) await pipeline(createReadStream(sourcePath), response)
    else response.send(request.file.buffer)
  } catch (error) {
    next(error)
  } finally {
    await rm(directory, { recursive: true, force: true })
    if (request.file.path) await rm(request.file.path, { force: true }).catch(() => undefined)
  }
}
