import multer from 'multer'

const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!supportedTypes.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'))
      return
    }
    callback(null, true)
  },
})
