import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import test from 'node:test'
import { cancelCompressionJob, closeVideoQueue, createCompressionJob, getCompressionJob, listCompressionJobs } from '../dist/controllers/video-compress.controller.js'

const runFile = promisify(execFile)
const jsonResponse = () => {
  const result = { statusCode: 200, body: undefined }
  return { result, response: { status(code) { result.statusCode = code; return this }, json(value) { result.body = value; return this } } }
}

test('cancels an active video compression job', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fileflow-cancel-test-'))
  const inputPath = join(directory, 'input.mp4')
  await runFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=2', '-pix_fmt', 'yuv420p', '-y', inputPath])
  const created = jsonResponse(); let forwardedError
  await createCompressionJob({ body: { quality: 'small', resolution: '480', clientId: '11111111-1111-4111-8111-111111111111' }, file: { path: inputPath, size: 1000, originalname: 'input.mp4' } }, created.response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  const jobId = created.result.body.jobId
  const history = jsonResponse()
  await listCompressionJobs({ query: { clientId: '11111111-1111-4111-8111-111111111111' } }, history.response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  assert.ok(history.result.body.data.some((item) => item.id === jobId))

  const cancelled = jsonResponse()
  await cancelCompressionJob({ params: { id: jobId } }, cancelled.response)
  assert.equal(cancelled.result.statusCode, 200)
  assert.equal(cancelled.result.body.status, 'cancelled')

  await closeVideoQueue()
  const status = jsonResponse()
  await getCompressionJob({ params: { id: jobId } }, status.response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  assert.equal(status.result.body.status, 'cancelled')
  await closeVideoQueue()
  await rm(directory, { recursive: true, force: true })
})
