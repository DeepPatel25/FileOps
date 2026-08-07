# FileFlow

Run the complete production stack with Docker Compose:

```bash
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080). The stack includes:

- `frontend` — optimized Vite build served by Nginx
- `backend` — Node API with FFmpeg, FFprobe, Poppler, Sharp, and OCR support
- `redis` — persistent BullMQ storage
- `gotenberg` — LibreOffice-only Gotenberg image for DOCX/PPTX-to-PDF conversion (Chromium omitted)

Useful commands:

```bash
# Start existing images without rebuilding
docker compose up -d

# Show service health
docker compose ps

# Follow application logs
docker compose logs -f backend frontend

# Stop containers while preserving Redis job data
docker compose down

# Rebuild after source changes
docker compose up -d --build
```

Set worker concurrency when needed:

```bash
VIDEO_WORKER_CONCURRENCY=2 docker compose up -d
```

The frontend is exposed on port `8080`. Backend, Redis, and Gotenberg ports are bound to localhost for diagnostics; browser API requests are proxied through Nginx.
