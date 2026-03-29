# Architecture
**Music Streaming App · Full-Stack**

---

## 1. System Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                           │
│                      Next.js (Port 3000)                        │
│         App Router · Server Components · Client Components      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                           API LAYER                             │
│                      NestJS (Port 3001)                         │
│      Controllers → Guards → Services → TypeORM Repositories     │
└──────┬──────────────────┬───────────────────┬───────────────────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌─────────────┐  ┌────────────────┐  ┌───────────────────────────┐
│  PostgreSQL  │  │ Redis (6379)   │  │  MinIO (Port 9000)        │
│  (Port 5432) │  │ • BullMQ broker│  │  bucket: audio            │
│  TypeORM     │  │ • Cache-aside  │  │  bucket: audio-enc        │
│              │  │ • Rate limiting│  │  bucket: images           │
│              │  │ • JWT denylist │  │  presigned URLs + Range   │
└─────────────┘  └───────┬────────┘  └───────────────────────────┘
                         │
                         ▼ BullMQ Workers
        ┌────────────────────────────────────────┐
        │             Worker Processes            │
        │  • EmailWorker       (Nodemailer/SMTP)  │
        │  • AudioExtractionWorker                │
        │  • DropNotificationWorker               │
        │  • GenreBulkTaggingWorker               │
        │  • RecommendationBatchWorker            │
        │  • SessionCleanupWorker                 │
        └─────────────────┬──────────────────────┘
                          │ HTTP POST /extract
                          ▼
              ┌───────────────────────┐
              │  Python DSP Sidecar   │
              │  FastAPI (Port 8000)  │
              │  librosa · essentia   │
              └───────────────────────┘
```

---

## 2. Next.js Route Map

Locale is the top-level dynamic segment. All routes are prefixed with `[locale]` (`/en/...`, `/vi/...`). `middleware.ts` handles both locale detection/redirect and auth cookie checks.

```
app/
  layout.tsx                         ← Root layout: QueryClientProvider, ZustandProvider, next-intl IntlProvider
  [locale]/                          ← top-level locale segment (/en/..., /vi/...)
    layout.tsx                       ← Locale layout: sets next-intl messages for this locale
    (public)/                        ← SSR, no JWT required
      page.tsx                       ← E1  Home / Landing
      artists/[id]/page.tsx          ← C1  Public Artist Profile
      songs/[id]/teaser/page.tsx     ← I1  Drop Teaser Page
      genres/page.tsx                ← E4  Genre Browsing

    (auth)/                          ← Redirect → /[locale]/browse if already logged in
      login/page.tsx                 ← A4  Login
      register/page.tsx              ← A1  User Registration + A2 Artist Registration
      forgot-password/page.tsx       ← A5  Forgot Password
      verify-reset/page.tsx          ← A6  Verify Reset Code
      reset-password/page.tsx        ← A7  Reset Password

    (app)/                           ← Redirect → /[locale]/login if no auth cookie
      layout.tsx                     ← Persistent player bar + sidebar + notification bell dropdown (H3)
      verify-email/page.tsx          ← A3  Email Verification
                                         ← Auth required, email-verified NOT required
                                         ← NestJS: POST /auth/verify-email uses @SkipEmailVerified() decorator
                                         ← Middleware must whitelist this path from EmailVerifiedGuard redirect

      profile/page.tsx               ← B1  My Profile
      profile/edit/page.tsx          ← B2  Edit User Profile
      profile/password/page.tsx      ← B3  Change Password
      profile/sessions/page.tsx      ← B4  Active Sessions
      profile/premium/page.tsx       ← B5  Premium Status

      artist/profile/page.tsx        ← C2  My Artist Profile
      artist/edit/page.tsx           ← C3  Edit Artist Profile
      artist/songs/page.tsx          ← D2  My Songs
      artist/songs/[id]/edit/page.tsx    ← D3a Edit Song Metadata
      artist/songs/[id]/resubmit/page.tsx ← D4  Resubmit Song (REUPLOAD_REQUIRED status only)
      artist/analytics/page.tsx      ← D3  Song Analytics
      artist/upload/page.tsx         ← D1  Upload Song (+ D6 extraction status inline)
      artist/drops/page.tsx          ← I2  Drop Management Dashboard

      browse/page.tsx                ← E2  Browse / Discover
      browse/search/page.tsx         ← E3  Search Results

      playlists/page.tsx             ← G1  Browse Playlists
      playlists/[id]/page.tsx        ← G2  Playlist Details
      playlists/create/page.tsx      ← G3  Create Playlist
      playlists/saved/page.tsx       ← G6  Saved Playlists
      playlists/liked/page.tsx       ← G5  Liked Songs
      playlists/mood/page.tsx        ← G7  Mood Playlist

      albums/[id]/page.tsx           ← G8  Album Details
      albums/create/page.tsx         ← G9  Create Album
      albums/[id]/edit/page.tsx      ← G10 Edit Album

      queue/page.tsx                 ← F2  Play Queue

      feed/page.tsx                  ← H1  Activity Feed
      users/[id]/page.tsx            ← H4  Other User Profile

      payment/page.tsx               ← J1  Pricing & Purchase
      payment/vnpay/page.tsx         ← J2  VNPay return URL handler (client-side, reads query params)
      payment/momo/page.tsx          ← J3  MoMo return URL handler (client-side, reads query params)

      downloads/page.tsx             ← K2  Downloaded Songs Library

      admin/layout.tsx               ← Admin role guard (redirect if not ADMIN)
      admin/page.tsx                 ← L1  Admin Dashboard
      admin/genres/page.tsx          ← L2  Genre Management
      admin/users/page.tsx           ← L3  User Management
      admin/songs/page.tsx           ← D5  Song Approval Queue
      admin/reports/page.tsx         ← L4  Content Reports & Moderation
      admin/audit/page.tsx           ← L5  Audit Log
      admin/payments/page.tsx        ← L6  Payment Records

