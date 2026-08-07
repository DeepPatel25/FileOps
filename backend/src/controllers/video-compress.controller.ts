import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import type { RequestHandler } from 'express'
import { Job, Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { env } from '../config/env.js'

const runFile = promisify(execFile)
const JOB_TTL_SECONDS = 60 * 60
const QUEUE_NAME = 'fileflow-video-compression'
const MAX_CLIENT_JOBS = 2
const ENCODER_THREADS = Math.max(1, Math.floor(availableParallelism() * 0.75))

const qualityProfiles = {
  high: { crf: '20', preset: 'fast', bitrate: '1800k', maxrate: '2400k', bufsize: '3600k', audio: '160k' },
  balanced: { crf: '26', preset: 'veryfast', bitrate: '1200k', maxrate: '1600k', bufsize: '2400k', audio: '128k' },
  small: { crf: '32', preset: 'veryfast', bitrate: '700k', maxrate: '950k', bufsize: '1400k', audio: '96k' },
} as const
const resolutionFilters = {
  original: 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  '1080': 'scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2',
  '720': 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2',
  '480': 'scale=854:480:force_original_aspect_ratio=decrease:force_divisible_by=2',
} as const

type Quality = keyof typeof qualityProfiles
type Resolution = keyof typeof resolutionFilters
type CompressionData = {
  inputPath: string
  outputDirectory: string
  outputPath: string
  downloadName: string
  originalSize: number
  quality: Quality
  resolution: Resolution
  createdAt: number
  clientId: string
  fileName: string
}
type CompressionResult = { compressedSize: number; reductionPercent: number; encoder: 'h264_videotoolbox' | 'libx264' }

const redisUrl = new URL(env.redisUrl)
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: Number(redisUrl.pathname.slice(1) || 0),
  maxRetriesPerRequest: null,
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
}
const activeProcesses = new Map<string, ReturnType<typeof spawn>>()
let cancellationConnection: Redis | undefined
let queue: Queue<CompressionData, CompressionResult> | undefined
let worker: Worker<CompressionData, CompressionResult> | undefined
const getCancellationConnection = () => cancellationConnection ??= new Redis(env.redisUrl, { maxRetriesPerRequest: null })

const videoToolboxAvailable = runFile('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=size=64x64:rate=1',
  '-frames:v', '1', '-an', '-c:v', 'h264_videotoolbox', '-f', 'null', '-',
], { timeout: 10_000 }).then(() => true).catch(() => false)

const cancellationKey = (id: string) => `fileflow:video-cancelled:${id}`
const cleanupFiles = async (data: CompressionData, includeOutput = true) => {
  await Promise.all([
    rm(data.inputPath, { force: true }).catch(() => undefined),
    includeOutput ? rm(data.outputDirectory, { recursive: true, force: true }).catch(() => undefined) : undefined,
  ])
}
const scheduleCompletedCleanup = (data: CompressionData) => {
  const timer = setTimeout(() => void cleanupFiles(data), JOB_TTL_SECONDS * 1000)
  timer.unref()
}
const probeDuration = async (inputPath: string) => {
  const { stdout } = await runFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath])
  const duration = Number(stdout.trim())
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not determine video duration')
  return duration
}

const processCompression = async (job: Job<CompressionData, CompressionResult>) => {
  const cancelled = async () => Boolean(await getCancellationConnection().get(cancellationKey(job.id ?? '')))
  const { data } = job
  try {
    if (await cancelled()) throw new Error('Compression cancelled')
    const duration = await probeDuration(data.inputPath)
    if (await cancelled()) throw new Error('Compression cancelled')
    const profile = qualityProfiles[data.quality]
    const encoder: CompressionResult['encoder'] = await videoToolboxAvailable ? 'h264_videotoolbox' : 'libx264'
    const encoderArguments = encoder === 'h264_videotoolbox'
      ? ['-c:v', encoder, '-b:v', profile.bitrate, '-maxrate', profile.maxrate, '-bufsize', profile.bufsize, '-allow_sw', '1']
      : ['-c:v', encoder, '-preset', profile.preset, '-crf', profile.crf, '-threads', String(ENCODER_THREADS)]
    const process = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-i', data.inputPath, '-map', '0:v:0', '-map', '0:a?',
      '-vf', resolutionFilters[data.resolution], ...encoderArguments, '-filter_threads', String(ENCODER_THREADS),
      '-c:a', 'aac', '-b:a', profile.audio, '-movflags', '+faststart', '-map_metadata', '-1',
      '-progress', 'pipe:1', '-nostats', '-y', data.outputPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    activeProcesses.set(job.id ?? '', process)
    let progressBuffer = ''; let errorOutput = ''
    process.stdout.setEncoding('utf8'); process.stderr.setEncoding('utf8')
    process.stderr.on('data', (chunk: string) => { errorOutput = (errorOutput + chunk).slice(-8000) })
    process.stdout.on('data', (chunk: string) => {
      progressBuffer += chunk; const lines = progressBuffer.split(/\r?\n/); progressBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const [key, value] = line.split('=', 2)
        if (key === 'out_time_us' || key === 'out_time_ms') {
          const seconds = Number(value) / 1_000_000
          if (Number.isFinite(seconds)) void job.updateProgress(Math.min(99, Math.floor(seconds / duration * 100)))
        }
      }
    })
    const exitCode = await new Promise<number | null>((resolve, reject) => { process.once('error', reject); process.once('close', resolve) })
    activeProcesses.delete(job.id ?? '')
    if (await cancelled()) throw new Error('Compression cancelled')
    if (exitCode !== 0) throw new Error(errorOutput.trim() || `FFmpeg exited with code ${exitCode}`)
    const compressedSize = (await stat(data.outputPath)).size
    await rm(data.inputPath, { force: true })
    return { compressedSize, reductionPercent: Math.round((1 - compressedSize / data.originalSize) * 100), encoder }
  } catch (error) {
    activeProcesses.delete(job.id ?? '')
    await cleanupFiles(data)
    throw error
  }
}

