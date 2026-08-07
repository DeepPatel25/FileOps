import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt'
import { compressPdf } from '../dist/controllers/pdf-compress.controller.js'

const createPdf = async () => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([300, 400])
  page.drawText('PDF compression regression check', { x: 30, y: 350, size: 16, font })
  return Buffer.from(await document.save())
}

const invoke = async (body, file) => {
  const result = { statusCode: 200, body: undefined, headers: {} }
  const response = {
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
    set(headers) { result.headers = headers; return this },
    send(value) { result.body = value; return this },
  }
  let forwardedError
  await compressPdf({ body, file }, response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  return result
}

test('rejects an unsupported PDF compression preset', async () => {
  const buffer = await createPdf()
  const result = await invoke({ preset: 'extreme' }, {
    buffer, size: buffer.length, mimetype: 'application/pdf', originalname: 'sample.pdf',
  })

  assert.equal(result.statusCode, 400)
  assert.equal(result.body.error.message, 'Preset must be high, balanced, or small')
})

test('compresses a PDF and reports output metadata', async () => {
  const buffer = await createPdf()
  const result = await invoke({ preset: 'balanced' }, {
    buffer, size: buffer.length, mimetype: 'application/pdf', originalname: 'sample.pdf',
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.headers['Content-Type'], 'application/pdf')
  assert.equal(result.headers['X-Page-Count'], '1')
  assert.ok(Buffer.isBuffer(result.body))
  assert.equal(result.body.subarray(0, 4).toString(), '%PDF')
  assert.ok(result.body.length <= buffer.length, 'compression must never return a larger PDF')
  assert.equal(result.headers['X-Compression-Applied'], 'false')
})

test('requests a password for encrypted PDFs and accepts the correct password', async () => {
  const source = await createPdf()
  const buffer = Buffer.from(await encryptPDF(new Uint8Array(source), 'secret123', {
    algorithm: 'AES-256',
    ownerPassword: 'owner-secret-123',
  }))
  const file = { buffer, size: buffer.length, mimetype: 'application/pdf', originalname: 'protected.pdf' }

  const unauthorized = await invoke({ preset: 'small' }, file)
  assert.equal(unauthorized.statusCode, 401)
  assert.match(unauthorized.body.error.message, /password-protected/)

  const result = await invoke({ preset: 'small', password: 'secret123' }, file)
  assert.equal(result.statusCode, 200)
  assert.equal(result.headers['X-Page-Count'], '1')
  assert.equal(result.body.subarray(0, 4).toString(), '%PDF')
})