middleware.ts
  ← Chains two middlewares in sequence:
     (1) next-intl createMiddleware() — locale detection from cookie/Accept-Language, redirect / → /en or /vi
     (2) auth check — reads access_token cookie:
           no cookie + (app) route    → redirect /[locale]/login
           has cookie + (auth) route  → redirect /[locale]/browse
```

> **Modal-only screens (no dedicated route):**
> - **H3 Notification Inbox** — bell icon dropdown in `(app)/layout.tsx`, polling `GET /notifications/unread-count`
> - **K1 Download Song** — triggered from song cards/player via `POST /songs/:id/download`, no separate page
> - **I3 Cancel Drop / I4 Reschedule Drop** — action modals inside `artist/drops/page.tsx` (I2)
> - **E5 Report Content** — inline modal triggered from song cards, playlist details (G2), artist profile (C1), user profile (H4)

---

## 3. Authentication Strategy

### Token storage
Both tokens stored as `httpOnly` cookies (set by NestJS via `Set-Cookie`). JavaScript cannot read them — prevents XSS token theft.

| Cookie | TTL | Readable by |
|---|---|---|
| `access_token` | 15 min | NestJS only (httpOnly) |
| `refresh_token` | 30 days | NestJS only (httpOnly) |

### Request flow
```
Server Component (SSR):
  cookies() from next/headers → read access_token → forward as Authorization: Bearer header to NestJS
  On NestJS 401 (token expired during SSR):
    → Server Component catches error → returns redirect response to /[locale]/login
    → Client lands on login page, user re-authenticates
    (SSR cannot trigger silent refresh — axios interceptor is client-only)

Client Component (CSR):
  axios withCredentials:true → cookies sent automatically (same-origin)
  On 401 → axios interceptor → POST /auth/refresh → new httpOnly cookies set → retry original request

Next.js middleware.ts:
  Has access_token cookie?  No  + (app) route  → redirect /[locale]/login
  Has access_token cookie?  Yes + (auth) route → redirect /[locale]/browse
  Note: middleware only checks cookie existence, NOT validity — invalid/expired tokens
        are caught by NestJS and handled per the SSR/CSR flows above
```

### JWT denylist (logout — BL-03)
On logout, NestJS extracts the `jti` claim from the access token and writes it to Redis with TTL equal to the token's remaining lifetime. `JwtAuthGuard` checks this denylist on every request before accepting a token.

```
Redis key:  jti:{jti}
Redis TTL:  token.exp - now (seconds)
```

---

## 4. Key Architectural Decisions

### 4.1 Audio streaming & quality gate (F1, BL-28)
NestJS never proxies audio bytes. It validates the request and returns a presigned MinIO URL. The client streams directly from MinIO which handles Range requests natively (seek support).

**Module owner:** `songs/` module — `GET /songs/:id/stream` (stream URL is a song-level concern).

```
GET /songs/:id/stream
  NestJS:  validate JWT
           check song.status !== SCHEDULED  → 423 if SCHEDULED (BL-60)
           check user.roles includes PREMIUM → pick hq or standard file key
           call MinIO.presignedGetObject('audio', filename, 3600s TTL)
           return { streamUrl, expiresAt }
  Client:  howler.js src = streamUrl → streams from MinIO (Range requests native)
