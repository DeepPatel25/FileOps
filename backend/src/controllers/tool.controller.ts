import type { RequestHandler } from 'express'
import type { Tool } from '../types/tool.js'

const tools: Tool[] = [
  { id: 'convert', title: 'Convert files', description: 'Change files to the format you need.', category: 'Convert', formats: ['PDF', 'DOCX', 'JPG', 'PNG'], popular: true },
  { id: 'compress', title: 'Compress files', description: 'Reduce file size while retaining quality.', category: 'Optimize', formats: ['PDF', 'JPG', 'PNG', 'ZIP'], popular: true },
  { id: 'pdf-compress', title: 'Compress PDF', description: 'Reduce scanned and image-heavy PDF file sizes.', category: 'Optimize', formats: ['PDF'], popular: true },
  { id: 'pdf-organize', title: 'Organize PDF pages', description: 'Reorder, rotate, or remove PDF pages visually.', category: 'Organize', formats: ['PDF'], popular: true },
  { id: 'batch-images', title: 'Batch images', description: 'Convert or compress several images in one job.', category: 'Optimize', formats: ['JPG', 'PNG', 'WebP', 'ZIP'], popular: true },
  { id: 'merge', title: 'Merge files', description: 'Combine files into one organized document.', category: 'Organize', formats: ['PDF', 'DOCX', 'JPG', 'PNG'], popular: false },
  { id: 'split', title: 'Split PDF', description: 'Separate or extract selected PDF pages.', category: 'Organize', formats: ['PDF'], popular: false },
  { id: 'protect', title: 'Protect PDF', description: 'Password-protect confidential PDF documents.', category: 'Secure', formats: ['PDF'], popular: false },
  { id: 'extract', title: 'Extract content', description: 'Extract text, images, or pages from documents.', category: 'Convert', formats: ['PDF', 'DOCX', 'PPTX'], popular: false },
]

export const listTools: RequestHandler = (request, response) => {
  const category = typeof request.query.category === 'string' ? request.query.category.toLowerCase() : undefined
  const query = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase() : undefined

  const result = tools.filter((tool) => {
    const matchesCategory = !category || tool.category.toLowerCase() === category
    const matchesQuery = !query || `${tool.title} ${tool.description}`.toLowerCase().includes(query)
    return matchesCategory && matchesQuery
  })

  response.json({ success: true, data: result, count: result.length })
}

export const getTool: RequestHandler<{ id: string }> = (request, response) => {
  const tool = tools.find((item) => item.id === request.params.id)

  if (!tool) {
    response.status(404).json({ success: false, error: { message: 'Tool not found' } })
    return
  }

  response.json({ success: true, data: tool })
}
