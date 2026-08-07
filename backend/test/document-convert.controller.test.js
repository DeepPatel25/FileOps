import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Document, Packer, Paragraph } from 'docx'
import JSZip from 'jszip'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { convertDocument } from '../dist/controllers/document-convert.controller.js'

const invoke = (file) => new Promise((resolve, reject) => {
  const headers = {}
  const response = {
    set(values) { Object.assign(headers, values); return this },
    status(code) { this.statusCode = code; return this },
    send(body) { resolve({ body, headers, statusCode: this.statusCode ?? 200 }) },
    json(body) { resolve({ body, headers, statusCode: this.statusCode ?? 200 }) },
  }
  void convertDocument({ file }, response, reject)
})

test('converts PDF text into an editable DOCX', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage(); const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Editable FileFlow document', { x: 50, y: 700, font, size: 18 })
  const result = await invoke({ buffer: Buffer.from(await pdf.save()), mimetype: 'application/pdf', originalname: 'sample.pdf' })
  assert.equal(result.statusCode, 200); assert.equal(result.headers['X-Conversion-Mode'], 'text-layout')
  const archive = await JSZip.loadAsync(result.body); const xml = await archive.file('word/document.xml').async('string')
  assert.match(xml, /Editable FileFlow document/)
})

test('converts DOCX into a PDF through the Docker document service', async () => {
  const document = new Document({ sections: [{ children: [new Paragraph('FileFlow Office conversion')] }] })
  const result = await invoke({ buffer: await Packer.toBuffer(document), mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalname: 'sample.docx' })
  assert.equal(result.statusCode, 200); assert.equal(result.headers['Content-Type'], 'application/pdf')
  assert.equal(result.body.subarray(0, 5).toString(), '%PDF-')
})
