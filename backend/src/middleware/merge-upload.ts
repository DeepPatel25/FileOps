import multer from 'multer'

const supportedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

export const mergeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_request, file, callback) => {
    if (!supportedTypes.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'files'))
      return
    }
    callback(null, true)
  },
})
