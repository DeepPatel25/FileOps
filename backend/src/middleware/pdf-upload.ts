import multer from 'multer'

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'))
      return
    }
    callback(null, true)
  },
})
