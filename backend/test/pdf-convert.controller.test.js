import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { imagesToPdf, pdfToImages } from '../dist/controllers/pdf-convert.controller.js'

const responseHarness = () => {
  const result = { statusCode: 200, body: undefined, headers: {} }
  return { result, response: { status(code) { result.statusCode = code; return this }, json(value) { result.body = value; return this }, set(headers) { result.headers = headers; return this }, send(value) { result.body = value; return this } } }
}

test('combines images into a sized and oriented PDF', async () => {
  const image = await sharp({ create: { width: 80, height: 120, channels: 3, background: 'white' } }).png().toBuffer()
  const { result, response } = responseHarness(); let error
  await imagesToPdf({ body: { pageSize: 'a4', orientation: 'landscape' }, files: [{ buffer: image, size: image.length, originalname: 'page.png', mimetype: 'image/png' }] }, response, (value) => { error = value })
  if (error) throw error
  const document = await PDFDocument.load(result.body)
  assert.equal(document.getPageCount(), 1)
  assert.ok(document.getPage(0).getWidth() > document.getPage(0).getHeight())
})

test('exports PDF pages as WebP files in a ZIP', async () => {
  const document = await PDFDocument.create(); document.addPage([100, 120]); document.addPage([120, 100])
  const buffer = Buffer.from(await document.save()); const { result, response } = responseHarness(); let error
  await pdfToImages({ body: { format: 'webp', dpi: '72' }, file: { buffer, size: buffer.length, originalname: 'two.pdf', mimetype: 'application/pdf' } }, response, (value) => { error = value })
  if (error) throw error
  const zip = await JSZip.loadAsync(result.body)
  assert.deepEqual(Object.keys(zip.files), ['two-page-1.webp', 'two-page-2.webp'])
})
