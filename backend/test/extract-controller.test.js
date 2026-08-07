import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { extractContent } from '../dist/controllers/extract.controller.js'

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const createResponse = () => {
  const result = { statusCode: 200, body: undefined }
  return {
    result,
    response: {
      status(code) {
        result.statusCode = code
        return this
      },
      json(body) {
        result.body = body
        return this
      },
    },
  }
}

const invoke = async (request) => {
  const { result, response } = createResponse()
  let forwardedError
  await extractContent(request, response, (error) => {
    forwardedError = error
  })
  if (forwardedError) throw forwardedError
  return result
}

const createDocx = async (text) => {
  const archive = new JSZip()
  archive.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`)
  archive.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`)
  archive.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
    </w:document>`)
  return archive.generateAsync({ type: 'nodebuffer' })
}

test('extracts text from a DOCX upload', async () => {
  const buffer = await createDocx('Regression check')
  const result = await invoke({
    body: { mode: 'text' },
    file: { buffer, mimetype: DOCX_MIME_TYPE, originalname: 'sample.docx' },
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.success, true)
  assert.equal(result.body.data.text, 'Regression check')
  assert.equal(result.body.data.words, 2)
})

test('rejects unsupported extraction modes', async () => {
  const result = await invoke({
    body: { mode: 'unknown' },
    file: { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf', originalname: 'sample.pdf' },
  })

  assert.equal(result.statusCode, 400)
  assert.deepEqual(result.body, {
    success: false,
    error: { message: 'Mode must be text, images, or pages' },
  })
})
