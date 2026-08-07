import { open, rm } from 'node:fs/promises'
import type { RequestHandler } from 'express'

type Uploaded = Express.Multer.File

const readHeader = async (file: Uploaded) => {
  if (file.buffer) return file.buffer.subarray(0, 32)
  const handle = await open(file.path, 'r')
  try { const header = Buffer.alloc(32); const { bytesRead } = await handle.read(header, 0, header.length, 0); return header.subarray(0, bytesRead) } finally { await handle.close() }
}

const matches = (buffer: Buffer, bytes: number[], offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte)
const detectFamily = (buffer: Buffer) => {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'pdf'
  if (matches(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (matches(buffer, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp'
  if (buffer.subarray(4, 8).toString() === 'ftyp') return 'iso-media'
  if (matches(buffer, [0x50, 0x4b, 0x03, 0x04])) return 'zip'
  if (matches(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'matroska'
  if (buffer.subarray(0, 4).toString() === 'OggS') return 'ogg'
  if (buffer.subarray(0, 4).toString() === 'fLaC') return 'flac'
  if (buffer.subarray(0, 3).toString() === 'ID3' || buffer[0] === 0xff && (buffer[1] ?? 0) >= 0xe0) return 'mp3'
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WAVE') return 'wav'
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'AVI ') return 'avi'
  return 'unknown'
}

const allowedFamilies = (file: Uploaded) => {
  if (file.mimetype === 'application/pdf') return new Set(['pdf'])
  if (file.mimetype.includes('officedocument')) return new Set(['zip'])
  if (file.mimetype === 'image/png') return new Set(['png'])
  if (file.mimetype === 'image/jpeg') return new Set(['jpeg'])
  if (file.mimetype === 'image/webp') return new Set(['webp'])
  if (['image/avif', 'image/heic', 'image/heif'].includes(file.mimetype)) return new Set(['iso-media'])
  if (file.mimetype.startsWith('video/')) return new Set(['iso-media', 'matroska', 'avi'])
  if (file.mimetype.startsWith('audio/')) return new Set(['iso-media', 'mp3', 'wav', 'ogg', 'flac'])
  return new Set<string>()
}

export const validateFileSignatures: RequestHandler = async (request, response, next) => {
  try {
    const files = [request.file, ...(Array.isArray(request.files) ? request.files : [])].filter(Boolean) as Uploaded[]
    for (const file of files) {
      const family = detectFamily(await readHeader(file))
      if (!allowedFamilies(file).has(family)) {
        await Promise.all(files.filter((item) => !item.buffer && item.path).map((item) => rm(item.path, { force: true }).catch(() => undefined)))
        response.status(400).json({ success: false, error: { message: `${file.originalname} content does not match its declared file type` } })
        return
      }
    }
    next()
  } catch (error) { next(error) }
}
