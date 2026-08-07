import assert from 'node:assert/strict'
import test from 'node:test'
import { validateFileSignatures } from '../dist/middleware/file-signature.js'

const responseHarness = () => {
  const result = { statusCode: 200, body: undefined }
  return { result, response: { status(code) { result.statusCode = code; return this }, json(value) { result.body = value; return this } } }
}

test('rejects content that does not match the declared MIME type', async () => {
  const { result, response } = responseHarness(); let continued = false
  await validateFileSignatures({ file: { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), mimetype: 'application/pdf', originalname: 'renamed.pdf' } }, response, () => { continued = true })
  assert.equal(continued, false)
  assert.equal(result.statusCode, 400)
  assert.match(result.body.error.message, /does not match/)
})

test('accepts a PDF with a valid signature', async () => {
  const { response } = responseHarness(); let continued = false
  await validateFileSignatures({ file: { buffer: Buffer.from('%PDF-1.7'), mimetype: 'application/pdf', originalname: 'valid.pdf' } }, response, () => { continued = true })
  assert.equal(continued, true)
})
