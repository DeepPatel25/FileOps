import { readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directoryPrefixes = [
  'fileflow-batch-output-', 'fileflow-images-', 'fileflow-media-convert-',
  'fileflow-ocr-', 'fileflow-pdf-compress-', 'fileflow-pdf-images-',
  'fileflow-pdf-preview-', 'fileflow-video-compress-', 'fileflow-video-split-',
]
const uploadDirectories = ['fileflow-batch-images', 'fileflow-media-uploads', 'fileflow-pdf-compress-uploads', 'fileflow-video-uploads']

export const cleanupStaleTemporaryFiles = async (maximumAgeMs = 24 * 60 * 60 * 1000) => {
  const temporaryRoot = tmpdir()
  const cutoff = Date.now() - maximumAgeMs
  let removed = 0
  const entries = await readdir(temporaryRoot, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(temporaryRoot, entry.name)
    if (entry.isDirectory() && directoryPrefixes.some((prefix) => entry.name.startsWith(prefix))) {
      if ((await stat(path)).mtimeMs < cutoff) { await rm(path, { recursive: true, force: true }); removed++ }
      continue
    }
    if (entry.isDirectory() && uploadDirectories.includes(entry.name)) {
      const uploads = await readdir(path, { withFileTypes: true }).catch(() => [])
      for (const upload of uploads) {
        const uploadPath = join(path, upload.name)
        if ((await stat(uploadPath)).mtimeMs < cutoff) { await rm(uploadPath, { recursive: upload.isDirectory(), force: true }); removed++ }
      }
    }
  }
  return removed
}

export const startTemporaryFileCleanup = () => {
  const run = () => void cleanupStaleTemporaryFiles().then((removed) => {
    if (removed) console.log(JSON.stringify({ level: 'info', event: 'temp_cleanup', removed }))
  }).catch((error: unknown) => console.error(JSON.stringify({ level: 'error', event: 'temp_cleanup_failed', message: error instanceof Error ? error.message : String(error) })))
  run()
  const timer = setInterval(run, 60 * 60 * 1000)
  timer.unref()
  return () => clearInterval(timer)
}
