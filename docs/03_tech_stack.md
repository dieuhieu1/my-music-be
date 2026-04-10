# Tech Stack
**Music Streaming App · Full-Stack**

---

## Backend — NestJS

| Concern | Package | Justification |
|---|---|---|
| Framework | `@nestjs/core`, `@nestjs/common` | Modular, decorator-driven — maps cleanly to domain modules |
| ORM | `@nestjs/typeorm`, `typeorm`, `pg` | PostgreSQL dialect, entity-based schema, migration support |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | JWT access + refresh token strategy (BL-02, BL-04) |
| Password hashing | `bcrypt` | bcrypt rounds=10 as specified (BL-01, BL-05) |
| Validation | `class-validator`, `class-transformer` | DTO validation + auto-transform on all request bodies |
| File upload | `multer`, `@types/multer` | Receive audio files and images before forwarding to MinIO |
| Object storage | `minio` (Node.js SDK) | Upload files to MinIO, generate presigned URLs for streaming and download |
| File type validation | `file-type` | Magic-byte MIME validation — rejects silently renamed files (BL-44, BL-88, BL-89) |
| Audio duration | `music-metadata` | Parse audio duration server-side, enforce 20-min max (BL-44) |
| Image processing | `sharp` | Center-crop and resize avatar uploads to 400×400 px (BL-88, BL-89) |
| Encryption | Node.js built-in `crypto` | AES-256-CBC `.enc` file generation per song (BL-44, BL-53) |
| Queue | `bullmq`, `@nestjs/bullmq` | All async jobs: email, audio extraction, drop notifications, genre tagging, recommendations, session cleanup |
| Redis client | `ioredis` | Shared Redis connection for BullMQ + cache + rate limiting + JWT denylist |
| Rate limiting | `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` | Per-IP rate limits: 10/min auth, 5/min upload, 200/min general (BL-41). Redis store keeps counters consistent across restarts. |
| Email | `nodemailer`, `@types/nodemailer` | SMTP email via BullMQ worker — never blocks API responses (Section 14) |
| Scheduling | `@nestjs/schedule` | Cron jobs: token cleanup BL-25, premium expiry BL-26, verification cleanup BL-27, session cleanup BL-45, download record cleanup BL-58, drop firing BL-62 |
| HTTP client | `@nestjs/axios` | Call Python DSP sidecar from AudioExtractionWorker (BL-37A) |
| Security headers | `helmet` | Sets secure HTTP headers on all responses |
| Config | `@nestjs/config` | `.env` management, typed config service |
| HMAC (payments) | Node.js built-in `crypto` | VNPay HMAC-SHA512 (BL-20, BL-21), MoMo HMAC-SHA256 (BL-76, BL-77) — no external payment SDK |

---

## Frontend — Next.js

| Concern | Package | Justification |
|---|---|---|
| Framework | `next` (App Router) | SSR for public pages (artist profiles, drop teasers, home) — SEO + performance; CSR for app pages |
| Styling | `tailwindcss`, `shadcn/ui` | Utility-first CSS + accessible component primitives, consistent design system |
| Global state | `zustand` | **All shared client-side state** lives in Zustand stores — never in component `useState` if the state is needed across multiple components. Stores: `useAuthStore` (current user, roles, premium status), `usePlayerStore` (current song, playing/paused, progress, volume, muted), `useQueueStore` (ordered queue items, smart order toggle — BL-37C), `useLocaleStore` (active locale for programmatic switching). |
| API fetching & caching | `@tanstack/react-query` | **All server data** goes through `useQuery` / `useMutation` — songs, playlists, albums, artists, notifications, analytics, etc. Handles caching, background refetch, optimistic updates, and `refetchInterval` polling (notification unread badge BL-82, extraction status every 3s BL-37A). `axios` instance used as the HTTP transport inside query functions. |
| HTTP transport | `axios` | Used inside React Query query functions only — not called directly. Configured with an interceptor that retries on 401 by calling `/auth/refresh` then re-fetching. |
| Forms | `react-hook-form` + `zod` | Performant uncontrolled forms + schema-based validation across all 58 screens |
| Audio player | `howler.js` | HTML5 Audio with cross-browser support, HTTP Range requests for seek (F1). Client stores `expiresAt` from stream URL response and silently refreshes 5 min before expiry. |
| Date/time | `date-fns` | Drop countdown timers (I1), timezone conversion for mood inference (BL-36B) |
| Icons | `lucide-react` | Consistent icon set across all UI |
| i18n | `next-intl` | Locale routing (`/en/...`, `/vi/...`), Server Component + Client Component support, `next/headers` locale detection, message files in `messages/en.json` + `messages/vi.json` |

---

## Python DSP Sidecar

| Concern | Package | Notes |
|---|---|---|
| HTTP server | `fastapi` + `uvicorn` | Lightweight async API, single endpoint |
| BPM detection | `librosa` | `beat.beat_track()` — auto-extracted, artist-overridable (BL-37A) |
| Key detection | `librosa` + custom mapping | `feature.chroma_cqt()` → pitch class → mapped to Camelot Wheel notation |
| Energy calculation | `librosa` | RMS energy + spectral centroid — saved to DB silently, never shown to artist (BL-37A) |
| Audio I/O | `requests` | Streams audio from a presigned MinIO URL into memory — no MinIO SDK needed in Python |

**Contract:** `POST /extract` → `{ audioUrl: string }` → `{ bpm: number, camelotKey: string, energy: number }`

---

## Infrastructure

| Service | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL | Primary data store — TypeORM entities |
| Cache + Queue broker | Redis | BullMQ job queues, recommendation cache, JWT denylist, rate limit counters |
| Object storage | MinIO | Audio files (streaming + encrypted), cover art, avatars |
| Email | SMTP + Nodemailer | Async email delivery via BullMQ (Section 14 templates) |
