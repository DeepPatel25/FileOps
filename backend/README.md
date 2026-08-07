# FileFlow Backend

Node.js, Express, and TypeScript API for the FileFlow frontend.

## Development

```bash
cp .env.example .env
docker compose -f ../docker-compose.yml up -d
npm install
npm run dev
```

The API runs at `http://localhost:4000` by default.

## Endpoints

- `GET /` — API information
- `GET /api/v1/health` — service health
- `GET /api/v1/health/metrics` — process memory and BullMQ queue metrics
- `GET /api/v1/tools` — list tools (`category` and `search` query parameters supported)
- `GET /api/v1/tools/:id` — get a tool
- `POST /api/v1/convert` — convert a PNG, JPEG, or WebP image (multipart fields: `file`, `format`)
- `POST /api/v1/compress` — compress a PNG, JPEG, or WebP image (multipart fields: `file`, `quality`)
- `POST /api/v1/pdf-compress` — compress a PDF using `high`, `balanced`, or `small` presets (multipart fields: `file`, `preset`, optional `password`; maximum 100 MB and 1,000 pages)
- `POST /api/v1/pdf-organize/preview` — generate thumbnails for visual page organization (`file`; maximum 30 MB and 100 pages)
- `POST /api/v1/pdf-organize` — reorder, rotate, or remove PDF pages (`file`, JSON `operations`)
- `POST /api/v1/batch-images` — convert or compress up to 10 images and download a ZIP (`files`, `operation`, `format`, `quality`)
- `POST /api/v1/ocr` — recognize English, German, French, Hindi, or Spanish text in an image or scanned PDF (`file`, `language`, `output`: `text` or `searchable-pdf`; maximum 25 MB and 20 PDF pages)
- `POST /api/v1/pdf-convert/to-images` — export PDF pages as PNG, JPEG, or WebP (`file`, `format`, `dpi`)
- `POST /api/v1/pdf-convert/from-images` — combine up to 10 images into a PDF (`files`, `pageSize`, `orientation`)
- `POST /api/v1/media-convert` — convert audio and video to MP4, WebM, MP3, M4A, or WAV (`file`, `format`; maximum 2 GB)
- `POST /api/v1/document-convert` — convert DOCX/PPTX to PDF using Gotenberg, or PDF text to editable DOCX (`file`; maximum 25 MB)
- `POST /api/v1/merge` — merge 2–10 PDF or image files into one PDF (multipart field: `files`)
- `POST /api/v1/split` — extract selected PDF pages or split every page into a ZIP (`file`, `mode`, `pages`)
- `POST /api/v1/protect` — encrypt a PDF with AES-256 and document permissions (`file`, `password`, permission fields)
- `POST /api/v1/extract` — extract text, embedded images, or rendered pages (`file`, `mode`: `text`, `images`, or `pages`)
- `POST /api/v1/video-split` — split MP4, MOV, MKV, or WebM video into approximately sized chunks (`file`, `targetSizeMb`)
- `POST /api/v1/video-compress` — upload a video and start a background MP4 compression job (`file`, `quality`, `resolution`)
- `GET /api/v1/video-compress/jobs/:id` — poll compression status and percentage
- `GET /api/v1/video-compress/jobs/:id/download` — download a completed video (available for one hour)
- `DELETE /api/v1/video-compress/jobs/:id` — cancel a queued or active compression job
- `GET /api/v1/video-compress/jobs?clientId=...` — list recent compression jobs for a browser client
- `DELETE /api/v1/video-compress/history/:id?clientId=...` — remove a completed history item and its output
- `DELETE /api/v1/video-compress/history?clientId=...` — clear completed/failed history

Video compression uses a durable BullMQ queue backed by the Redis container. Jobs survive API restarts, and `VIDEO_WORKER_CONCURRENCY` controls parallel processing. It automatically uses Apple VideoToolbox hardware encoding when available, with `libx264` as the fallback. Software encoding and video filters can use up to 75% of the available logical CPU threads.

Office-to-PDF conversion uses the Gotenberg container defined in the root Compose file. PDF-to-DOCX is text-focused: text remains editable, while complex layout, forms, and columns may differ from the source.

## Large video deployment

Video uploads can be up to 5 GB and processing may take several minutes. A
production reverse proxy must allow the request body and keep the upstream
connection open. For Nginx, use equivalent settings in the API location:

```nginx
client_max_body_size 5g;
proxy_request_buffering off;
proxy_buffering off;
proxy_connect_timeout 60s;
proxy_send_timeout 1h;
proxy_read_timeout 1h;
```

Managed serverless platforms commonly enforce hard body-size and execution-time
limits that cannot be overridden. Host the video endpoint on a long-running
Node service with adequate temporary disk space.
