import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { recognizeText } from '../dist/controllers/ocr.controller.js'

const invoke = async (file) => {
  const result = { statusCode: 200, body: undefined }
  const response = {
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
  }
  let forwardedError
  await recognizeText({ file }, response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  return result
}

test('recognizes clear English text in an image', async () => {
  const buffer = await sharp(Buffer.from(`<svg width="900" height="220" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="40" y="140" font-family="Arial" font-size="80" fill="black">HELLO FILEFLOW</text>
  </svg>`)).png().toBuffer()
  const result = await invoke({ buffer, size: buffer.length, mimetype: 'image/png', originalname: 'scan.png' })

  assert.equal(result.statusCode, 200)
  assert.match(result.body.data.text, /HELLO FILEFLOW/i)
  assert.equal(result.body.data.pageCount, 1)
  assert.equal(result.body.data.language, 'eng')
})

test('requires an OCR input file', async () => {
  const result = await invoke(undefined)
  assert.equal(result.statusCode, 400)
  assert.equal(result.body.error.message, 'Please upload a PDF or image file')
})
