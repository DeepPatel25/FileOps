import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, createTimeline, stagger } from 'animejs'
import './App.css'

type IconName = 'convert' | 'compress' | 'merge' | 'split' | 'protect' | 'extract' | 'video' | 'search' | 'arrow' | 'sparkles' | 'check' | 'upload'

const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => {
  const paths: Record<IconName, React.ReactNode> = {
    convert: <><path d="M7 7h10l-3-3"/><path d="m17 7-3 3"/><path d="M17 17H7l3 3"/><path d="m7 17 3-3"/></>,
    compress: <><path d="m8 3-5 5"/><path d="M3 4v4h4"/><path d="m16 3 5 5"/><path d="M21 4v4h-4"/><path d="m8 21-5-5"/><path d="M3 20v-4h4"/><path d="m16 21 5-5"/><path d="M21 20v-4h-4"/></>,
    merge: <><path d="M8 4v3a5 5 0 0 0 5 5h7"/><path d="m17 9 3 3-3 3"/><path d="M8 20v-3a5 5 0 0 1 5-5"/><circle cx="5" cy="4" r="2"/><circle cx="5" cy="20" r="2"/></>,
    split: <><path d="M4 12h6a5 5 0 0 1 5 5v3"/><path d="M4 12h6a5 5 0 0 0 5-5V4"/><path d="m12 7 3-3 3 3"/><path d="m12 17 3 3 3-3"/></>,
    protect: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
    extract: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="m12 12 3 3-3 3"/></>,
    video: <><rect x="3" y="5" width="15" height="14" rx="2"/><path d="m18 10 4-2v8l-4-2"/><path d="m9 9 5 3-5 3Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    sparkles: <><path d="m12 3-1.2 3.2a3 3 0 0 1-1.8 1.8L6 9l3 1a3 3 0 0 1 1.8 1.8L12 15l1.2-3.2a3 3 0 0 1 1.8-1.8l3-1-3-1a3 3 0 0 1-1.8-1.8Z"/><path d="M5 17v4M3 19h4M19 15v4M17 17h4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const features = [
  { id: 'convert', title: 'Convert images', description: 'Convert images between PNG, JPEG, and WebP in a few clicks.', icon: 'convert' as IconName, category: 'Convert', color: 'violet', formats: 'PNG, JPEG, WebP', popular: true },
  { id: 'compress', title: 'Compress images', description: 'Reduce image size while keeping the quality you care about.', icon: 'compress' as IconName, category: 'Optimize', color: 'orange', formats: 'PNG, JPEG, WebP', popular: true },
  { id: 'pdf-compress', title: 'Compress PDF', description: 'Shrink scanned and image-heavy PDFs with quality presets.', icon: 'compress' as IconName, category: 'Optimize', color: 'amber', formats: 'PDF documents', popular: true },
  { id: 'pdf-organize', title: 'Organize PDF pages', description: 'Reorder, rotate, and remove pages with visual previews.', icon: 'merge' as IconName, category: 'Organize', color: 'blue', formats: 'PDF documents', popular: true },
  { id: 'batch-images', title: 'Batch images', description: 'Convert or compress up to 10 images and download one ZIP.', icon: 'compress' as IconName, category: 'Optimize', color: 'violet', formats: 'PNG, JPEG, WebP, ZIP', popular: true },
  { id: 'ocr', title: 'OCR text recognition', description: 'Read English text from scanned PDFs and images.', icon: 'extract' as IconName, category: 'Convert', color: 'cyan', formats: 'PDF, PNG, JPEG, WebP', popular: true },
  { id: 'merge', title: 'Merge files', description: 'Combine PDFs and images into one organized PDF.', icon: 'merge' as IconName, category: 'Organize', color: 'blue', formats: 'PDF, PNG, JPEG, WebP', popular: false },
  { id: 'split', title: 'Split PDF', description: 'Separate selected pages or extract every page in seconds.', icon: 'split' as IconName, category: 'Organize', color: 'pink', formats: 'PDF documents', popular: false },
  { id: 'protect', title: 'Protect PDF', description: 'Add a password and keep confidential documents secure.', icon: 'protect' as IconName, category: 'Secure', color: 'green', formats: 'PDF documents', popular: false },
  { id: 'extract', title: 'Extract content', description: 'Pull text, images, or pages from your documents quickly.', icon: 'extract' as IconName, category: 'Convert', color: 'cyan', formats: 'PDF, DOCX, PPTX', popular: false },
  { id: 'video-split', title: 'Split video', description: 'Divide large videos into upload-friendly file sizes.', icon: 'video' as IconName, category: 'Organize', color: 'red', formats: 'MP4, MOV, MKV, WebM', popular: true },
  { id: 'video-compress', title: 'Compress video', description: 'Shrink video files with smart quality and resolution controls.', icon: 'video' as IconName, category: 'Optimize', color: 'amber', formats: 'MP4, MOV, MKV, WebM', popular: true },
]

type Feature = typeof features[number]
type ExtractedContent = { text: string; words: number; characters: number; pages?: number; fileName: string }
type CompressionJob = { status: 'queued' | 'processing' | 'completed' | 'failed'; progress: number; originalSize: number; compressedSize?: number; reductionPercent?: number; encoder?: 'h264_videotoolbox' | 'libx264'; error?: string; downloadUrl?: string }
type OrganizerPage = { page: number; thumbnail: string; rotation: number }
type OcrResult = { text: string; pageCount: number; words: number; characters: number; averageConfidence: number; fileName: string }
const categories = ['All tools', 'Convert', 'Optimize', 'Organize', 'Secure']

function Header({ onHome }: { onHome: () => void }) {
  return <header className="site-header">
    <button className="brand" onClick={onHome} aria-label="FileFlow home">
      <span className="brand-mark"><span /><span /><span /></span>
      <span>File<span>Flow</span></span>
    </button>
    <nav aria-label="Main navigation">
      <button onClick={onHome}>Tools</button><a href="#how-it-works">How it works</a><a href="#security">Security</a>
    </nav>
    <div className="header-actions"><button className="text-button">Sign in</button><button className="primary small" onClick={onHome}>Get started <Icon name="arrow" size={16}/></button></div>
  </header>
}

function ToolPage({ feature, onBack }: { feature: Feature; onBack: () => void }) {
  const pageRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState('webp')
  const [quality, setQuality] = useState(75)
  const [compressPdfFile, setCompressPdfFile] = useState<File | null>(null)
  const [pdfCompressionPreset, setPdfCompressionPreset] = useState<'high' | 'balanced' | 'small'>('balanced')
  const [pdfCompressionPassword, setPdfCompressionPassword] = useState('')
  const [organizerFile, setOrganizerFile] = useState<File | null>(null)
  const [organizerPages, setOrganizerPages] = useState<OrganizerPage[]>([])
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchOperation, setBatchOperation] = useState<'compress' | 'convert'>('compress')
  const [batchFormat, setBatchFormat] = useState<'webp' | 'jpeg' | 'png'>('webp')
  const [batchQuality, setBatchQuality] = useState(75)
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [mergeFiles, setMergeFiles] = useState<File[]>([])
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [splitMode, setSplitMode] = useState<'selected' | 'all'>('selected')
  const [pageSelection, setPageSelection] = useState('1')
  const [protectFile, setProtectFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(false)
  const [allowModifying, setAllowModifying] = useState(false)
  const [extractFile, setExtractFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null)
  const [extractMode, setExtractMode] = useState<'text' | 'images' | 'pages'>('text')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [targetSize, setTargetSize] = useState(100)
  const [compressVideoFile, setCompressVideoFile] = useState<File | null>(null)
  const [videoQuality, setVideoQuality] = useState<'high' | 'balanced' | 'small'>('balanced')
  const [videoResolution, setVideoResolution] = useState<'original' | '1080' | '720' | '480'>('original')
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoEncoder, setVideoEncoder] = useState<'h264_videotoolbox' | 'libx264' | null>(null)
  const compressionAbortRef = useRef<AbortController | null>(null)
  const passwordScore = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password) && /\d/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(nextFile.type)) {
      setStatus('error'); setMessage('Please choose a PNG, JPEG, or WebP image.'); return
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setStatus('error'); setMessage('The maximum file size is 20 MB.'); return
    }
    setFile(nextFile); setStatus('idle'); setMessage('')
  }

  const convertFile = async () => {
    if (!file) return
    setStatus('converting'); setMessage('Converting your image…')
    const data = new FormData()
    data.append('file', file)
    data.append('format', format)

    try {
      const response = await fetch('/api/v1/convert', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Conversion failed')
      }
      const blob = await response.blob()
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const extension = format === 'jpeg' ? 'jpg' : format
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${baseName}.${extension}`; link.click()
      URL.revokeObjectURL(url)
      setStatus('success'); setMessage(`Done! ${baseName}.${extension} has been downloaded.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Conversion failed')
    }
  }

  const compressFile = async () => {
    if (!file) return
    setStatus('converting'); setMessage('Compressing your image…')
    const data = new FormData()
    data.append('file', file)
    data.append('quality', String(quality))

    try {
      const response = await fetch('/api/v1/compress', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Compression failed')
      }
      const blob = await response.blob()
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const saved = Math.max(0, Math.round((1 - blob.size / file.size) * 100))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${baseName}-compressed.${extension}`; link.click()
      URL.revokeObjectURL(url)
      setStatus('success'); setMessage(`Done! ${(file.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB${saved ? ` · ${saved}% smaller` : ''}`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Compression failed')
    }
  }

  const selectCompressionPdf = (nextFile?: File) => {
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf') { setStatus('error'); setMessage('Please choose a PDF file.'); return }
    if (nextFile.size > 100 * 1024 * 1024) { setStatus('error'); setMessage('The maximum PDF size is 100 MB.'); return }
    setCompressPdfFile(nextFile); setStatus('idle'); setMessage('')
  }

  const compressSelectedPdf = async () => {
    if (!compressPdfFile) return
    setStatus('converting'); setMessage('Rendering and compressing your PDF…')
    const data = new FormData()
    data.append('file', compressPdfFile)
    data.append('preset', pdfCompressionPreset)
    if (pdfCompressionPassword) data.append('password', pdfCompressionPassword)
    try {
      const response = await fetch('/api/v1/pdf-compress', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'PDF compression failed')
      }
      const blob = await response.blob()
      const baseName = compressPdfFile.name.replace(/\.pdf$/i, '')
      const reduction = Number(response.headers.get('x-reduction-percent'))
      const compressionApplied = response.headers.get('x-compression-applied') !== 'false'
      const pages = response.headers.get('x-page-count')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${baseName}-compressed.pdf`; link.click(); URL.revokeObjectURL(url)
      const sizes = `${(compressPdfFile.size / 1024 / 1024).toFixed(2)} MB → ${(blob.size / 1024 / 1024).toFixed(2)} MB`
      setStatus('success'); setMessage(compressionApplied
        ? `Done! ${sizes}${reduction > 0 ? ` · ${reduction}% smaller` : ''}${pages ? ` · ${pages} pages` : ''}.`
        : `This PDF is already efficiently optimized. The original was downloaded unchanged because recompressing it would make it larger.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'PDF compression failed')
    }
  }

  const selectOrganizerPdf = async (nextFile?: File) => {
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf') { setStatus('error'); setMessage('Please choose a PDF file.'); return }
    if (nextFile.size > 30 * 1024 * 1024) { setStatus('error'); setMessage('The maximum PDF size is 30 MB.'); return }
    setOrganizerFile(nextFile); setOrganizerPages([]); setStatus('converting'); setMessage('Generating page previews…')
    const data = new FormData(); data.append('file', nextFile)
    try {
      const response = await fetch('/api/v1/pdf-organize/preview', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Could not preview PDF pages')
      }
      const body = await response.json() as { data?: { pages: Array<{ page: number; thumbnail: string }> } }
      if (!body.data?.pages.length) throw new Error('No PDF pages were found')
      setOrganizerPages(body.data.pages.map((page) => ({ ...page, rotation: 0 })))
      setStatus('idle'); setMessage('')
    } catch (error) {
      setOrganizerFile(null); setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not preview PDF pages')
    }
  }

  const moveOrganizerPage = (index: number, direction: -1 | 1) => {
    setOrganizerPages((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const pages = [...current]; [pages[index], pages[target]] = [pages[target]!, pages[index]!]
      return pages
    })
  }

  const exportOrganizedPdf = async () => {
    if (!organizerFile || !organizerPages.length) return
    setStatus('converting'); setMessage('Building your organized PDF…')
    const data = new FormData(); data.append('file', organizerFile)
    data.append('operations', JSON.stringify(organizerPages.map(({ page, rotation }) => ({ page, rotation }))))
    try {
      const response = await fetch('/api/v1/pdf-organize', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Could not organize PDF')
      }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = `${organizerFile.name.replace(/\.pdf$/i, '')}-organized.pdf`; link.click(); URL.revokeObjectURL(url)
      setStatus('success'); setMessage(`Done! Your organized PDF contains ${organizerPages.length} ${organizerPages.length === 1 ? 'page' : 'pages'}.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not organize PDF')
    }
  }

  const addBatchFiles = (incoming: File[]) => {
    const supported = incoming.filter((item) => ['image/png', 'image/jpeg', 'image/webp'].includes(item.type) && item.size <= 20 * 1024 * 1024)
    if (supported.length !== incoming.length) { setStatus('error'); setMessage('Some files were skipped. Use PNG, JPEG, or WebP images under 20 MB.') }
    else { setStatus('idle'); setMessage('') }
    setBatchFiles((current) => {
      const known = new Set(current.map((item) => `${item.name}:${item.size}:${item.lastModified}`))
      const unique = supported.filter((item) => !known.has(`${item.name}:${item.size}:${item.lastModified}`))
      return [...current, ...unique].slice(0, 10)
    })
  }

  const processBatch = async () => {
    if (!batchFiles.length) return
    setStatus('converting'); setMessage(`Processing ${batchFiles.length} images…`)
    const data = new FormData(); batchFiles.forEach((item) => data.append('files', item))
    data.append('operation', batchOperation); data.append('format', batchFormat); data.append('quality', String(batchQuality))
    try {
      const response = await fetch('/api/v1/batch-images', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Batch processing failed')
      }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = 'fileflow-batch-images.zip'; link.click(); URL.revokeObjectURL(url)
      const reduction = Number(response.headers.get('x-reduction-percent'))
      setStatus('success'); setMessage(`Done! ${batchFiles.length} images downloaded in one ZIP${batchOperation === 'compress' && reduction > 0 ? ` · ${reduction}% smaller` : ''}.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Batch processing failed')
    }
  }

  const selectOcrFile = (nextFile?: File) => {
    if (!nextFile) return
    const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
    if (!supported.includes(nextFile.type)) { setStatus('error'); setMessage('Please choose a PDF, PNG, JPEG, or WebP file.'); return }
    if (nextFile.size > 25 * 1024 * 1024) { setStatus('error'); setMessage('The maximum OCR file size is 25 MB.'); return }
    setOcrFile(nextFile); setOcrResult(null); setStatus('idle'); setMessage('')
  }

  const runOcr = async () => {
    if (!ocrFile) return
    setStatus('converting'); setMessage('Recognizing text… This may take a moment.')
    const data = new FormData(); data.append('file', ocrFile)
    try {
      const response = await fetch('/api/v1/ocr', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Text recognition failed')
      }
      const body = await response.json() as { data?: OcrResult }
      if (!body.data) throw new Error('Text recognition returned no result')
      setOcrResult(body.data); setStatus('success')
      setMessage(body.data.text ? 'Text recognized successfully.' : 'No readable text was detected. Try a clearer or higher-resolution scan.')
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Text recognition failed')
    }
  }

  const downloadOcrText = () => {
    if (!ocrResult) return
    const url = URL.createObjectURL(new Blob([ocrResult.text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${ocrResult.fileName.replace(/\.[^.]+$/, '')}-ocr.txt`; link.click(); URL.revokeObjectURL(url)
  }

  const addMergeFiles = (incoming: File[]) => {
    const supported = incoming.filter((item) => ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(item.type) && item.size <= 20 * 1024 * 1024)
    if (supported.length !== incoming.length) {
      setStatus('error'); setMessage('Some files were skipped. Use PDF, PNG, JPEG, or WebP files under 20 MB.')
    } else { setStatus('idle'); setMessage('') }
    setMergeFiles((current) => [...current, ...supported].slice(0, 10))
  }

  const moveMergeFile = (index: number, direction: -1 | 1) => {
    setMergeFiles((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const reordered = [...current]
      const item = reordered[index]
      const other = reordered[target]
      if (!item || !other) return current
      reordered[index] = other; reordered[target] = item
      return reordered
    })
  }

  const mergeSelectedFiles = async () => {
    if (mergeFiles.length < 2) return
    setStatus('converting'); setMessage('Building your merged PDF…')
    const data = new FormData()
    mergeFiles.forEach((item) => data.append('files', item))
    try {
      const response = await fetch('/api/v1/merge', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Merge failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'merged-files.pdf'; link.click(); URL.revokeObjectURL(url)
      setStatus('success'); setMessage(`Done! ${mergeFiles.length} files were merged into one PDF.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Merge failed')
    }
  }

  const selectPdf = (nextFile?: File) => {
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf') { setStatus('error'); setMessage('Please choose a PDF file.'); return }
    if (nextFile.size > 30 * 1024 * 1024) { setStatus('error'); setMessage('The maximum PDF size is 30 MB.'); return }
    setPdfFile(nextFile); setStatus('idle'); setMessage('')
  }

  const splitSelectedPdf = async () => {
    if (!pdfFile) return
    setStatus('converting'); setMessage(splitMode === 'all' ? 'Separating every page…' : 'Extracting selected pages…')
    const data = new FormData()
    data.append('file', pdfFile); data.append('mode', splitMode); data.append('pages', pageSelection)
    try {
      const response = await fetch('/api/v1/split', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'PDF split failed')
      }
      const blob = await response.blob()
      const baseName = pdfFile.name.replace(/\.pdf$/i, '')
      const fileName = splitMode === 'all' ? `${baseName}-pages.zip` : `${baseName}-extracted.pdf`
      const pageCount = response.headers.get('x-page-count')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url)
      setStatus('success'); setMessage(`Done! ${pageCount ?? ''} ${pageCount === '1' ? 'page' : 'pages'} prepared and downloaded.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'PDF split failed')
    }
  }

  const selectProtectPdf = (nextFile?: File) => {
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf') { setStatus('error'); setMessage('Please choose a PDF file.'); return }
    if (nextFile.size > 30 * 1024 * 1024) { setStatus('error'); setMessage('The maximum PDF size is 30 MB.'); return }
    setProtectFile(nextFile); setStatus('idle'); setMessage('')
  }

  const protectSelectedPdf = async () => {
    if (!protectFile) return
    if (password.length < 6) { setStatus('error'); setMessage('Use a password with at least 6 characters.'); return }
    if (password !== confirmPassword) { setStatus('error'); setMessage('The passwords do not match.'); return }
    setStatus('converting'); setMessage('Applying AES-256 encryption…')
    const data = new FormData()
    data.append('file', protectFile); data.append('password', password)
    data.append('allowPrinting', String(allowPrinting)); data.append('allowCopying', String(allowCopying)); data.append('allowModifying', String(allowModifying))
    try {
      const response = await fetch('/api/v1/protect', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'PDF protection failed')
      }
      const blob = await response.blob()
      const baseName = protectFile.name.replace(/\.pdf$/i, '')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${baseName}-protected.pdf`; link.click(); URL.revokeObjectURL(url)
      setStatus('success'); setMessage('Protected PDF downloaded. Keep your password somewhere safe—it cannot be recovered.')
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'PDF protection failed')
    }
  }

  const selectExtractFile = (nextFile?: File) => {
    if (!nextFile) return
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
    if (!validTypes.includes(nextFile.type)) { setStatus('error'); setMessage('Please choose a PDF, DOCX, or PPTX file.'); return }
    if (nextFile.size > 25 * 1024 * 1024) { setStatus('error'); setMessage('The maximum file size is 25 MB.'); return }
    setExtractFile(nextFile); setExtracted(null); setStatus('idle'); setMessage('')
  }

  const extractSelectedContent = async () => {
    if (!extractFile) return
    setStatus('converting'); setMessage('Reading document content…')
    const data = new FormData(); data.append('file', extractFile); data.append('mode', extractMode)
    try {
      const response = await fetch('/api/v1/extract', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Content extraction failed')
      }
      if (extractMode !== 'text') {
        const blob = await response.blob()
        const count = response.headers.get('x-extracted-count') ?? '0'
        const baseName = extractFile.name.replace(/\.pdf$/i, '')
        const url = URL.createObjectURL(blob); const link = document.createElement('a')
        link.href = url; link.download = `${baseName}-${extractMode === 'images' ? 'images' : 'pages-png'}.zip`; link.click(); URL.revokeObjectURL(url)
        setStatus('success'); setMessage(`${count} ${extractMode === 'images' ? 'embedded images' : 'page images'} extracted and downloaded.`)
        return
      }
      const body = await response.json() as { data?: ExtractedContent }
      if (!body.data) throw new Error('Content extraction failed')
      setExtracted(body.data); setStatus('success'); setMessage(body.data.text ? 'Content extracted successfully.' : 'No readable text was found in this document.')
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Content extraction failed')
    }
  }

  const downloadExtractedText = () => {
    if (!extracted) return
    const url = URL.createObjectURL(new Blob([extracted.text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${extracted.fileName.replace(/\.[^.]+$/, '')}-text.txt`; link.click(); URL.revokeObjectURL(url)
  }

  const selectVideo = (nextFile?: File) => {
    if (!nextFile) return
    if (!nextFile.type.startsWith('video/') || !/\.(mp4|mov|mkv|webm)$/i.test(nextFile.name)) { setStatus('error'); setMessage('Please choose an MP4, MOV, MKV, or WebM video.'); return }
    if (nextFile.size > 5 * 1024 * 1024 * 1024) { setStatus('error'); setMessage('The maximum video size is 5 GB.'); return }
    setVideoFile(nextFile); setStatus('idle'); setMessage('')
  }

  const splitSelectedVideo = async () => {
    if (!videoFile) return
    setStatus('converting'); setMessage('Uploading and splitting your video. Keep this tab open…')
    const data = new FormData(); data.append('file', videoFile); data.append('targetSizeMb', String(targetSize))
    try {
      const response = await fetch('/api/v1/video-split', { method: 'POST', body: data })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Video split failed')
      }
      const blob = await response.blob()
      const chunks = response.headers.get('x-chunk-count') ?? ''
      const largest = response.headers.get('x-largest-chunk-mb')
      const baseName = videoFile.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = `${baseName}-split.zip`; link.click(); URL.revokeObjectURL(url)
      setStatus('success'); setMessage(`Done! ${chunks} video chunks downloaded${largest ? ` · largest chunk ${largest} MB` : ''}.`)
    } catch (error) {
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Video split failed')
    }
  }

  const selectCompressionVideo = (nextFile?: File) => {
    if (!nextFile) return
    if (!nextFile.type.startsWith('video/') || !/\.(mp4|mov|mkv|webm)$/i.test(nextFile.name)) { setStatus('error'); setMessage('Please choose an MP4, MOV, MKV, or WebM video.'); return }
    if (nextFile.size > 5 * 1024 * 1024 * 1024) { setStatus('error'); setMessage('The maximum video size is 5 GB.'); return }
    compressionAbortRef.current?.abort()
    setCompressVideoFile(nextFile); setVideoProgress(0); setVideoEncoder(null); setStatus('idle'); setMessage('')
  }

  const compressSelectedVideo = async () => {
    if (!compressVideoFile) return
    compressionAbortRef.current?.abort()
    const controller = new AbortController()
    compressionAbortRef.current = controller
    setVideoProgress(0); setVideoEncoder(null); setStatus('converting'); setMessage('Uploading your video…')
    const data = new FormData(); data.append('file', compressVideoFile); data.append('quality', videoQuality); data.append('resolution', videoResolution)
    try {
      const response = await fetch('/api/v1/video-compress', { method: 'POST', body: data, signal: controller.signal })
      if (!response.ok) {
        const body = await response.json() as { error?: { message?: string } }
        throw new Error(body.error?.message ?? 'Could not start video compression')
      }
      const created = await response.json() as { jobId: string; statusUrl: string }
      setMessage('Compression started. You can track its progress below.')

      while (!controller.signal.aborted) {
        const statusResponse = await fetch(created.statusUrl, { signal: controller.signal, cache: 'no-store' })
        if (!statusResponse.ok) throw new Error('Could not retrieve compression progress')
        const job = await statusResponse.json() as CompressionJob
        setVideoProgress(job.progress)
        if (job.encoder) setVideoEncoder(job.encoder)
        if (job.status === 'failed') throw new Error(job.error ?? 'Video compression failed')
        if (job.status === 'completed' && job.downloadUrl && job.compressedSize !== undefined) {
          const link = document.createElement('a')
          link.href = job.downloadUrl; link.click()
          const sizeSummary = `${(job.originalSize / 1024 / 1024).toFixed(1)} MB → ${(job.compressedSize / 1024 / 1024).toFixed(1)} MB`
          setStatus('success'); setMessage(`Done! ${sizeSummary}${job.reductionPercent !== undefined && job.reductionPercent > 0 ? ` · ${job.reductionPercent}% smaller` : ''}.`)
          compressionAbortRef.current = null
          return
        }
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1500)
          controller.signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Video compression failed')
      compressionAbortRef.current = null
    }
  }

  useEffect(() => () => compressionAbortRef.current?.abort(), [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !pageRef.current) return
    const timeline = createTimeline({ defaults: { ease: 'outExpo' } })
      .add(pageRef.current.querySelector('.back-button')!, { opacity: { from: 0 }, x: { from: -14 }, duration: 500 })
      .add(pageRef.current.querySelectorAll('.tool-intro > *'), { opacity: { from: 0 }, y: { from: 18 }, delay: stagger(65), duration: 650 }, '-=320')
      .add(pageRef.current.querySelector('.upload-panel')!, { opacity: { from: 0 }, y: { from: 24 }, scale: { from: .97 }, duration: 700 }, '-=400')
      .add(pageRef.current.querySelectorAll('.trust-row span'), { opacity: { from: 0 }, y: { from: 10 }, delay: stagger(70), duration: 450 }, '-=300')
    return () => { timeline.revert() }
  }, [feature])

  return <div className="app-shell" ref={pageRef}>
    <Header onHome={onBack}/>
    <main className="tool-page">
      <button className="back-button" onClick={onBack}>← &nbsp;All tools</button>
      <section className="tool-intro">
        <span className={`feature-icon ${feature.color}`}><Icon name={feature.icon} size={28}/></span>
        <span className="eyebrow">FILEFLOW TOOL</span>
        <h1>{feature.title}</h1>
        <p>{feature.description} Your files are encrypted and automatically deleted after processing.</p>
      </section>
      {feature.id === 'ocr' ? <section className={`upload-panel ocr-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectOcrFile(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={(event) => selectOcrFile(event.target.files?.[0])}/>
        {!ocrFile ? <><div className="upload-icon ocr"><Icon name="extract" size={28}/></div><h2>Choose a scan or image</h2><p>PDF, PNG, JPEG, or WebP · English · Maximum 25 MB</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose file <Icon name="arrow" size={17}/></button></> : !ocrResult ? <div className="ocr-workspace">
          <div className="selected-file"><div className="file-type ocr">{ocrFile.name.split('.').pop()?.toUpperCase()}</div><div><strong>{ocrFile.name}</strong><span>{(ocrFile.size / 1024 / 1024).toFixed(2)} MB{ocrFile.type === 'application/pdf' ? ' · Up to 20 pages' : ''}</span></div><button onClick={() => { setOcrFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove file">×</button></div>
          <div className="ocr-note"><Icon name="sparkles" size={16}/><span><strong>For the best result</strong> Use a clear, upright scan with good contrast. Handwriting and heavily stylized text may be less accurate.</span></div>
          <button className="primary convert-button" disabled={status === 'converting'} onClick={runOcr}>{status === 'converting' ? <><span className="spinner"/> Recognizing text…</> : <><Icon name="extract" size={17}/> Recognize text</>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different file</button>
        </div> : <div className="ocr-results"><div className="result-header"><div><span className="file-type ocr">TXT</span><div><strong>Recognized text</strong><small>{ocrResult.fileName}</small></div></div><button onClick={() => { setOcrResult(null); setOcrFile(null); setStatus('idle'); setMessage('') }}>Start over</button></div>
          <div className="result-stats"><span><strong>{ocrResult.words.toLocaleString()}</strong> words</span><span><strong>{ocrResult.pageCount}</strong> {ocrResult.pageCount === 1 ? 'page' : 'pages'}</span><span><strong>{ocrResult.averageConfidence}%</strong> confidence</span></div>
          <pre className="text-preview">{ocrResult.text || 'No readable text was detected.'}</pre><div className="result-actions"><button className="secondary-action" disabled={!ocrResult.text} onClick={async () => { await navigator.clipboard.writeText(ocrResult.text); setMessage('Copied to clipboard.') }}>Copy text</button><button className="primary" disabled={!ocrResult.text} onClick={downloadOcrText}>Download TXT <Icon name="arrow" size={16}/></button></div>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'batch-images' ? <section className={`upload-panel batch-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); addBatchFiles(Array.from(event.dataTransfer.files)) }}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => addBatchFiles(Array.from(event.target.files ?? []))}/>
        {!batchFiles.length ? <><div className="upload-icon batch"><Icon name="upload" size={28}/></div><h2>Choose images to process</h2><p>PNG, JPEG, or WebP · Up to 10 files, 20 MB each</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose images <Icon name="arrow" size={17}/></button></> : <div className="batch-workspace">
          <div className="batch-header"><div><strong>Selected images</strong><span>{batchFiles.length} of 10 files</span></div><button disabled={batchFiles.length >= 10} onClick={() => inputRef.current?.click()}>+ Add images</button></div>
          <div className="batch-list">{batchFiles.map((item, index) => <div className="batch-item" key={`${item.name}-${item.size}-${item.lastModified}`}><span>{index + 1}</span><div className="file-type">{item.name.split('.').pop()?.toUpperCase()}</div><div><strong>{item.name}</strong><small>{(item.size / 1024 / 1024).toFixed(2)} MB</small></div><button onClick={() => setBatchFiles((files) => files.filter((file) => file !== item))} aria-label={`Remove ${item.name}`}>×</button></div>)}</div>
          <fieldset className="batch-operation"><legend>Batch operation</legend><label className={batchOperation === 'compress' ? 'active' : ''}><input type="radio" name="batch-operation" checked={batchOperation === 'compress'} onChange={() => setBatchOperation('compress')}/><span><strong>Compress originals</strong><small>Keep each image format</small></span></label><label className={batchOperation === 'convert' ? 'active' : ''}><input type="radio" name="batch-operation" checked={batchOperation === 'convert'} onChange={() => setBatchOperation('convert')}/><span><strong>Convert all</strong><small>Use one output format</small></span></label></fieldset>
          <div className="batch-settings">{batchOperation === 'convert' && <label>Output format<select value={batchFormat} onChange={(event) => setBatchFormat(event.target.value as typeof batchFormat)}><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label>}<label>Quality <span>{batchQuality}%</span><input type="range" min="20" max="95" value={batchQuality} onChange={(event) => setBatchQuality(Number(event.target.value))}/></label></div>
          <button className="primary convert-button" disabled={status === 'converting'} onClick={processBatch}>{status === 'converting' ? <><span className="spinner"/> Processing images…</> : <>{batchOperation === 'convert' ? 'Convert' : 'Compress'} {batchFiles.length} images <Icon name="arrow" size={17}/></>}</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'pdf-organize' ? <section className={`upload-panel organizer-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void selectOrganizerPdf(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(event) => void selectOrganizerPdf(event.target.files?.[0])}/>
        {!organizerFile ? <><div className="upload-icon organizer"><Icon name="merge" size={28}/></div><h2>Choose a PDF to organize</h2><p>PDF documents · Maximum 30 MB and 100 pages</p><button className="primary" disabled={status === 'converting'} onClick={() => inputRef.current?.click()}>{status === 'converting' ? <><span className="spinner"/> Creating previews…</> : <>Choose PDF <Icon name="arrow" size={17}/></>}</button></> : <div className="organizer-workspace">
          <div className="organizer-header"><div><strong>Arrange pages</strong><span>{organizerPages.length} of 100 pages · Use arrows to reorder</span></div><button onClick={() => inputRef.current?.click()}>Replace PDF</button></div>
          <div className="page-grid">{organizerPages.map((item, index) => <article className="page-card" key={item.page}><div className="page-thumb"><img src={item.thumbnail} alt={`Preview of original page ${item.page}`} style={{ transform: `rotate(${item.rotation}deg)` }}/></div><strong>Page {item.page}</strong><div className="page-actions"><button disabled={index === 0} onClick={() => moveOrganizerPage(index, -1)} aria-label={`Move page ${item.page} left`}>←</button><button disabled={index === organizerPages.length - 1} onClick={() => moveOrganizerPage(index, 1)} aria-label={`Move page ${item.page} right`}>→</button><button onClick={() => setOrganizerPages((pages) => pages.map((page) => page.page === item.page ? { ...page, rotation: (page.rotation + 90) % 360 } : page))} aria-label={`Rotate page ${item.page}`}>↻</button><button disabled={organizerPages.length === 1} onClick={() => setOrganizerPages((pages) => pages.filter((page) => page.page !== item.page))} aria-label={`Remove page ${item.page}`}>×</button></div></article>)}</div>
          <button className="primary convert-button" disabled={status === 'converting' || !organizerPages.length} onClick={exportOrganizedPdf}>{status === 'converting' ? <><span className="spinner"/> Exporting…</> : <>Export organized PDF <Icon name="arrow" size={17}/></>}</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'pdf-compress' ? <section className={`upload-panel pdf-compress-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectCompressionPdf(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(event) => selectCompressionPdf(event.target.files?.[0])}/>
        {!compressPdfFile ? <><div className="upload-icon pdf-compress"><Icon name="compress" size={28}/></div><h2>Choose a PDF to compress</h2><p>PDF documents · Maximum 100 MB and 1,000 pages</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose PDF <Icon name="arrow" size={17}/></button></> : <div className="pdf-compress-workspace">
          <div className="selected-file"><div className="file-type pdf-compress">PDF</div><div><strong>{compressPdfFile.name}</strong><span>{(compressPdfFile.size / 1024 / 1024).toFixed(2)} MB</span></div><button onClick={() => { setCompressPdfFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove PDF">×</button></div>
          <fieldset className="compression-options"><legend>Compression preset</legend>{([['high','High quality','150 DPI · JPEG 85'],['balanced','Balanced','Recommended · 120 DPI'],['small','Smallest file','96 DPI · JPEG 58']] as const).map(([value,title,detail]) => <label className={pdfCompressionPreset === value ? 'active' : ''} key={value}><input type="radio" name="pdf-compression" checked={pdfCompressionPreset === value} onChange={() => setPdfCompressionPreset(value)}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</fieldset>
          <label className="pdf-password">PDF password <span>Optional — only needed for protected PDFs</span><input type="password" maxLength={128} value={pdfCompressionPassword} onChange={(event) => setPdfCompressionPassword(event.target.value)} autoComplete="off" placeholder="Enter document password"/></label>
          <div className="flatten-note"><Icon name="sparkles" size={15}/><span><strong>Best for scanned PDFs</strong> Pages are flattened during compression, so selectable text, links, forms, and annotations will no longer be interactive.</span></div>
          <button className="primary convert-button" disabled={status === 'converting'} onClick={compressSelectedPdf}>{status === 'converting' ? <><span className="spinner"/> Compressing PDF…</> : <><Icon name="compress" size={17}/> Compress PDF</>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different PDF</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'video-compress' ? <section className={`upload-panel video-compress-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectCompressionVideo(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mkv" hidden onChange={(event) => selectCompressionVideo(event.target.files?.[0])}/>
        {!compressVideoFile ? <><div className="upload-icon video-compress"><Icon name="video" size={28}/></div><h2>Choose a video to compress</h2><p>MP4, MOV, MKV, or WebM · Output as MP4</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose video <Icon name="arrow" size={17}/></button></> : <div className="video-workspace">
          <div className="selected-file"><div className="file-type video-compress">{compressVideoFile.name.split('.').pop()?.toUpperCase()}</div><div><strong>{compressVideoFile.name}</strong><span>{compressVideoFile.size >= 1024 * 1024 * 1024 ? `${(compressVideoFile.size / 1024 / 1024 / 1024).toFixed(2)} GB` : `${(compressVideoFile.size / 1024 / 1024).toFixed(1)} MB`}</span></div><button onClick={() => { setCompressVideoFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove video">×</button></div>
          <fieldset className="compression-options"><legend>Compression quality</legend>{([['high','High quality','Larger file · CRF 20'],['balanced','Balanced','Recommended · CRF 26'],['small','Smallest file','More compression · CRF 32']] as const).map(([value,title,detail]) => <label className={videoQuality === value ? 'active' : ''} key={value}><input type="radio" name="video-quality" checked={videoQuality === value} onChange={() => setVideoQuality(value)}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</fieldset>
          <div className="resolution-picker"><label htmlFor="video-resolution">Maximum resolution</label><select id="video-resolution" value={videoResolution} onChange={(event) => setVideoResolution(event.target.value as typeof videoResolution)}><option value="original">Keep original</option><option value="1080">1080p Full HD</option><option value="720">720p HD</option><option value="480">480p SD</option></select></div>
          <div className="engine-note"><Icon name="sparkles" size={15}/><span><strong>Faster compression</strong> H.264 uses up to 75% of available CPU threads, or Apple hardware when available.</span></div>
          {status === 'converting' && <div className="compression-progress" aria-label={`Compression ${videoProgress}% complete`}><div><span>{videoProgress < 1 ? 'Preparing video…' : `Compressing video${videoEncoder === 'h264_videotoolbox' ? ' with Apple hardware…' : '…'}`}</span><strong>{videoProgress}%</strong></div><progress max="100" value={videoProgress}/><small>Keep this tab open. The download starts automatically when ready.</small></div>}
          <button className="primary convert-button" disabled={status === 'converting'} onClick={compressSelectedVideo}>{status === 'converting' ? <><span className="spinner"/> Compressing video…</> : <><Icon name="compress" size={17}/> Compress video</>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different video</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'video-split' ? <section className={`upload-panel video-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectVideo(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mkv" hidden onChange={(event) => selectVideo(event.target.files?.[0])}/>
        {!videoFile ? <><div className="upload-icon video"><Icon name="video" size={28}/></div><h2>Choose a video to split</h2><p>MP4, MOV, MKV, or WebM · Maximum 5 GB</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose video <Icon name="arrow" size={17}/></button></> : <div className="video-workspace">
          <div className="selected-file"><div className="file-type video">{videoFile.name.split('.').pop()?.toUpperCase()}</div><div><strong>{videoFile.name}</strong><span>{videoFile.size >= 1024 * 1024 * 1024 ? `${(videoFile.size / 1024 / 1024 / 1024).toFixed(2)} GB` : `${(videoFile.size / 1024 / 1024).toFixed(1)} MB`}</span></div><button onClick={() => { setVideoFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove video">×</button></div>
          <div className="size-picker"><div className="picker-title"><strong>Target size per chunk</strong><span>Approximate · aligns to keyframes</span></div><div className="size-presets">{[10,25,50,100,250,500,1024].map(size => <button className={targetSize === size ? 'active' : ''} key={size} onClick={() => setTargetSize(size)}>{size === 1024 ? '1 GB' : `${size} MB`}</button>)}</div><label>Custom size <span><input type="number" min="10" max="1024" value={targetSize} onChange={(event) => setTargetSize(Math.min(1024, Math.max(10, Number(event.target.value))))}/> MB</span></label></div>
          <div className="video-estimate">Estimated chunks: <strong>about {Math.max(1, Math.ceil(videoFile.size / (targetSize * 1024 * 1024)))}</strong></div>
          <button className="primary convert-button" disabled={status === 'converting'} onClick={splitSelectedVideo}>{status === 'converting' ? <><span className="spinner"/> Processing video…</> : <><Icon name="split" size={17}/> Split video</>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different video</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'extract' ? <section className={`upload-panel extract-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectExtractFile(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="application/pdf,.docx,.pptx" hidden onChange={(event) => selectExtractFile(event.target.files?.[0])}/>
        {!extractFile ? <><div className="upload-icon extract"><Icon name="extract" size={28}/></div><h2>Choose a document</h2><p>PDF, DOCX, or PPTX · Maximum 25 MB</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose document <Icon name="arrow" size={17}/></button></> : !extracted ? <div className="extract-start"><div className="selected-file"><div className="file-type extracted">{extractFile.name.split('.').pop()?.toUpperCase()}</div><div><strong>{extractFile.name}</strong><span>{(extractFile.size / 1024 / 1024).toFixed(2)} MB</span></div><button onClick={() => { setExtractFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove document">×</button></div>
          <fieldset className="extract-modes"><legend>What would you like to extract?</legend><label className={extractMode === 'text' ? 'active' : ''}><input type="radio" name="extract-mode" checked={extractMode === 'text'} onChange={() => setExtractMode('text')}/><span><strong>Text</strong><small>Preview, copy, or download as TXT</small></span></label><label className={extractMode === 'images' ? 'active' : ''}><input type="radio" name="extract-mode" checked={extractMode === 'images'} disabled={extractFile.type !== 'application/pdf'} onChange={() => setExtractMode('images')}/><span><strong>Embedded images</strong><small>Download original images in a ZIP</small></span></label><label className={extractMode === 'pages' ? 'active' : ''}><input type="radio" name="extract-mode" checked={extractMode === 'pages'} disabled={extractFile.type !== 'application/pdf'} onChange={() => setExtractMode('pages')}/><span><strong>Pages as PNG</strong><small>Best for scanned or flattened PDFs</small></span></label></fieldset>
          <button className="primary convert-button" disabled={status === 'converting'} onClick={extractSelectedContent}>{status === 'converting' ? <><span className="spinner"/> Extracting…</> : <><Icon name="extract" size={17}/> Extract {extractMode === 'text' ? 'text' : extractMode}</>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different document</button></div> : <div className="extract-results">
          <div className="result-header"><div><span className="file-type extracted">TXT</span><div><strong>Extracted content</strong><small>{extracted.fileName}</small></div></div><button onClick={() => { setExtracted(null); setExtractFile(null); setStatus('idle'); setMessage('') }}>Start over</button></div>
          <div className="result-stats"><span><strong>{extracted.words.toLocaleString()}</strong> words</span><span><strong>{extracted.characters.toLocaleString()}</strong> characters</span>{extracted.pages !== undefined && <span><strong>{extracted.pages}</strong> {extractFile.type.includes('presentation') ? 'slides' : 'pages'}</span>}</div>
          <pre className="text-preview">{extracted.text || 'No readable text was found.'}</pre>
          <div className="result-actions"><button className="secondary-action" disabled={!extracted.text} onClick={async () => { await navigator.clipboard.writeText(extracted.text); setMessage('Copied to clipboard.') }}>Copy text</button><button className="primary" disabled={!extracted.text} onClick={downloadExtractedText}>Download TXT <Icon name="arrow" size={16}/></button></div>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'protect' ? <section className={`upload-panel protect-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectProtectPdf(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(event) => selectProtectPdf(event.target.files?.[0])}/>
        {!protectFile ? <><div className="upload-icon protect"><Icon name="protect" size={28}/></div><h2>Choose a PDF to protect</h2><p>AES-256 encryption · Maximum 30 MB</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose PDF <Icon name="arrow" size={17}/></button></> : <div className="protect-workspace">
          <div className="selected-file"><div className="file-type protected">PDF</div><div><strong>{protectFile.name}</strong><span>{(protectFile.size / 1024 / 1024).toFixed(2)} MB</span></div><button onClick={() => { setProtectFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove PDF">×</button></div>
          <div className="password-grid"><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 6 characters"/></label><label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repeat password"/></label></div>
          <div className="password-strength"><div><i className={passwordScore > 0 ? 'active' : ''}/><i className={passwordScore > 1 ? 'active' : ''}/><i className={passwordScore > 2 ? 'active' : ''}/><i className={passwordScore > 3 ? 'active' : ''}/></div><span>{!password ? 'Enter a strong password' : passwordScore < 2 ? 'Weak password' : passwordScore < 4 ? 'Good password' : 'Strong password'}</span></div>
          <fieldset className="permissions"><legend>Document permissions</legend><label><input type="checkbox" checked={allowPrinting} onChange={(event) => setAllowPrinting(event.target.checked)}/><span><strong>Allow printing</strong><small>Readers can print the document</small></span></label><label><input type="checkbox" checked={allowCopying} onChange={(event) => setAllowCopying(event.target.checked)}/><span><strong>Allow copying</strong><small>Readers can copy text and images</small></span></label><label><input type="checkbox" checked={allowModifying} onChange={(event) => setAllowModifying(event.target.checked)}/><span><strong>Allow editing</strong><small>Readers can modify document content</small></span></label></fieldset>
          <button className="primary convert-button" disabled={status === 'converting' || password.length < 6 || password !== confirmPassword} onClick={protectSelectedPdf}>{status === 'converting' ? <><span className="spinner"/> Protecting…</> : <><Icon name="protect" size={17}/> Protect PDF</>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different PDF</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'split' ? <section className={`upload-panel split-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectPdf(event.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(event) => selectPdf(event.target.files?.[0])}/>
        {!pdfFile ? <><div className="upload-icon"><Icon name="split" size={28}/></div><h2>Choose a PDF to split</h2><p>One PDF file · Maximum 30 MB</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose PDF <Icon name="arrow" size={17}/></button></> : <div className="split-workspace">
          <div className="selected-file"><div className="file-type pdf">PDF</div><div><strong>{pdfFile.name}</strong><span>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</span></div><button onClick={() => { setPdfFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove PDF">×</button></div>
          <fieldset className="split-modes"><legend>How would you like to split it?</legend><label className={splitMode === 'selected' ? 'active' : ''}><input type="radio" name="split-mode" value="selected" checked={splitMode === 'selected'} onChange={() => setSplitMode('selected')}/><span><strong>Extract selected pages</strong><small>Combine chosen pages into one new PDF</small></span></label><label className={splitMode === 'all' ? 'active' : ''}><input type="radio" name="split-mode" value="all" checked={splitMode === 'all'} onChange={() => setSplitMode('all')}/><span><strong>Split every page</strong><small>Download individual PDFs in a ZIP file</small></span></label></fieldset>
          {splitMode === 'selected' && <label className="page-input">Pages to extract<input value={pageSelection} onChange={(event) => setPageSelection(event.target.value)} placeholder="Example: 1,3-5,8"/><small>Use commas and ranges, for example 1,3-5</small></label>}
          <button className="primary convert-button" disabled={status === 'converting' || (splitMode === 'selected' && !pageSelection.trim())} onClick={splitSelectedPdf}>{status === 'converting' ? <><span className="spinner"/> Splitting…</> : <>{splitMode === 'all' ? 'Split every page' : 'Extract pages'} <Icon name="arrow" size={17}/></>}</button><button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different PDF</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'merge' ? <section className={`upload-panel merge-panel ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); addMergeFiles(Array.from(event.dataTransfer.files)) }}>
        <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => addMergeFiles(Array.from(event.target.files ?? []))}/>
        {mergeFiles.length === 0 ? <><div className="upload-icon"><Icon name="merge" size={28}/></div><h2>Add files to merge</h2><p>PDF, PNG, JPEG, or WebP · 2–10 files</p><button className="primary" onClick={() => inputRef.current?.click()}>Choose files <Icon name="arrow" size={17}/></button></> : <div className="merge-workspace">
          <div className="merge-title"><div><strong>Files to merge</strong><span>{mergeFiles.length} of 10 files</span></div><button onClick={() => inputRef.current?.click()}>+ Add more</button></div>
          <div className="merge-list">{mergeFiles.map((item, index) => <div className="merge-item" key={`${item.name}-${item.lastModified}-${index}`}><span className="order">{index + 1}</span><div className="file-type">{item.name.split('.').pop()?.toUpperCase()}</div><div className="merge-file-name"><strong>{item.name}</strong><span>{(item.size / 1024 / 1024).toFixed(2)} MB</span></div><div className="reorder"><button disabled={index === 0} onClick={() => moveMergeFile(index, -1)} aria-label="Move up">↑</button><button disabled={index === mergeFiles.length - 1} onClick={() => moveMergeFile(index, 1)} aria-label="Move down">↓</button><button onClick={() => setMergeFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove">×</button></div></div>)}</div>
          <button className="primary convert-button" disabled={mergeFiles.length < 2 || status === 'converting'} onClick={mergeSelectedFiles}>{status === 'converting' ? <><span className="spinner"/> Merging…</> : <>Merge {mergeFiles.length} files <Icon name="arrow" size={17}/></>}</button>
          {mergeFiles.length < 2 && <span className="merge-hint">Add at least one more file to continue</span>}
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : feature.id === 'convert' || feature.id === 'compress' ? <section
        className={`upload-panel converter ${isDragging ? 'dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files[0]) }}
      >
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => selectFile(event.target.files?.[0])}/>
        {!file ? <>
          <div className="upload-icon"><Icon name="upload" size={28}/></div>
          <h2>Drop your image here</h2>
          <p>PNG, JPEG, or WebP · Maximum 20 MB</p>
          <button className="primary" onClick={() => inputRef.current?.click()}>Choose image <Icon name="arrow" size={17}/></button>
        </> : <div className="conversion-workspace">
          <div className="selected-file"><div className="file-type">{file.name.split('.').pop()?.toUpperCase()}</div><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div><button onClick={() => { setFile(null); setStatus('idle'); setMessage('') }} aria-label="Remove file">×</button></div>
          {feature.id === 'convert' ? <div className="format-row"><label htmlFor="output-format">Convert to</label><select id="output-format" value={format} onChange={(event) => setFormat(event.target.value)}><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></div> : <div className="quality-control"><div><label htmlFor="quality">Image quality</label><strong>{quality}%</strong></div><input id="quality" type="range" min="20" max="95" value={quality} onChange={(event) => setQuality(Number(event.target.value))}/><div className="quality-labels"><span>Smaller file</span><span>Higher quality</span></div></div>}
          <button className="primary convert-button" onClick={feature.id === 'convert' ? convertFile : compressFile} disabled={status === 'converting'}>{status === 'converting' ? <><span className="spinner"/> {feature.id === 'convert' ? 'Converting…' : 'Compressing…'}</> : <>{feature.id === 'convert' ? 'Convert image' : 'Compress image'} <Icon name="arrow" size={17}/></>}</button>
          <button className="replace-button" onClick={() => inputRef.current?.click()}>Choose a different image</button>
        </div>}
        {message && <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check" size={17}/>} {message}</div>}
      </section> : <section className="upload-panel">
          <div className="upload-icon"><Icon name="upload" size={28}/></div><h2>Coming next</h2><p>This tool will be developed in the next feature iteration.</p><button className="primary" onClick={onBack}>Explore available tools</button>
        </section>}
      <div className="trust-row"><span><Icon name="check" size={17}/> No signup required</span><span><Icon name="check" size={17}/> Secure processing</span><span><Icon name="check" size={17}/> Automatic deletion</span></div>
    </main>
  </div>
}

function Home({ onOpen }: { onOpen: (feature: Feature) => void }) {
  const [activeCategory, setActiveCategory] = useState('All tools')
  const [query, setQuery] = useState('')
  const homeRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => features.filter(item => (activeCategory === 'All tools' || item.category === activeCategory) && (`${item.title} ${item.description}`).toLowerCase().includes(query.toLowerCase())), [activeCategory, query])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !homeRef.current) return
    const root = homeRef.current
    const intro = createTimeline({ defaults: { ease: 'outExpo' } })
      .add(root.querySelector('.site-header')!, { opacity: { from: 0 }, y: { from: -18 }, duration: 650 })
      .add(root.querySelector('.announcement')!, { opacity: { from: 0 }, y: { from: 12 }, scale: { from: .96 }, duration: 550 }, '-=350')
      .add(root.querySelectorAll('.hero-section h1, .hero-section > p, .hero-actions'), { opacity: { from: 0 }, y: { from: 22 }, delay: stagger(85), duration: 700 }, '-=360')
      .add(root.querySelector('.mini-workspace')!, { opacity: { from: 0 }, y: { from: 38 }, scale: { from: .94 }, duration: 850 }, '-=460')
    const dots = animate(root.querySelectorAll('.process-line i'), { opacity: [.25, 1], scale: [.7, 1.25], delay: stagger(180), duration: 700, loop: true, alternate: true, ease: 'inOutSine' })
    const ready = animate(root.querySelector('.success-file svg')!, { scale: [1, 1.18], rotate: [0, 5], duration: 1100, loop: true, alternate: true, ease: 'inOutSine' })
    return () => { intro.revert(); dots.revert(); ready.revert() }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !homeRef.current) return
    const cards = animate(homeRef.current.querySelectorAll('.feature-card'), { opacity: { from: 0 }, y: { from: 18 }, scale: { from: .98 }, delay: stagger(55), duration: 520, ease: 'outCubic' })
    return () => { cards.revert() }
  }, [activeCategory, query])

  return <div className="app-shell" ref={homeRef}>
    <Header onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}/>
    <main>
      <section className="hero-section">
        <div className="hero-glow" />
        <div className="announcement"><Icon name="sparkles" size={15}/> Simple tools. Serious productivity. <span>Explore tools →</span></div>
        <h1>Every file task.<br/><em>One simple place.</em></h1>
        <p>Convert, compress, merge, and organize your files with fast, secure tools that just work.</p>
        <div className="hero-actions"><button className="primary" onClick={() => document.querySelector('#tools')?.scrollIntoView({ behavior: 'smooth' })}>Explore all tools <Icon name="arrow" size={17}/></button><span>No signup required</span></div>
        <div className="mini-workspace" aria-hidden="true">
          <div className="mini-top"><span/><span/><span/><b>your-files.pdf</b></div>
          <div className="mini-body"><div className="file-stack"><span/><span/><span><b>PDF</b></span></div><div className="process-line"><i/><i/><i/></div><div className="success-file"><Icon name="check" size={20}/><b>Ready!</b><small>2.4 MB</small></div></div>
        </div>
      </section>

      <section className="tools-section" id="tools">
        <div className="section-heading"><div><span className="eyebrow">YOUR TOOLBOX</span><h2>What would you like to do?</h2></div><label className="search"><Icon name="search" size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tools..." aria-label="Search tools"/></label></div>
        <div className="filters" role="group" aria-label="Filter tools">{categories.map(category => <button key={category} className={category === activeCategory ? 'active' : ''} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
        <div className="feature-grid">{filtered.map(feature => <button className="feature-card" key={feature.id} onClick={() => onOpen(feature)}>
          <span className={`feature-icon ${feature.color}`}><Icon name={feature.icon} size={25}/></span>
          <span className="card-copy">{feature.popular && <small>POPULAR</small>}<strong>{feature.title}</strong><p>{feature.description}</p><span className="formats">{feature.formats}</span></span>
          <span className="round-arrow"><Icon name="arrow" size={18}/></span>
        </button>)}</div>
        {filtered.length === 0 && <div className="empty-state">No tools matched “{query}”. Try another search.</div>}
      </section>

      <section className="how-section" id="how-it-works"><span className="eyebrow">HOW IT WORKS</span><h2>From file to finished in three steps</h2><div className="steps">
        <div><span>01</span><i><Icon name="upload" size={23}/></i><h3>Choose your files</h3><p>Drag and drop or browse from your device.</p></div>
        <div><span>02</span><i><Icon name="sparkles" size={23}/></i><h3>We do the work</h3><p>Fast processing, right in your browser.</p></div>
        <div><span>03</span><i><Icon name="check" size={23}/></i><h3>Download & done</h3><p>Your finished file is ready in seconds.</p></div>
      </div></section>
      <section className="security-strip" id="security"><div className="shield"><Icon name="protect" size={29}/></div><div><b>Your files stay yours.</b><span>Encrypted transfers · Private processing · Automatic deletion</span></div><a href="#security">Learn about security <Icon name="arrow" size={16}/></a></section>
    </main>
    <footer><div className="brand"><span className="brand-mark"><span/><span/><span/></span><span>File<span>Flow</span></span></div><p>Simple tools for everyday file work.</p><span>© 2026 FileFlow</span></footer>
  </div>
}

function App() {
  const [path, setPath] = useState(() => {
    const initialPath = window.location.pathname
    if (initialPath.startsWith('/tools/') && !window.history.state?.fileFlowRoute) {
      window.history.replaceState({ fileFlowRoute: true }, '', '/')
      window.history.pushState({ fileFlowRoute: true }, '', initialPath)
    }
    return initialPath
  })

  useEffect(() => {
    const handleNavigation = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  const navigate = (nextPath: string, replace = false) => {
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method]({ fileFlowRoute: true }, '', nextPath)
    setPath(nextPath)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const match = path.match(/^\/tools\/([^/]+)\/?$/)
  const selected = match ? features.find((feature) => feature.id === decodeURIComponent(match[1] ?? '')) : undefined

  useEffect(() => {
    if (path !== '/' && !selected) navigate('/', true)
  }, [path, selected])

  return selected
    ? <ToolPage feature={selected} onBack={() => navigate('/', true)}/>
    : <Home onOpen={(feature) => navigate(`/tools/${feature.id}`)}/>
}

export default App
