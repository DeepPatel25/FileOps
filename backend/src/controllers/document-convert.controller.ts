import type { RequestHandler } from 'express'
import { Document, Packer, Paragraph } from 'docx'
import { PDFParse } from 'pdf-parse'
import { env } from '../config/env.js'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export const convertDocument: RequestHandler = async (request, response, next) => {
  let parser: PDFParse | undefined
  try {
    if (!request.file) { response.status(400).json({ success: false, error: { message: 'Please upload a PDF, DOCX, or PPTX file' } }); return }
    const baseName = request.file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'document'
    if (request.file.mimetype === 'application/pdf') {
      parser = new PDFParse({ data: new Uint8Array(request.file.buffer) })
      const extracted = await parser.getText()
      const paragraphs = extracted.text.split(/\n+/).filter(Boolean).map((text) => new Paragraph({ text }))
      const document = new Document({ sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph({ text: '' })] }] })
      const output = await Packer.toBuffer(document)
      response.set({ 'Content-Type': DOCX, 'Content-Disposition': `attachment; filename="${baseName}.docx"`, 'X-Conversion-Mode': 'text-layout' }).send(output)
      return
    }
    if (request.file.mimetype !== DOCX && request.file.mimetype !== PPTX) { response.status(400).json({ success: false, error: { message: 'Only PDF, DOCX, and PPTX files are supported' } }); return }
    const body = new FormData()
    const bytes = new Uint8Array(request.file.buffer.length); bytes.set(request.file.buffer)
    body.append('files', new Blob([bytes]), request.file.originalname)
    const converted = await fetch(`${env.gotenbergUrl}/forms/libreoffice/convert`, { method: 'POST', body, signal: AbortSignal.timeout(120_000) })
    if (!converted.ok) throw new Error(`Document conversion service returned ${converted.status}`)
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${baseName}.pdf"` }).send(Buffer.from(await converted.arrayBuffer()))
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException) { response.status(503).json({ success: false, error: { message: 'Document conversion service is unavailable. Start it with docker compose up -d gotenberg.' } }); return }
    next(error)
  } finally { await parser?.destroy() }
}
