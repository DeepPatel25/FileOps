import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../dist/app.js'
import { closeVideoQueue } from '../dist/controllers/video-compress.controller.js'

after(async () => { await closeVideoQueue() })

test('reports dependency, memory, disk, Redis, and Gotenberg health', async () => {
  const response = await request(app).get('/api/v1/health').expect(200)
  assert.equal(response.body.data.dependencies.redis, 'available')
  assert.equal(response.body.data.dependencies.ffmpeg, 'available')
  assert.equal(response.body.data.dependencies.ffprobe, 'available')
  assert.equal(response.body.data.dependencies.poppler, 'available')
  assert.equal(response.body.data.dependencies.gotenberg, 'available')
  assert.ok(response.body.data.memory.rssBytes > 0)
  assert.ok(response.body.data.temporaryDisk.freeBytes > 0)
  assert.equal(typeof response.body.data.videoQueue.counts.waiting, 'number')
})

test('rejects an uploaded file whose content does not match its MIME type', async () => {
  const fakePdf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const response = await request(app).post('/api/v1/pdf-compress').attach('file', fakePdf, { filename: 'renamed.pdf', contentType: 'application/pdf' }).expect(400)
  assert.match(response.body.error.message, /does not match/)
})

test('rate limits excessive API requests from one client', async () => {
  let response
  for (let index = 0; index < 301; index += 1) response = await request(app).get('/api/v1/not-a-route')
  assert.equal(response.status, 429)
  assert.match(response.body.error.message, /Too many requests/)
})