const ensureQueue = () => {
  if (!queue) queue = new Queue<CompressionData, CompressionResult>(QUEUE_NAME, { connection, defaultJobOptions: { attempts: 1, removeOnComplete: { age: JOB_TTL_SECONDS }, removeOnFail: { age: JOB_TTL_SECONDS } } })
  if (!worker) {
    worker = new Worker<CompressionData, CompressionResult>(QUEUE_NAME, processCompression, { connection, concurrency: env.videoWorkerConcurrency })
    worker.on('completed', (job) => scheduleCompletedCleanup(job.data))
    worker.on('error', (error) => console.error('Video queue worker error', error))
  }
  return queue
}

const getCancellation = async (id: string) => Boolean(await getCancellationConnection().get(cancellationKey(id)))
const mapState = (state: string) => state === 'active' ? 'processing' : state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : 'queued'

export const createCompressionJob: RequestHandler = async (request, response, next) => {
  if (!request.file) { response.status(400).json({ success: false, error: { message: 'Please upload a video file' } }); return }
  let outputDirectory: string | undefined
  try {
    const quality = String(request.body.quality ?? 'balanced') as Quality
    const resolution = String(request.body.resolution ?? 'original') as Resolution
    const clientId = String(request.body.clientId ?? '')
    if (!qualityProfiles[quality] || !resolutionFilters[resolution]) {
      await rm(request.file.path, { force: true }); response.status(400).json({ success: false, error: { message: 'Invalid quality or resolution option' } }); return
    }
    if (!/^[a-f0-9-]{36}$/i.test(clientId)) {
      await rm(request.file.path, { force: true }); response.status(400).json({ success: false, error: { message: 'A valid client ID is required' } }); return
    }
    const pending = await ensureQueue().getJobs(['waiting', 'active', 'delayed', 'prioritized'], 0, 99, true)
    if (pending.filter((job) => job.data.clientId === clientId).length >= MAX_CLIENT_JOBS) {
      await rm(request.file.path, { force: true }); response.status(429).json({ success: false, error: { message: `You can run or queue up to ${MAX_CLIENT_JOBS} video jobs at once` } }); return
    }
    outputDirectory = await mkdtemp(join(tmpdir(), 'fileflow-video-compress-'))
    const originalExtension = extname(request.file.originalname)
    const baseName = basename(request.file.originalname, originalExtension).replace(/[^a-zA-Z0-9_-]/g, '-') || 'video'
    const id = randomUUID()
    const data: CompressionData = { inputPath: request.file.path, outputDirectory, outputPath: join(outputDirectory, 'compressed.mp4'), downloadName: `${baseName}-compressed.mp4`, originalSize: request.file.size, quality, resolution, createdAt: Date.now(), clientId, fileName: request.file.originalname }
    await ensureQueue().add('compress', data, { jobId: id })
    response.status(202).json({ success: true, jobId: id, statusUrl: `/api/v1/video-compress/jobs/${id}`, encoderThreads: ENCODER_THREADS })
  } catch (error) {
    await Promise.all([rm(request.file.path, { force: true }).catch(() => undefined), outputDirectory ? rm(outputDirectory, { recursive: true, force: true }).catch(() => undefined) : undefined]); next(error)
  }
}

const readClientId = (request: Parameters<RequestHandler>[0]) => typeof request.query.clientId === 'string' ? request.query.clientId : ''

