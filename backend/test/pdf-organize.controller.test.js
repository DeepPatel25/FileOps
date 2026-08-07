import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { organizePdfPages } from '../dist/controllers/pdf-organize.controller.js'

const createPdf = async () => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let number = 1; number <= 3; number += 1) {
    const page = document.addPage([200 + number, 300 + number])
    page.drawText(`Page ${number}`, { x: 20, y: 250, size: 14, font })
  }
  return Buffer.from(await document.save())
}

const invoke = async (operations) => {
  const buffer = await createPdf()
  const result = { statusCode: 200, body: undefined, headers: {} }
  const response = {
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
    set(headers) { result.headers = headers; return this },
    send(value) { result.body = value; return this },
  }
  let forwardedError
  await organizePdfPages({
    body: { operations: JSON.stringify(operations) },
    file: { buffer, size: buffer.length, mimetype: 'application/pdf', originalname: 'pages.pdf' },
  }, response, (error) => { forwardedError = error })
  if (forwardedError) throw forwardedError
  return result
}

test('reorders, rotates, and removes PDF pages', async () => {
  const result = await invoke([{ page: 3, rotation: 90 }, { page: 1, rotation: 0 }])

  assert.equal(result.statusCode, 200)
  assert.equal(result.headers['X-Page-Count'], '2')
  const output = await PDFDocument.load(result.body)
  assert.equal(output.getPageCount(), 2)
  assert.equal(output.getPage(0).getRotation().angle, 90)
  assert.equal(output.getPage(0).getWidth(), 203)
  assert.equal(output.getPage(1).getWidth(), 201)
})

test('duplicates pages when an operation references a page more than once', async () => {
  const result = await invoke([{ page: 1, rotation: 0 }, { page: 1, rotation: 90 }])
  assert.equal(result.statusCode, 200)
  const output = await PDFDocument.load(result.body)
  assert.equal(output.getPageCount(), 2)
  assert.equal(output.getPage(1).getRotation().angle, 90)
})
