import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import multer from 'multer'

export const pdfCompressUploadDirectory = join(tmpdir(), 'fileflow-pdf-compress-uploads')
mkdirSync(pdfCompressUploadDirectory, { recursive: true })

export const pdfCompressUpload = multer({
  storage: multer.diskStorage({
    destination: pdfCompressUploadDirectory,
    filename: (_request, _file, callback) => callback(null, `${randomUUID()}.pdf`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'))
      return
    }
    callback(null, true)
  },
})
