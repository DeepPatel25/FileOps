import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import multer from 'multer'

export const mediaUploadDirectory = join(tmpdir(), 'fileflow-media-uploads')
mkdirSync(mediaUploadDirectory, { recursive: true })
const extensions = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg'])

export const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: mediaUploadDirectory,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if ((!file.mimetype.startsWith('video/') && !file.mimetype.startsWith('audio/')) || !extensions.has(extname(file.originalname).toLowerCase())) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file')); return
    }
    callback(null, true)
  },
})
