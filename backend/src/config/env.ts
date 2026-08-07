import 'dotenv/config'

const port = Number(process.env.PORT ?? 4000)
const videoWorkerConcurrency = Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 1)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid port number')
}
if (!Number.isInteger(videoWorkerConcurrency) || videoWorkerConcurrency < 1 || videoWorkerConcurrency > 8) {
  throw new Error('VIDEO_WORKER_CONCURRENCY must be between 1 and 8')
}

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  gotenbergUrl: process.env.GOTENBERG_URL ?? 'http://127.0.0.1:3000',
  videoWorkerConcurrency,
} as const
