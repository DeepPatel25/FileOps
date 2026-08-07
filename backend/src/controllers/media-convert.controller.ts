import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import type { RequestHandler } from 'express'

const runFile = promisify(execFile)
const outputArguments = {
  mp4: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart'],
  webm: ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus'],
  mp3: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'],
  m4a: ['-vn', '-c:a', 'aac', '-b:a', '192k'],
  wav: ['-vn', '-c:a', 'pcm_s16le'],
} as const
type OutputFormat = keyof typeof outputArguments

export const convertMedia: RequestHandler = async (request, response, next) => {
  if (!request.file) { response.status(400).json({ success: false, error: { message: 'Please upload an audio or video file' } }); return }
  let directory: string | undefined
  const cleanup = async () => Promise.all([
    rm(request.file?.path ?? '', { force: true }).catch(() => undefined),
    directory ? rm(directory, { recursive: true, force: true }).catch(() => undefined) : undefined,
  ])
  try {
    const format = String(request.body.format ?? '') as OutputFormat
    if (!(format in outputArguments)) { response.status(400).json({ success: false, error: { message: 'Output format must be MP4, WebM, MP3, M4A, or WAV' } }); await cleanup(); return }
    if (request.file.mimetype.startsWith('audio/') && (format === 'mp4' || format === 'webm')) {
      response.status(400).json({ success: false, error: { message: 'Audio files can only be converted to audio formats' } }); await cleanup(); return
    }
    directory = await mkdtemp(join(tmpdir(), 'fileflow-media-convert-'))
    const outputPath = join(directory, `converted.${format}`)
    await runFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', request.file.path, ...outputArguments[format], '-map_metadata', '-1', '-y', outputPath], {
      timeout: 60 * 60 * 1000,
      maxBuffer: 8 * 1024 * 1024,
    })
    await rm(request.file.path, { force: true })
    const originalExtension = extname(request.file.originalname)
    const baseName = basename(request.file.originalname, originalExtension).replace(/[^a-zA-Z0-9_-]/g, '-') || 'media'
    response.download(outputPath, `${baseName}.${format}`, async (error) => {
      await cleanup()
      if (error && !response.headersSent) next(error)
    })
  } catch (error) { await cleanup(); next(error) }
}
