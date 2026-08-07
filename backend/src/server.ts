import { app } from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.port, () => {
  console.log(`FileFlow API running at http://localhost:${env.port}`)
})

// Large video uploads can exceed Node's default request timeout. Compression
// continues as a background job after the upload request receives a job ID.
server.requestTimeout = 0
server.timeout = 0
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000

const shutdown = (signal: string) => {
  console.log(`${signal} received, closing server`)
  server.close(() => process.exit(0))
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
