# FileFlow Backend

Node.js, Express, and TypeScript API for the FileFlow frontend.

## Development

```bash
cp .env.example .env
npm install
npm run dev
```

The API runs at `http://localhost:4000` by default.

## Endpoints

- `GET /` — API information
- `GET /api/v1/health` — service health
- `GET /api/v1/tools` — list tools (`category` and `search` query parameters supported)
- `GET /api/v1/tools/:id` — get a tool
- `POST /api/v1/convert` — convert a PNG, JPEG, or WebP image (multipart fields: `file`, `format`)
- `POST /api/v1/compress` — compress a PNG, JPEG, or WebP image (multipart fields: `file`, `quality`)
- `POST /api/v1/pdf-compress` — compress a PDF using `high`, `balanced`, or `small` presets (multipart fields: `file`, `preset`, optional `password`; maximum 100 MB and 1,000 pages)
- `POST /api/v1/merge` — merge 2–10 PDF or image files into one PDF (multipart field: `files`)
- `POST /api/v1/split` — extract selected PDF pages or split every page into a ZIP (`file`, `mode`, `pages`)
- `POST /api/v1/protect` — encrypt a PDF with AES-256 and document permissions (`file`, `password`, permission fields)
- `POST /api/v1/extract` — extract text, embedded images, or rendered pages (`file`, `mode`: `text`, `images`, or `pages`)
- `POST /api/v1/video-split` — split MP4, MOV, MKV, or WebM video into approximately sized chunks (`file`, `targetSizeMb`)
- `POST /api/v1/video-compress` — upload a video and start a background MP4 compression job (`file`, `quality`, `resolution`)
- `GET /api/v1/video-compress/jobs/:id` — poll compression status and percentage
- `GET /api/v1/video-compress/jobs/:id/download` — download a completed video (available for one hour)

Video compression runs one queued job at a time. It automatically uses Apple VideoToolbox hardware encoding when available, with `libx264` as the fallback. Software encoding and video filters can use up to 75% of the available logical CPU threads.

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
