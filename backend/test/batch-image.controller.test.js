import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import sharp from 'sharp'
import { processBatchImages } from '../dist/controllers/batch-image.controller.js'

const createFiles = async () => {
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#654fd6' } }).png().toBuffer()
  const jpeg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#e88943' } }).jpeg().toBuffer()
  return [
    { buffer: png, size: png.length, mimetype: 'image/png', originalname: 'first image.png' },
    { buffer: jpeg, size: jpeg.length, mimetype: 'image/jpeg', originalname: 'second.jpg' },
  ]
}

const invoke = async (body) => {
  const result = { statusCode: 200, body: undefined, headers: {} }
  const response = {
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
    set(headers) { result.headers = headers; return this },
    send(value) { result.body = value; return this },
  }
  let forwardedError
  await processBatchImages({ body, files: await createFiles() }, response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  return result
}

test('converts a batch of images into one ZIP', async () => {
  const result = await invoke({ operation: 'convert', format: 'webp', quality: '70' })

  assert.equal(result.statusCode, 200)
  assert.equal(result.headers['Content-Type'], 'application/zip')
  assert.equal(result.headers['X-Processed-Count'], '2')
  const archive = await JSZip.loadAsync(result.body)
  const names = Object.keys(archive.files)
  assert.deepEqual(names, ['01-first-image.webp', '02-second.webp'])
  for (const name of names) {
    const metadata = await sharp(await archive.file(name).async('nodebuffer')).metadata()
    assert.equal(metadata.format, 'webp')
  }
})

test('rejects an unsupported batch operation', async () => {
  const result = await invoke({ operation: 'resize', quality: '75' })
  assert.equal(result.statusCode, 400)
  assert.equal(result.body.error.message, 'Operation must be compress or convert')
})
