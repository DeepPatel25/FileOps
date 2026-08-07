import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import sharp from 'sharp'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { app } from '../dist/app.js'

test('processes concurrent disk-backed image batches without excessive retained memory', async () => {
  const input = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#7159d9' } }).png().toBuffer()
  const before = process.memoryUsage().rss
  const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => request(app)
    .post('/api/v1/batch-images')
    .field('operation', 'convert')
    .field('format', 'webp')
    .field('quality', '70')
    .attach('files', input, { filename: `image-${index}.png`, contentType: 'image/png' })))
  responses.forEach((response) => {
    assert.equal(response.status, 200)
    assert.equal(response.headers['content-type'], 'application/zip')
    assert.equal(response.headers['x-processed-count'], '1')
  })
  if (global.gc) global.gc()
  const retainedGrowth = process.memoryUsage().rss - before
  assert.ok(retainedGrowth < 256 * 1024 * 1024, `retained RSS grew by ${Math.round(retainedGrowth / 1024 / 1024)} MB`)
})

test('streams an already-efficient PDF from disk without enlarging it', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage(); const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Efficient vector PDF', { x: 60, y: 700, font })
  const input = Buffer.from(await pdf.save())
  const response = await request(app).post('/api/v1/pdf-compress').field('preset', 'balanced').attach('file', input, { filename: 'efficient.pdf', contentType: 'application/pdf' })
  assert.equal(response.status, 200)
  assert.equal(response.headers['content-type'], 'application/pdf')
  assert.equal(response.headers['x-compression-applied'], 'false')
  assert.equal(response.body.subarray(0, 5).toString(), '%PDF-')
  assert.equal(response.body.length, input.length)
})