```

**Presigned URL expiry during playback:** TTL is 1h. If a user is still playing when it expires, howler.js will fail on the next Range request. Strategy: client stores `expiresAt` from the response and silently re-fetches `GET /songs/:id/stream` 5 minutes before expiry using a `setTimeout`, then calls `howler.load()` with the new URL without interrupting playback.

### 4.2 Audio metadata extraction pipeline (BL-37A, D6)
```
POST /songs/upload
  ↓  multer buffers file
  ↓  file-type validates MIME bytes (BL-44)
  ↓  music-metadata checks duration ≤ 20 min (BL-44)
  ↓  NestJS uploads raw file to MinIO bucket: audio
  ↓  NestJS generates AES-256 .enc variant → uploads to MinIO bucket: audio-enc
  ↓  Song created with status=PENDING
  ↓  AudioExtractionJob enqueued → returns { songId, jobId }

AudioExtractionWorker (BullMQ):
  ↓  MinIO SDK → presignedGetObject('audio', songId.mp3, 600s) → audioUrl
  ↓  POST http://dsp:8000/extract  { audioUrl }
  ↓  Python: requests.get(audioUrl) → librosa BPM + Camelot Key + energy
  ↓  Worker updates song: { bpm, camelotKey, energy }
  ↓  Job marked completed

Client polls GET /songs/upload/:jobId/status every 3s (D6):
  pending/processing → keep polling
  completed → auto-fill BPM + Key fields, unlock for override
  failed     → unlock fields, show "Auto-extraction failed"
```

### 4.3 Smart Order algorithm (BL-37C)
Runs fully server-side in `PlaybackService`. On toggle ON:
1. Fetch all unplayed tracks in queue with their `{ bpm, camelotKey, energy }` metadata
2. Start from current track, greedily pick the next track with the lowest compatibility distance:
   - `score = 0.4 * normBpm + 0.4 * camelotDist + 0.2 * normEnergy`
   - `normBpm = |bpm_a - bpm_b| / 140` (max BPM diff assumed 140, range 60–200)
   - `camelotDist = 0 if adjacent/same on Camelot Wheel, else 1` (hardcoded 24-key lookup table)
   - `normEnergy = |energy_a - energy_b| / 100` (energy range 0–100)
   - Lower score = better match. Pick the track with the lowest score.
3. Persist new `position` values to `queue_items` table, store `original_position` before reorder
4. Toggle OFF: restore `original_position` order from DB

### 4.4 Live drops (BL-59–65)
```
Song approved with dropAt set:
  status = SCHEDULED
  Enqueue BullMQ delayed job: upcoming-drop-24h  (delay = dropAt - 24h - now)
  Enqueue BullMQ delayed job: upcoming-drop-1h   (delay = dropAt - 1h  - now)
  Store both jobIds on song record (for cancellation)

Drop firing cron @Cron('* * * * *') — DropsService:
  SELECT * FROM songs WHERE status='SCHEDULED' AND drop_at <= NOW()
  For each: status = LIVE, insert NEW_RELEASE FeedEvent, log to AuditLog

Cancellation (BL-63):
  bullmq.getJob(song.dropJob24hId).remove()
  bullmq.getJob(song.dropJob1hId).remove()
  status = APPROVED, dropAt = null
  Send DROP_CANCELLED notification to opted-in users
```

### 4.5 Recommendations cache-aside (BL-35)
```
Daily cron → enqueues RecommendationBatchJob:
  For each user:
    liked_genres = genres from LikedSongs + followed artists
    songs = SELECT LIVE songs WHERE genre IN liked_genres ORDER BY listener DESC LIMIT 50
    UPSERT recommendation_cache (userId, songIds jsonb, computedAt=now)
    -- songIds stored as PostgreSQL jsonb array: ["uuid1", "uuid2", ...]

GET /recommendations (per request):
  1. Redis GET rec:{userId}           → hit: return
  2. Miss: SELECT FROM recommendation_cache WHERE userId=X
  3. Redis SET rec:{userId} TTL=86400 → return