export const listCompressionJobs: RequestHandler = async (request, response, next) => {
  try {
    const clientId = readClientId(request)
    if (!/^[a-f0-9-]{36}$/i.test(clientId)) { response.status(400).json({ success: false, error: { message: 'A valid client ID is required' } }); return }
    const jobs = await ensureQueue().getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'prioritized'], 0, 49, true)
    const history = await Promise.all(jobs.filter((job) => job.data.clientId === clientId).map(async (job) => {
      const state = await job.getState(); const cancelled = await getCancellation(job.id ?? '')
      return { id: job.id, fileName: job.data.fileName, status: cancelled ? 'cancelled' : mapState(state), progress: typeof job.progress === 'number' ? job.progress : 0, originalSize: job.data.originalSize, compressedSize: job.returnvalue?.compressedSize, reductionPercent: job.returnvalue?.reductionPercent, createdAt: new Date(job.data.createdAt).toISOString(), expiresAt: new Date((job.finishedOn ?? job.timestamp) + JOB_TTL_SECONDS * 1000).toISOString(), downloadUrl: state === 'completed' ? `/api/v1/video-compress/jobs/${job.id}/download` : undefined }
    }))
    response.json({ success: true, data: history.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
  } catch (error) { next(error) }
}

export const removeCompressionHistory: RequestHandler = async (request, response, next) => {
  try {
    const clientId = readClientId(request); const id = String(request.params.id); const job = await ensureQueue().getJob(id)
    if (!job || job.data.clientId !== clientId) { response.status(404).json({ success: false, error: { message: 'Compression history item was not found' } }); return }
    const state = await job.getState()
    if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') { response.status(409).json({ success: false, error: { message: 'Cancel this job before removing it' } }); return }
    await cleanupFiles(job.data); await job.remove(); await getCancellationConnection().del(cancellationKey(id)); response.status(204).send()
  } catch (error) { next(error) }
}

export const clearCompressionHistory: RequestHandler = async (request, response, next) => {
  try {
    const clientId = readClientId(request)
    if (!/^[a-f0-9-]{36}$/i.test(clientId)) { response.status(400).json({ success: false, error: { message: 'A valid client ID is required' } }); return }
    const jobs = await ensureQueue().getJobs(['completed', 'failed'], 0, 99, true); let removed = 0
    for (const job of jobs) if (job.data.clientId === clientId) { await cleanupFiles(job.data); await getCancellationConnection().del(cancellationKey(job.id ?? '')); await job.remove(); removed += 1 }
    response.json({ success: true, removed })
  } catch (error) { next(error) }
}

export const getCompressionJob: RequestHandler = async (request, response, next) => {
  try {
    const id = String(request.params.id)
    if (await getCancellation(id)) { response.json({ success: true, status: 'cancelled', progress: 0 }); return }
    const job = await ensureQueue().getJob(id)
    if (!job) { response.status(404).json({ success: false, error: { message: 'Compression job was not found or has expired' } }); return }
    const state = await job.getState(); const result = job.returnvalue
    response.json({ success: true, status: mapState(state), progress: typeof job.progress === 'number' ? job.progress : 0, originalSize: job.data.originalSize, compressedSize: result?.compressedSize, reductionPercent: result?.reductionPercent, encoder: result?.encoder, error: state === 'failed' ? job.failedReason : undefined, downloadUrl: state === 'completed' ? `/api/v1/video-compress/jobs/${id}/download` : undefined, expiresAt: new Date((job.finishedOn ?? job.timestamp) + JOB_TTL_SECONDS * 1000).toISOString() })
  } catch (error) { next(error) }
}

export const cancelCompressionJob: RequestHandler = async (request, response, next) => {
  try {
    const id = String(request.params.id); const job = await ensureQueue().getJob(id)
    if (!job) { response.status(404).json({ success: false, error: { message: 'Compression job was not found or has expired' } }); return }
    const state = await job.getState()
    if (state !== 'waiting' && state !== 'delayed' && state !== 'prioritized' && state !== 'active') { response.status(409).json({ success: false, error: { message: `A ${mapState(state)} job cannot be cancelled` } }); return }
    await getCancellationConnection().set(cancellationKey(id), '1', 'EX', JOB_TTL_SECONDS)
    activeProcesses.get(id)?.kill('SIGTERM')
    if (state !== 'active') { await cleanupFiles(job.data); await job.remove() }
    response.json({ success: true, status: 'cancelled' })
  } catch (error) { next(error) }
}

export const downloadCompressedVideo: RequestHandler = async (request, response, next) => {
  try {
    const job = await ensureQueue().getJob(String(request.params.id))
    if (!job || await job.getState() !== 'completed' || !job.returnvalue?.compressedSize) { response.status(job ? 409 : 404).json({ success: false, error: { message: job ? 'Compressed video is not ready' : 'Compression job was not found or has expired' } }); return }
    response.download(job.data.outputPath, job.data.downloadName, (error) => { if (error && !response.headersSent) next(error) })
  } catch (error) { next(error) }
}

export const closeVideoQueue = async () => {
  await worker?.close(); await queue?.close(); await cancellationConnection?.quit(); worker = undefined; queue = undefined; cancellationConnection = undefined
}

export const getVideoQueueHealth = async () => ({
  redis: await getCancellationConnection().ping(),
  counts: await ensureQueue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
  concurrency: env.videoWorkerConcurrency,
})