```

### 4.6 Offline downloads / DRM (BL-52–58)
```
POST /songs/:id/download:
  Check: user has PREMIUM role OR is ADMIN     (BL-52)
  Check: song.status = LIVE                    (BL-52)
  Check: downloadCount < quota                 (BL-52, BL-54)

  Retrieve: song_encryption_keys.aesKey
    -- song_encryption_keys is a SEPARATE table: (id, songId FK unique, aesKey text, createdAt)
    -- aesKey generated at upload time (AES-256-CBC), stored server-side only, never in API responses
  Wrap key:  HMAC-SHA256(aesKey + userId + DOWNLOAD_SECRET)
  Issue license JWT: { songId, userId, wrappedKey, expiresAt: now+30d }
    signed with DOWNLOAD_JWT_SECRET (separate from auth JWT secret)

  Generate presigned MinIO URL: bucket=audio-enc, TTL=5min  (one-time download)
  Create DownloadRecord
  Return: { downloadUrl, licenseJwt }
```

### 4.7 Payments (BL-20–21, BL-76–77)
```
Initiate: GET /payment/vn-pay?premiumType=1month
  NestJS builds VNPay params, sorts alphabetically, signs HMAC-SHA512
  Returns { paymentUrl } — client redirects to VNPay gateway

Callback: GET /payment/vn-pay/callback (Public, no JWT)
  1. Recompute HMAC-SHA512 over all params (excl. vnp_SecureHash)
  2. Reject 400 if hash mismatch
  3. On responseCode='00':
     DB transaction:
       user.premiumStatus = true, add PREMIUM role, set premiumExpiryDate
       INSERT payment_records
     Enqueue: send-email (PREMIUM_ACTIVATED template)
     Insert: in-app notification PREMIUM_ACTIVATED
```

---

## 5. BullMQ Job Registry

| Queue | Job | Trigger | Worker |
|---|---|---|---|
| `email` | `send-email` | Any action requiring email | `EmailWorker` → Nodemailer SMTP |
| `audio` | `extract-metadata` | Song upload or resubmit | `AudioExtractionWorker` → POST DSP sidecar |
| `drops` | `upcoming-drop-24h` | Song enters SCHEDULED (delayed) | `DropNotificationWorker` → send UPCOMING_DROP FeedEvent |
| `drops` | `upcoming-drop-1h` | Song enters SCHEDULED (delayed) | `DropNotificationWorker` → send UPCOMING_DROP FeedEvent |
| `genres` | `bulk-tag-songs` | Admin approves GenreSuggestion (BL-49) | `GenreBulkTaggingWorker` → tag all matching songs |
| `recommendations` | `compute-batch` | Daily cron (BL-35) | `RecommendationBatchWorker` → write recommendation_cache |
| `sessions` | `cleanup-session` | Session created, fires at TTL (BL-42) | `SessionCleanupWorker` → hard-delete session + refresh token |

---

## 6. Infrastructure Details

### PostgreSQL — Required Indexes
```sql
-- Drop firing cron performance (BL-62)
CREATE INDEX idx_songs_status_dropat ON songs(status, drop_at);

-- Download quota check performance (BL-54)
CREATE INDEX idx_download_records_user ON download_records(user_id, revoked_at);

-- BL-09 upsert — must be unique for ON CONFLICT
CREATE UNIQUE INDEX idx_song_daily_stats ON song_daily_stats(song_id, date);

-- Notification inbox pagination (BL-80)
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
```

### Redis Key Namespaces
```
rec:{userId}            → JSON array of songIds, TTL 24h (BL-35 cache-aside)
jti:{jti}              → "1", TTL = remaining token lifetime (JWT denylist, BL-03)
throttle:{ip}:{route}  → sliding window counter (BL-41 rate limiting)
```

### CORS & Cookie Config
- Deployment: same domain via **nginx reverse proxy** (`/api` → NestJS, `/` → Next.js)
- NestJS CORS: `origin: process.env.FRONTEND_URL, credentials: true`
- Cookie flags: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (prod), no explicit `domain`

### TypeORM
- `synchronize: false` in all environments
- Schema managed via **migration files** generated with TypeORM CLI (`typeorm migration:generate`)
- Run on deploy: `typeorm migration:run`

### MinIO Buckets
| Bucket | Contents | URL policy |
|---|---|---|
| `audio` | `{songId}.mp3` (128 kbps), `{songId}-hq.mp3` (320 kbps) | Private — NestJS presigned URL, TTL 1h |
| `audio-enc` | `{songId}.enc` (AES-256 per-song key) | Private — NestJS presigned URL, TTL 5 min (BL-53) |
| `images` | `song/{id}.jpg`, `album/{id}.jpg`, `playlist/{id}.jpg`, `avatar/{id}.jpg` | Public read — direct URL in API responses |
