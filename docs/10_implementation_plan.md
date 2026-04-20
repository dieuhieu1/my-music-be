# Music Streaming App — Phased Implementation Plan

**Version 2.0 · April 2026**

> Strategy: **vertical slices** — each phase ships BE endpoints, DSP changes (where applicable), **and** the FE screens that consume them in parallel, so the feature is end-to-end testable in the browser immediately after the phase completes.
>
> Phase 1 is infrastructure-only (no user-facing feature yet). Every phase after that ends with a concrete browser test scenario.

---

## Implementation Status

| Phase | Status | Completed |
|-------|--------|-----------|
| 1 | ✅ Done | Infrastructure, Docker, NestJS scaffold, DSP scaffold, Next.js shell, health endpoint |
| 2 | ✅ Done | Auth (register, login, logout, refresh, forgot/reset password, email verify, sessions) |
| 3 | ✅ Done | User & Artist Profiles, follow/unfollow, avatar upload, genre onboarding, public artist page |
| 4A | ✅ Done | Content Upload & DSP Processing — songs, albums, genres, AES-256 enc, audio-extraction worker |
| 4B | ✅ Done | Admin Approval & Moderation — song queue, approve/reject/reupload/restore, genre suggestion approval, bulk-tagging worker, audit log, email notifications, resubmit flow |
| 5 | ✅ Done | Browse, Search & Streaming — BE + FE complete |
| 6 | ✅ Done | Playlists & Social Feed — BE + FE complete |
| 7 | 🔲 Todo | Payments & Premium Downloads |
| 8 | 🔲 Todo | Drops & Notifications |
| 9 | 🔲 Todo | Reports, Analytics & Admin Tools |
| 10 | 🔲 Todo | Recommendations, Mood Engine & AI Chat |

---

## Phase 1 — Infrastructure & App Shell ✅ COMPLETE

**BE + DSP + FE run in parallel. No user-facing feature yet.**

### Backend

#### Containerization (docker-compose.yml)

All infrastructure runs in Docker. The dev compose file starts 7 services on a shared bridge network (`mymusic-net`). All stateful services use named volumes so data survives container restarts.

| Service | Image | Ports | Health check | Purpose |
|---------|-------|-------|--------------|---------|
| `postgres` | postgres:16-alpine | 5432 | `pg_isready` | Primary datastore |
| `redis` | redis:7-alpine | 6379 | `redis-cli ping` | BullMQ broker + cache + JWT denylist + rate limit counters |
| `minio` | minio/minio | 9000 (S3 API), 9001 (console) | `curl /minio/health/live` | Object storage — audio files, encrypted `.enc`, cover art, avatars |
| `mailhog` | mailhog/mailhog | 1025 (SMTP), 8025 (UI) | — | Local SMTP trap — all emails visible at `http://localhost:8025` |
| `api` | built from `apps/api/Dockerfile` | 3001 | depends_on healthy | NestJS backend (dev: hot reload via volume mount) |
| `dsp` | built from `apps/dsp/Dockerfile` | 8000 | `GET /health` | Python FastAPI audio extraction sidecar |
| `web` | built from `apps/web/Dockerfile` | 3000 | — | Next.js frontend |

**Multi-stage Dockerfile strategy (`apps/api/Dockerfile`, build context = repo root):**
- `base` — `node:20-alpine`, installs native build tools (`python3 make g++` for bcrypt), copies workspace manifests, runs `npm install`
- `dev` — extends `base`, `COPY . .`, `CMD ["npx", "nest", "start", "--watch", "--legacy-watch"]`. In docker-compose the `src/` dir is mounted as a volume for instant hot reload without rebuilding the image.
- `build` — extends `base`, runs `npx nest build` → produces `dist/`
- `prod` — fresh `node:20-alpine`, installs only production deps, copies `dist/` from `build` stage. Used in `docker-compose.prod.yml`.

**`docker-compose.prod.yml`** — overrides for production: removes MailHog, sets real SMTP env, uses `target: prod` for the api service, enforces `restart: always`.

#### NestJS Scaffold

- Monorepo root: `package.json` (npm workspaces `apps/api`, `apps/web`, `packages/*`), `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `.gitignore`
- `apps/api/src/main.ts` — bootstrap: global prefix `/api/v1`, Helmet, CORS, global ValidationPipe (whitelist + forbidNonWhitelisted + transform), global TransformInterceptor, global GlobalExceptionFilter
- `apps/api/src/app.module.ts` — ConfigModule (global, loads all config namespaces), TypeOrmModule (async), BullModule (async), ThrottlerModule (async + Redis storage), ScheduleModule, APP_GUARD for ThrottlerGuard
- `config/` — `database.config.ts`, `redis.config.ts`, `minio.config.ts`, `jwt.config.ts`, `throttler.config.ts` (each uses `registerAs` namespace)
- `database/data-source.ts` — TypeORM CLI DataSource (used by `typeorm migration:*` scripts)
- `common/enums.ts` — all domain enums: Role, SongStatus, NotificationType, PaymentProvider, PaymentStatus, DeviceType, GenreSuggestionStatus, FeedEventType, ReportReason, ReportStatus, PremiumType
- `common/guards/` — JwtAuthGuard (shell, globally registered in Phase 2), EmailVerifiedGuard, RolesGuard
- `common/decorators/` — @CurrentUser, @Public, @Roles, @SkipEmailVerified
- `common/interceptors/` — TransformInterceptor (wraps all success responses in `{ success: true, data }`), AuditLogInterceptor (shell — implemented in Phase 4B)
- `common/filters/GlobalExceptionFilter` — formats all errors as `{ success: false, data: null, error: { code, message } }`
- `modules/storage/` — `StorageService` with `onModuleInit` that creates MinIO buckets (`audio`, `audio-enc`, `images`) if they don't exist; methods: `upload`, `uploadStream`, `presignedGetObject`, `deleteObject`
- `modules/queue/` — `QueueModule` (global) registers all BullMQ queues by name constant; `queue.constants.ts` exports `QUEUE_NAMES` (email, audio, drops, genres, recommendations, sessions)
- `modules/health/` — `GET /api/v1/health` (@Public): TypeOrmHealthIndicator DB ping + custom RedisHealthIndicator ping via ioredis
- `packages/types/` — shared TypeScript enums + DTO types (consumed by `apps/web` in Phase 9+)

### DSP

**File structure (scaffold only — stubs that compile and start):**

```
apps/dsp/
  main.py           — FastAPI app entry point
  extract.py        — extract() stub, types only
  requirements.txt  — all dependencies listed (install at image build time)
  Dockerfile        — build image, expose port 8000
```

**`apps/dsp/requirements.txt`:**
```
fastapi==0.111.0
uvicorn==0.29.0
librosa==0.10.1
requests==2.31.0
soundfile==0.12.1
numpy==1.26.4
pydantic==2.7.0
```

**`apps/dsp/Dockerfile`:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**`apps/dsp/main.py` (scaffold):**
```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from extract import extract

app = FastAPI()

class ExtractRequest(BaseModel):
    audioUrl: str

class ExtractResponse(BaseModel):
    bpm: Optional[float] = None
    camelotKey: Optional[str] = None
    energy: Optional[float] = None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract", response_model=ExtractResponse)
def extract_endpoint(body: ExtractRequest):
    return extract(body.audioUrl)
```

**`apps/dsp/extract.py` (scaffold — returns nulls until Phase 4A):**
```python
def extract(audio_url: str) -> dict:
    # Implemented in Phase 4A
    return {"bpm": None, "camelotKey": None, "energy": None}
```

### Frontend

- `apps/web` scaffold: Next.js App Router, Tailwind, shadcn/ui, next-intl (en + vi)
- `middleware.ts` — locale routing + auth cookie presence check
- `store/` — `useAuthStore`, `usePlayerStore`, `useQueueStore`, `useLocaleStore`
- `lib/api/axios.ts` — axios instance + 401 → `POST /auth/refresh` → retry interceptor
- All `lib/api/*.api.ts` stub files (auth, songs, albums, playlists, users, artist, playback, recommendations, notifications, feed, drops, downloads, payments, genres, reports, admin, ai)
- Layout shell: `(app)/layout.tsx` (Sidebar + PlayerBar placeholder + NotificationBell placeholder)
- `LanguageSwitcher.tsx`
- `messages/en.json` + `messages/vi.json` (all keys, values can be placeholder strings)

### Testable outcome

```
docker-compose up → all services healthy
GET http://localhost:3001/api/v1/health → 200 { db: "ok", redis: "ok" }
GET http://localhost:8000/health (DSP) → 200 { status: "ok" }
http://localhost:3000 → Next.js app loads with empty shell, no errors
```

---

## Phase 2 — Auth & Sessions ✅ COMPLETE

**BL codes:** BL-01–08, BL-41–43, BL-46–47, BL-78–79

### Backend

**Entities** (+ migrations)

- `user.entity.ts` — roles many-to-many (`user_roles` join table), `failedAttempts`, `lockUntil`, `isEmailVerified`
- `artist-profile.entity.ts` — userId FK (unique), stageName, bio, followerCount=0, socialLinks[], suggestedGenres[]
- `session.entity.ts` — deviceName, deviceType, IP, lastSeenAt, refreshTokenId (jti), soft-delete
- `password-reset.entity.ts` — email, code (6-digit hash), expiresAt
- `verification_codes` table — email, code (6-digit), expiresAt

**Modules**

- `modules/auth/` — register USER (BL-01), register ARTIST (BL-46 + BL-47 atomic transaction), login (BL-02), logout with transaction — invalidate jti + hard-delete queue (BL-03), refresh with rotation (BL-04), change-password (BL-05), forgot-password (BL-06), verify-code (BL-07), reset-password (BL-08), verify-email (BL-78), resend-verification (BL-79)
- `modules/auth/strategies/` — `JwtStrategy` (access token, reads from httpOnly cookie), `JwtRefreshStrategy` (refresh token cookie)
- `modules/mail/` — Nodemailer SMTP service + `workers/email.worker.ts` (BullMQ queue `email`, never blocks API thread)
- `modules/queue/workers/session-cleanup.worker.ts` — BullMQ delayed job (enqueued at session creation with 30d delay); hard-deletes session + denylist jti at TTL (BL-42)
- Brute force: `failedAttempts++` on wrong password; at 5 → set `lockUntil = now + 15min`, send lock email (BL-43)
- Rate limiting: `@Throttle(10, 60)` on all auth routes (BL-41)
- Cron `@Cron('0 0 * * *')`: delete expired verification codes (BL-27), delete expired denylisted tokens (BL-25)

**Endpoints**

```
POST /auth/register
POST /auth/register/artist
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/change-password
POST /auth/forgot-password
POST /auth/verify-code
POST /auth/reset-password
POST /auth/verify-email
POST /auth/verify-email/resend
GET  /auth/sessions
DELETE /auth/sessions/:sessionId
```

### Frontend

**Screens:** A1 (Register User), A2 (Register Artist), A3 (Verify Email), A4 (Login), A5 (Forgot Password), A6 (Verify Reset Code), A7 (Reset Password), B4 (Active Sessions)

- `lib/api/auth.api.ts` — all auth API calls
- Forms with react-hook-form + zod validation on every auth screen
- `useAuthStore` — hydrates user on app load via `GET /users/me`
- Axios 401 interceptor: silent refresh + retry (CSR flows)
- Session list + revoke UI (B4)

### Testable outcome

```
Browser test:
1. Register as USER → receive verification email (MailHog) → verify → login → session appears in B4
2. Register as ARTIST → stageName required → verify email → login
3. Wrong password ×5 → account locked for 15 min, lock email received in MailHog
4. Forgot password flow → code email → verify code → reset → login with new password
5. Active sessions page shows current device → revoke → next request returns 401
```

> **Definition of done — automated tests required from this phase onward.**
> Every phase must ship with:
> - **Jest API tests** covering the happy path + key edge cases for each endpoint (e.g. duplicate email, wrong password, expired code).
> - **Playwright e2e test** covering the happy path described in the browser test above.
> No phase is complete until its automated tests pass in CI.

---

## Phase 3 — User & Artist Profiles ✅ COMPLETE

**BL codes:** BL-11, BL-32, BL-50, BL-66–67, BL-72–73, BL-86–89

### Backend

**Entities**

- `follow.entity.ts` — followerId, followeeId, followeeType (USER|ARTIST), createdAt; unique constraint (followerId, followeeId, followeeType)
- `user-genre-preference.entity.ts` — userId, genreId, weight (incremented by listening history)

**Modules**

- `modules/users/`
  - `GET /users/me` — current user with roles
  - `PATCH /users/me` — update name, bio (BL-66)
  - `POST /users/me/avatar` — multipart upload → `sharp` center-crop to 400×400px → MinIO `images` bucket → update `avatarUrl` (BL-88)
  - `GET /users/:userId` — public profile (name, avatarUrl, followerCount, followingCount)
  - `GET /users/:userId/followers` — paginated (BL-73)
  - `GET /users/:userId/following` — paginated (BL-73)
  - `POST /users/:userId/follow` — follow user; self-follow returns 400 (BL-32)
  - `DELETE /users/:userId/follow` — unfollow user (BL-72)
  - `POST /users/me/onboarding` — select 1–10 genres, creates UserGenrePreference records (BL-86)
  - `PATCH /users/me/genres` — update genre preferences (BL-87)

- `modules/artist-profile/`
  - `GET /artists/:artistId` — public profile; increments `listenerCount` (BL-11); returns stageName, bio, avatarUrl, socialLinks, followerCount, genreIds
  - `GET /artists/me/profile` — own profile (ARTIST role required)
  - `PATCH /artists/me/profile` — update stageName, bio, socialLinks (BL-67); ownership via `@CurrentUser` (BL-50)
  - `POST /artists/me/avatar` — multipart → sharp → MinIO → update avatarUrl (BL-89)
  - `POST /artists/:artistId/follow` — follow artist (BL-32)
  - `DELETE /artists/:artistId/follow` — unfollow artist (BL-72)
  - `GET /artists/:artistId/followers` — paginated (BL-73)

**Endpoints**

```
GET    /users/me
PATCH  /users/me
POST   /users/me/avatar
POST   /users/me/onboarding
PATCH  /users/me/genres
GET    /users/:userId
GET    /users/:userId/followers
GET    /users/:userId/following
POST   /users/:userId/follow
DELETE /users/:userId/follow
GET    /artists/:artistId
GET    /artists/me/profile
PATCH  /artists/me/profile
POST   /artists/me/avatar
POST   /artists/:artistId/follow
DELETE /artists/:artistId/follow
GET    /artists/:artistId/followers
```

### Frontend

**Screens:** B1 (View Profile), B2 (Edit Profile), B3 (Change Password), C1 (Public Artist Profile), C2 (Artist Edit Profile), C3 (Artist Edit Bio/Links)

- `ArtistHeader.tsx`, `ArtistCard.tsx` — artist profile header with follower count, follow button
- Follow/unfollow button with optimistic update (increment/decrement count locally, revert on error)
- Avatar upload: `<input type="file" accept="image/*">` → `POST /users/me/avatar` or `POST /artists/me/avatar`
- Genre onboarding modal (B1 first login): multi-select genre pills, min 1 required

### Testable outcome

```
Browser test:
1. Edit profile → update name + upload avatar → changes reflected immediately
2. Artist edits stageName/bio/socialLinks → saved
3. Visit public artist profile /artists/:id → listenerCount increments
4. Follow an artist → followerCount +1 → unfollow → -1
5. Genre onboarding: select 3 genres → saved → reopen profile → genres persisted
```

---

## Phase 4A — Content Upload & DSP Processing (Creator Flow) ✅ COMPLETE

**BL codes:** BL-14, BL-18, BL-37A, BL-39, BL-44, BL-48, BL-50

> Focus: getting the file from the browser, validating it, storing it securely, and extracting audio metadata asynchronously. The song ends in `PENDING` — ready for admin review in Phase 4B.

### Backend

**Entities** (+ migrations)

- `song.entity.ts` — status (SongStatus enum default PENDING), title, artistId FK, albumId FK nullable, duration, fileUrl, encryptedFileUrl, coverArtUrl, genreIds[], bpm nullable, camelotKey nullable, energy nullable, dropAt nullable, reuploadReason nullable, listenCount=0
- `song-encryption-key.entity.ts` — songId FK (unique), encryptedAesKey (AES key itself encrypted with server secret)
- `song-daily-stats.entity.ts` — (songId, date) composite unique, playCount
- `album.entity.ts` — artistId FK, title, coverArtUrl, totalTracks=0, totalHours=0.0, listenerCount=0
- `album-song.entity.ts` — albumId FK, songId FK, position
- `genre.entity.ts` — name (unique, case-insensitive), isActive, createdAt
- `genre-suggestion.entity.ts` — songId FK, suggestedName, status (PENDING|APPROVED|REJECTED)

**Modules**

- `modules/songs/`
  - `POST /songs/upload` — role check ARTIST|ADMIN (BL-48); quota check (BL-39: non-premium 50 songs / 50 MB per file, premium 200 songs / 200 MB); magic-byte MIME validation via `file-type` + duration check via `music-metadata` max 20 min (BL-44); strip ID3 metadata; store original to MinIO `audio` bucket; generate AES-256-CBC `.enc` variant → store to `audio-enc` bucket; save `SongEncryptionKey`; create Song record status=PENDING; enqueue `audio-extraction` BullMQ job with jobId; return `{ songId, jobId }` (BL-37A)
  - `GET /songs/upload/:jobId/status` — poll extraction status; returns `{ status: 'pending'|'done'|'failed', bpm, camelotKey }` (client polls every 3s)
  - `GET /songs/:songId` — song detail, read-only (no counter increment)
  - `PATCH /songs/:songId` — update title, coverArt, bpm, camelotKey, genreIds, dropAt; ownership check (BL-50)
  - `DELETE /songs/:songId` — hard delete: remove from playlists, revoke downloads, delete MinIO objects; TAKEN_DOWN is a status not a delete (BL-16)
  - `modules/albums/` — POST/GET/PATCH/DELETE; recompute `totalTracks` and `totalHours` on song add/remove (BL-14); cascade delete all songs on album delete (BL-18)
  - `workers/audio-extraction.worker.ts` — consume `audio` queue; get presigned URL for the uploaded file (15-min TTL); `POST http://dsp:8000/extract { audioUrl }` with 120s timeout; on success: `UPDATE songs SET bpm=?, camelotKey=?, energy=? WHERE id=?`; energy is stored but **never exposed in any artist-facing API response** (BL-37A); on 422 or timeout: log failure, leave bpm/camelotKey null (artist can fill manually)

**Endpoints**

```
POST   /songs/upload
GET    /songs/upload/:jobId/status
GET    /songs/:songId
PATCH  /songs/:songId
DELETE /songs/:songId
GET    /albums
POST   /albums
GET    /albums/:albumId
PATCH  /albums/:albumId
DELETE /albums/:albumId
POST   /albums/:albumId/songs
DELETE /albums/:albumId/songs/:songId
GET    /genres
```

### DSP

**Full implementation of `apps/dsp/extract.py`** (replaces Phase 1 stub):

```python
import io
import requests
import librosa
import numpy as np

# Camelot Wheel — major keys (pitch class 0=C, 1=C#, ..., 11=B)
CAMELOT_MAJOR = {
    0: "8B", 1: "3B", 2: "10B", 3: "5B", 4: "12B", 5: "7B",
    6: "2B", 7: "9B",  8: "4B", 9: "11B", 10: "6B", 11: "1B",
}
# Minor keys — same pitch classes, letter = "A"
CAMELOT_MINOR = {k: v.replace("B", "A") for k, v in CAMELOT_MAJOR.items()}

def extract(audio_url: str) -> dict:
    """
    Download audio from presigned MinIO URL and extract BPM, Camelot Key, Energy.
    Raises HTTPException(422) if audio is unreadable — NestJS worker treats as soft failure.
    """
    try:
        r = requests.get(audio_url, timeout=60)
        r.raise_for_status()
        audio_bytes = r.content
    except Exception as e:
        raise ValueError(f"Failed to download audio: {e}")

    try:
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=22050, mono=True, duration=300)
    except Exception as e:
        raise ValueError(f"Failed to decode audio: {e}")

    # --- BPM ---
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = round(float(np.atleast_1d(tempo)[0]), 1)

    # --- Camelot Key ---
    # Use chroma_cqt; find dominant pitch class; determine major vs minor via tonnetz
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    pitch_class = int(chroma.mean(axis=1).argmax())
    # Simple major/minor discrimination: compare harmonic vs percussive energy distribution
    y_harm, _ = librosa.effects.hpss(y)
    tonnetz = librosa.feature.tonnetz(y=y_harm, sr=sr)
    is_minor = float(tonnetz[1].mean()) < 0  # negative 5th-axis mean → minor tendency
    camelot_key = CAMELOT_MINOR[pitch_class] if is_minor else CAMELOT_MAJOR[pitch_class]

    # --- Energy (0–100) ---
    rms = float(librosa.feature.rms(y=y).mean())
    centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    # Normalize: RMS typically 0.01–0.3; centroid typically 500–5000 Hz
    energy = round(min(100.0, (rms * 200) + (centroid / 200)), 1)

    return {"bpm": bpm, "camelotKey": camelot_key, "energy": energy}
```

**`apps/dsp/main.py` (updated — real implementation):**
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from extract import extract

app = FastAPI(title="MyMusic DSP Sidecar")

class ExtractRequest(BaseModel):
    audioUrl: str

class ExtractResponse(BaseModel):
    bpm: Optional[float]
    camelotKey: Optional[str]
    energy: Optional[float]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract", response_model=ExtractResponse)
def extract_endpoint(body: ExtractRequest):
    try:
        return extract(body.audioUrl)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
```

**NestJS `audio-extraction.worker.ts` contract with DSP:**
```
POST http://dsp:8000/extract
Body:  { "audioUrl": "<presigned MinIO URL, 15-min TTL>" }
200:   { "bpm": 128.0, "camelotKey": "8B", "energy": 72.4 }
422:   { "detail": "Failed to decode audio: ..." }  → log + leave bpm null, song stays usable
```

### Frontend

**Screens:** D1 (Upload), D2 (My Songs list), D3a (Edit Song metadata), G9 (Create Album), G10 (Edit Album)

- `UploadForm.tsx` — multipart file upload (`encType="multipart/form-data"`), genre suggestion multi-select, optional drop date picker; on submit → `POST /songs/upload` → receive `{ songId, jobId }`
- `ExtractionStatus.tsx` — after upload, polls `GET /songs/upload/:jobId/status` every 3s; shows skeleton shimmer on BPM/Camelot fields while `status === 'pending'`; on `status === 'done'` populates fields and allows artist to override BPM and Camelot Key values; energy field is hidden from all artist-facing UI (BL-37A)
- D2 list shows song status badge (PENDING / LIVE / REJECTED / REUPLOAD_REQUIRED)

### Testable outcome

```
Browser test:
1. Artist uploads MP3 → magic-byte validated → AES-256 .enc variant generated → stored to MinIO
2. Song appears in D2 list with status = PENDING and a jobId
3. ExtractionStatus skeleton shows on BPM/Camelot fields during DSP processing
4. ~5s later → DSP returns results → BPM/Camelot fields populate → artist overrides BPM to 130
5. Upload limit enforced: non-premium artist blocked at 50 songs (quota error returned)
6. File renamed .txt → .mp3 rejected via magic-byte check (not MIME type)
7. GET http://localhost:8000/extract with a valid presigned URL returns { bpm, camelotKey, energy }
```

---

## Phase 4B — Admin Approval & Moderation (Admin Flow) ✅ COMPLETE

**BL codes:** BL-37, BL-40, BL-49, BL-68–71, BL-83–85

> Focus: admin review queue, full approval lifecycle, audit logging, email notifications, and genre suggestion approval with retroactive bulk-tagging. Builds directly on the PENDING songs created in Phase 4A.

### Backend

**Entities**

- `audit-log.entity.ts` — adminId FK, action (string), targetType (SONG|GENRE|USER), targetId, metadata JSON, createdAt; immutable (no update/delete)

**Modules**

- `modules/songs/` additions
  - `PATCH /admin/songs/:songId/approve` — set status=LIVE (or SCHEDULED if dropAt set); send approval email via BullMQ; write AuditLog (BL-37)
  - `PATCH /admin/songs/:songId/reject` — set status=REJECTED, store rejectReason; send rejection email (BL-37)
  - `PATCH /admin/songs/:songId/reupload-required` — set status=REUPLOAD_REQUIRED, store reason; send reupload-required email (BL-84)
  - `PATCH /admin/songs/:songId/restore` — set status=LIVE (from TAKEN_DOWN); send restore email; write AuditLog (BL-83)
  - `PATCH /songs/:songId/resubmit` — artist resubmits REUPLOAD_REQUIRED song; set status=PENDING; re-enqueue audio-extraction job (BL-85)

- `modules/genres/`
  - `GET /admin/genres/suggestions` — list PENDING genre suggestions
  - `PATCH /admin/genres/suggestions/:id/approve` — create Genre record; set suggestion status=APPROVED; enqueue `genres` BullMQ job for retroactive bulk-tagging (BL-49, BL-68–71)
  - `PATCH /admin/genres/suggestions/:id/reject` — set status=REJECTED

- `modules/audit/`
  - `AuditLogInterceptor` — globally registered on all `PATCH /admin/*` routes; reads `@CurrentUser().id` and `request.url`; writes AuditLog after successful response (BL-40)

- `modules/admin/`
  - `GET /admin/songs?status=PENDING` — list songs pending review with pagination
  - `GET /admin/stats` — dashboard stats (pending count, active users, revenue)

- `workers/genre-bulk-tagging.worker.ts` — consume `genres` queue; for each existing Song where title/description contains approved genre name (case-insensitive), append genreId if not already present (BL-49)

**Endpoints**

```
GET    /admin/songs?status=PENDING&page&limit
PATCH  /admin/songs/:songId/approve
PATCH  /admin/songs/:songId/reject
PATCH  /admin/songs/:songId/reupload-required
PATCH  /admin/songs/:songId/restore
PATCH  /songs/:songId/resubmit
GET    /admin/genres/suggestions
PATCH  /admin/genres/suggestions/:id/approve
PATCH  /admin/genres/suggestions/:id/reject
GET    /admin/stats
```

### Frontend

**Screens:** D4 (Resubmit Song), D5 (Admin Song Queue), L1 (Admin Dashboard), L2 (Admin Genre Management)

- `ApprovalQueue.tsx` — admin lists PENDING songs with audio preview (presigned URL), inline approve/reject/reupload-required action buttons
- `AuditTable.tsx` — read-only audit log table (also reused in L5 Phase 9)
- Genre suggestion table in L2 with approve/reject per row
- Approval action → email arrives in MailHog with correct template

### Testable outcome

```
Browser test:
1. Admin logs in → D5 shows PENDING songs from Phase 4A
2. Admin approves song → status = LIVE → AuditLog entry created
3. Admin rejects with reason "lyrics explicit" → artist sees REJECTED in D2 with reason
4. Admin requests reupload → artist sees REUPLOAD_REQUIRED in D2 → edits metadata + resubmits → back to PENDING
5. Artist suggests genre "Vinahouse" on upload → admin approves in L2 → BullMQ worker retroactively tags matched songs
```

---

## Phase 5 — Browse, Search & Streaming ✅ COMPLETE

**BL codes:** BL-09–10, BL-22–23, BL-28–31, BL-37C

### Backend

**Entities**

- `playback-history.entity.ts` — userId FK, songId FK, playedAt; max 500 rows per user (delete oldest on insert when at cap, BL-29)
- `playback-state.entity.ts` — userId FK (unique), songId FK, positionSeconds, queueSnapshot JSON, updatedAt
- `queue-item.entity.ts` — userId FK, songId FK, position, addedAt

**Indexes (required for performance):**
- `idx_songs_status` on `songs(status)` — browse query
- `idx_playback_history_user` on `playback_history(userId, playedAt DESC)` — recommendation exclusions
- `idx_playback_history_song` on `playback_history(songId)` — analytics

**Modules**

- `modules/songs/` additions
  - `GET /songs?page&limit&genre&q&status` — browse LIVE songs, paginated (BL-22); filter by genreId; text search on title+artistName (BL-23)
  - `GET /songs/:songId` — song detail; **does not** increment listenCount (read-only)
  - `POST /songs/:songId/play` — **single source of truth** for play counting (BL-29); only increments `listenCount` and upserts `SongDailyStats` if the POST body includes `{ secondsPlayed }` >= 30 (BL-09); inserts into `playback_history` with FIFO 500-row cap; returns 200 OK
  - `GET /songs/:songId/stream` — validate song is LIVE (not SCHEDULED → 423 Locked); generate 1h presigned MinIO URL for `audio` bucket; return `{ streamUrl, expiresAt }` (BL-28)
  - `GET /songs/:songId/next` — next-song recommendation; see algorithm below (BL-37C prep for Phase 10)
  - `POST /songs/:songId/played` — record song as played in current session Redis SET `session:{userId}:played` (2h TTL); used for Layer 2 deduplication

- `modules/albums/` additions
  - `GET /albums/:albumId` — album detail; increments `listenerCount` (BL-10)

- `modules/search/`
  - `GET /search?q=&page&limit` — searches across all four entities: songs (LIVE only), albums, artists, playlists (public only); returns `{ songs, albums, artists, playlists }` (BL-23); excludes SCHEDULED songs from results

- `modules/playback/`
  - `GET /playback/state` — resume playback: returns `{ songId, positionSeconds, queueSnapshot }` (BL-30)
  - `POST /playback/state` — periodic state save (called every 10s by client while playing)
  - `GET /playback/queue` — current queue items ordered by position (BL-31)
  - `POST /playback/queue` — add song to queue end
  - `PATCH /playback/queue/reorder` — reorder items (body: `{ items: [{ id, newPosition }] }`)
  - `PATCH /playback/queue/smart-order` — toggle Smart Order: ON reorders unplayed tracks by audio distance score (greedy nearest-neighbor on bpm/camelotKey/energy); OFF restores original positions (BL-37C)
  - `PATCH /playback/queue/shuffle` — Fisher-Yates shuffle; stores original positions for toggle-off
  - `DELETE /playback/queue/:itemId` — remove single item
  - `DELETE /playback/queue` — hard-delete all (called on logout BL-03)

**Smart Order Algorithm (BL-37C) — server-side greedy nearest-neighbor:**
```
Score(a, b) = 0.4 × |bpmA - bpmB| / 140
            + 0.4 × camelotDist(keyA, keyB)   // 0=same, 0.5=adjacent, 1=incompatible
            + 0.2 × |energyA - energyB| / 100

Algorithm: start from currently playing song; repeatedly pick unplayed track with lowest Score; build ordered list; store original positions.
```

**Next-Song Recommendation (`GET /songs/:songId/next`) — NextSongService:**
```
1. Fetch current song (bpm, camelotKey, energy) → 422 if any field null
2. Fetch user top-3 genres from Redis profile:{userId}:genres (24h TTL; on miss, compute from liked songs)
3. Parallel fetch exclusion sets:
   Layer 1: SELECT songId FROM playback_history WHERE userId=? AND playedAt > now()-7d
   Layer 2: Redis SMEMBERS session:{userId}:played  (2h TTL)
   Layer 3: Redis LRANGE session:{userId}:recs 0 19 (last 20 recommended, 2h TTL)
   Layer 4: Redis KEYS decay:{userId}:* → read penalty values
4. Query all LIVE songs with non-null bpm/camelotKey/energy, exclude all exclusion sets
5. If pool < 5: progressive fallback — drop Layer 1 → drop Layers 1+3 → any LIVE except current
6. Score each candidate:
   finalScore = audioDistance(current, candidate)
              - (candidate.genreId in top3Genres ? 0.15 : 0)
              + min(redisDecayCount * 0.05, 0.30)
              - log10(candidate.listenCount + 1) / 100
7. Sort by finalScore ASC; pick randomly from top 5
8. Redis: LPUSH session:{userId}:recs {songId}; LTRIM to 20; INCR decay:{userId}:{songId} (7d TTL)
9. Return SongSummary { id, title, artistName, coverArtUrl, duration, bpm, camelotKey }
```

**Endpoints**

```
GET    /songs?page&limit&genre&q
GET    /songs/:songId
POST   /songs/:songId/play
GET    /songs/:songId/stream
GET    /songs/:songId/next
POST   /songs/:songId/played
GET    /albums?page&limit
GET    /albums/:albumId
GET    /search?q=&page&limit
GET    /playback/state
POST   /playback/state
GET    /playback/queue
POST   /playback/queue
PATCH  /playback/queue/reorder
PATCH  /playback/queue/smart-order
PATCH  /playback/queue/shuffle
DELETE /playback/queue/:itemId
DELETE /playback/queue
```

### Frontend

**Screens:** E1 (Home/Landing), E2 (Browse), E3 (Search results), E4 (Genre Browsing), F2 (Queue page)

**Components:** `SongCard.tsx`, `SongRow.tsx`, `AlbumCard.tsx`, `AlbumGrid.tsx`, `QueueDrawer.tsx`, `SmartOrderToggle.tsx`, `ProgressBar.tsx`, `VolumeControl.tsx`

- `useStreamUrl` hook — `GET /songs/:id/stream` on song select; `setTimeout` to re-fetch 5 min before `expiresAt`; passes URL to Howler instance
- `usePlayer` hook — Howler.js play/pause/seek/volume; calls `POST /songs/:id/play` when `secondsPlayed >= 30`; calls `GET /songs/:id/next` on track end; wires `navigator.mediaSession` (title, artist, artwork + play/pause/previoustrack/nexttrack/seekto handlers for OS lock screen)
- `useQueue` hook — queue CRUD helpers; Smart Order toggle; shuffle
- PlayerBar fully functional: circular album art + `vinyl-spin vinyl-glow` when playing, progress bar, volume, queue toggle
- HTTP Range requests for seek support (howler.js format: `['mp3']`, `html5: true`)
- `navigator.mediaSession.metadata` = new MediaMetadata with artwork from coverArtUrl

### Testable outcome

```
Browser test:
1. Browse page loads LIVE songs paginated
2. Search "pop" → results across songs + albums + artists + playlists in one response
3. Click a song → PlayerBar shows title, plays audio, seek works
4. Add songs to queue → reorder → Smart Order toggle → queue reorders by BPM compatibility
5. Queue auto-clears on logout (DELETE /playback/queue called in logout handler)
6. POST /songs/:id/play with secondsPlayed=35 → listenCount increments
7. Lock screen (mobile) shows song title/artist/artwork and responds to play/pause
```

---

## Phase 6 — Playlists & Social Feed ✅ COMPLETE

**BL codes:** BL-12–17, BL-22, BL-32–34

### Backend

**Entities**

- `playlist.entity.ts` — userId FK, title, description nullable, coverArtUrl nullable, isPublic, isLikedSongs (boolean, default false), totalTracks=0, totalHours=0.0, listenerCount=0
- `playlist-song.entity.ts` — playlistId FK, songId FK, position, addedAt; unique (playlistId, songId)
- `saved-playlist.entity.ts` — userId FK, playlistId FK, savedAt; unique (userId, playlistId)
- `feed-event.entity.ts` — actorId FK, eventType (NEW_PLAYLIST|SONG_LIKED|ARTIST_FOLLOWED|NEW_RELEASE|UPCOMING_DROP), entityId, createdAt

**Modules**

- `modules/playlists/`
  - `GET /playlists?page&limit&userId` — list own playlists (no userId) or user's public playlists (with userId) (BL-22)
  - `POST /playlists` — create; set userId = currentUser.id (BL-22)
  - `GET /playlists/:playlistId` — detail with songs; increment listenerCount (BL-12); include `isSaved` flag for current user
  - `PATCH /playlists/:playlistId` — update title/description/isPublic/coverArtUrl; ownership check (BL-50)
  - `DELETE /playlists/:playlistId` — cascade delete playlist-songs + saved-playlists; cannot delete isLikedSongs playlist (BL-17)
  - `POST /playlists/:playlistId/songs` — add song; recompute totalTracks + totalHours (BL-15)
  - `DELETE /playlists/:playlistId/songs/:songId` — remove; recompute totals (BL-15)
  - `PATCH /playlists/:playlistId/songs/reorder` — update position values
  - `POST /playlists/:playlistId/save` — save public playlist (BL-13)
  - `DELETE /playlists/:playlistId/save` — unsave
  - `GET /playlists/saved` — list saved playlists
  - `GET /playlists/liked` — returns the isLikedSongs=true playlist for current user
  - `POST /songs/:songId/like` — like a LIVE song; auto-create isLikedSongs playlist if not exists + add song (BL-34); emit SONG_LIKED FeedEvent
  - `DELETE /songs/:songId/like` — unlike; remove from isLikedSongs playlist
  - TAKEN_DOWN handling (BL-16): song stays in playlist with `isTakenDown=true`; `fileUrl` and presigned URL not returned; any user can call `DELETE /playlists/:id/songs/:songId` to remove it

- `modules/feed/`
  - `GET /feed?page&limit` — query FeedEvents where actorId in (followed users + followed artists); ordered by createdAt DESC (BL-33)

**Endpoints**

```
GET    /playlists?page&limit&userId
POST   /playlists
GET    /playlists/:playlistId
PATCH  /playlists/:playlistId
DELETE /playlists/:playlistId
POST   /playlists/:playlistId/songs
DELETE /playlists/:playlistId/songs/:songId
PATCH  /playlists/:playlistId/songs/reorder
POST   /playlists/:playlistId/save
DELETE /playlists/:playlistId/save
GET    /playlists/saved
GET    /playlists/liked
POST   /songs/:songId/like
DELETE /songs/:songId/like
GET    /feed
```

### Frontend

**Screens:** G1 (My Playlists), G2 (Playlist Detail), G3 (Create Playlist), G4 (Edit Playlist), G5 (Liked Songs), G6 (Saved Playlists), H1 (Activity Feed), H4 (Public User Profile)

- `PlaylistCard.tsx` — cover art, title, track count, link to detail
- `PlaylistGrid.tsx` — responsive grid of PlaylistCards
- `SongContextMenu.tsx` — right-click/long-press: like, add to playlist, report (wired Phase 9), download (wired Phase 7)
- G2 Playlist Detail — owner: add songs via search modal (Radix Dialog), remove songs (Trash2 on hover), greyed-out TAKEN_DOWN rows; non-owner: Heart like/unlike per LIVE song row
- Feed H1: activity timeline sorted by newest; follow events, new releases, song likes
- H4 Public User Profile: avatar, name, follower/following counts, following list, public playlists grid

### Testable outcome

```
Browser test:
1. Create playlist → add songs → reorder → remove song
2. Like a song → Liked Songs playlist auto-created → song appears in G5
3. Save another user's public playlist → appears in G6
4. Follow a user → their activity appears in H1 feed
5. TAKEN_DOWN song in playlist: greyed-out row, no play button, removable by any user
```

---

## Phase 7 — Payments & Premium Downloads

**BL codes:** BL-20–21, BL-26, BL-52–58, BL-74–77

### Backend

**Entities** (+ migrations)

- `payment-record.entity.ts` — userId FK, provider (VNPAY|MOMO|ADMIN_GRANTED), amount, premiumType (1month|3month|6month|12month), status (PENDING|SUCCESS|FAILED), transactionId (provider's txn ID), expiresAt nullable, createdAt
- `download-record.entity.ts` — userId FK, songId FK, licenseJwt (TEXT), downloadedAt, revokedAt nullable, expiresAt

**Indexes:**
- `idx_download_records_user` on `download_records(userId, revokedAt)` — quota checks

**Modules**

- `modules/payments/`
  - **VNPay (BL-20–21):**
    - `GET /payment/vn-pay?premiumType=` — build VNPay payment URL with HMAC-SHA512 signature; return `{ paymentUrl }`; create PaymentRecord status=PENDING
    - `GET /payment/vn-pay/callback` — verify `vnp_SecureHash` HMAC-SHA512; on valid: update PaymentRecord status=SUCCESS, compute `expiresAt` from premiumType, add PREMIUM role to `user_roles`; send premium-activated email; emit PREMIUM_ACTIVATED notification
  - **MoMo (BL-76–77):**
    - `GET /payment/momo?premiumType=` — create MoMo payment request, HMAC-SHA256 signature; return `{ paymentUrl }`
    - `POST /payment/momo/callback` — verify HMAC-SHA256; same grant flow as VNPay
  - **Admin manual grant (BL-74–75):**
    - `POST /admin/users/:userId/premium` — body `{ premiumType, months? }`; add PREMIUM role; create PaymentRecord provider=ADMIN_GRANTED; send email
    - `DELETE /admin/users/:userId/premium` — revoke PREMIUM role; cascade BL-56

- `modules/downloads/`
  - `POST /songs/:songId/download` — check PREMIUM|ADMIN (BL-52); check song is LIVE; quota check (BL-54: USER 100, ARTIST 200, ADMIN unlimited); fetch `SongEncryptionKey`; build licenseJwt = `JWT.sign({ songId, userId, aesKey, expiresAt: now+30d }, HMAC(userId+serverSecret))`; generate 5-min presigned URL for `.enc` file in `audio-enc` bucket; insert DownloadRecord; return `{ downloadUrl, licenseJwt }` (BL-53)
  - `GET /songs/downloads` — list all non-revoked DownloadRecords for current user with `{ songId, title, downloadedAt, expiresAt, revokedAt }` (BL-54)
  - `POST /songs/downloads/revalidate` — batch revalidate on app open: for each active DownloadRecord, check if PREMIUM still active; if lapsed set revokedAt (BL-55)
  - `DELETE /songs/downloads/:songId` — manual remove; set revokedAt=now (BL-57)

- **Crons:**
  - `@Cron('0 * * * *')` hourly — premium expiry: find users where `payment_records.expiresAt <= now AND status=SUCCESS`; remove PREMIUM from `user_roles`; set revokedAt on all DownloadRecords (BL-26, BL-56)
  - `@Cron('0 3 * * *')` daily 3AM — hard-delete DownloadRecords where `revokedAt <= now - 7d` (BL-58 grace period)

**Endpoints**

```
GET    /payment/vn-pay?premiumType=
GET    /payment/vn-pay/callback
GET    /payment/momo?premiumType=
POST   /payment/momo/callback
POST   /admin/users/:userId/premium
DELETE /admin/users/:userId/premium
POST   /songs/:songId/download
GET    /songs/downloads
POST   /songs/downloads/revalidate
DELETE /songs/downloads/:songId
```

**Premium pricing:**
| Plan | Price (VND) |
|------|-------------|
| 1 month | 30,000 |
| 3 months | 79,000 |
| 6 months | 169,000 |
| 12 months | 349,000 |

### Frontend

**Screens:** B5 (Premium Upgrade page), J1 (Payment Selection), J2 (VNPay redirect page), J3 (MoMo redirect page), K1 (Download Modal), K2 (Downloads Page)

- `PremiumBadge.tsx` — shown in header when `user.isPremium`
- B5 pricing table — 4 plan cards with price, duration; CTA → J1
- J1 Payment Selection — VNPay vs MoMo card selection; on choose → `GET /payment/vn-pay?premiumType=` or MoMo equivalent → redirect to `paymentUrl`
- J2/J3 callback pages — show success/failure state after provider redirects back; on success auto-redirect to home
- `DownloadModal.tsx` (`K1`) — triggered from `SongContextMenu`; shows current quota (`X / 100 downloads used`); download button → `POST /songs/:songId/download` → triggers file download via anchor tag
- K2 Downloads Page — list downloaded songs with expiry date; "Revalidate" button; "Remove" button; offline playback via Web Crypto API decrypt of `.enc` file using licenseJwt's AES key
- `lib/utils/crypto.ts` (FE) — Web Crypto API AES-256-CBC decrypt: `crypto.subtle.importKey` + `crypto.subtle.decrypt`

### Testable outcome

```
Browser test:
1. Click "Upgrade to Premium" → B5 pricing → select 1 month VNPay → redirected to VNPay test page
2. Complete VNPay test payment → callback fires → PREMIUM badge appears in header
3. Admin manually grants PREMIUM via admin panel → user gets email
4. PREMIUM user clicks Download on a song → quota shows 1/100 → .enc file received
5. Downloaded songs appear in K2 → revalidate → expiry date refreshed
6. Non-premium user: download option not visible in SongContextMenu
7. Premium expiry cron fires (or manual: set expiresAt to past) → PREMIUM role removed → download option disappears
```

---

## Phase 8 — Artist Live Drops & Notifications

**BL codes:** BL-59–65, BL-80–82

### Backend

**Entities**

- `notification.entity.ts` — userId FK, type (NotificationType enum), payload JSON, readAt nullable, createdAt
- `drop-notification.entity.ts` — userId FK, songId FK; unique (userId, songId) — opt-in record

**Modules**

- `modules/drops/`
  - Drop is set via `dropAt` field on Song during upload (`POST /songs/upload`) or edit (`PATCH /songs/:id`)
  - `dropAt` constraints (BL-59): minimum now+1h, maximum now+90d
  - Song with dropAt set and status=APPROVED is automatically status=SCHEDULED
  - `GET /songs/:songId/teaser` — @Public; returns `{ id, title, artistName, coverArtUrl, dropAt, teaserText }`; returns 423 Locked on any stream attempt for SCHEDULED songs (BL-60)
  - `POST /songs/:songId/notify` — opt-in for drop notification; creates DropNotification record (BL-64)
  - `DELETE /songs/:songId/notify` — opt-out
  - `DELETE /songs/:songId/drop` — cancel drop; revert status=APPROVED; dequeue all delayed BullMQ jobs for this drop; send DROP_CANCELLED notifications to opted-in users (BL-63)
  - `PATCH /songs/:songId/drop` — reschedule; 1st time: update dropAt (must be ≥24h from original), stay SCHEDULED; 2nd time: set status=PENDING (BL-65); re-enqueue notifications for new time (BL-64)
  - `GET /drops` — list SCHEDULED songs; ARTIST sees own; ADMIN sees all

- `modules/notifications/`
  - `GET /notifications?page&limit` — ordered by createdAt DESC (BL-80)
  - `GET /notifications/unread-count` — count where readAt IS NULL (BL-82)
  - `PATCH /notifications/:notificationId/read` — set readAt=now (BL-81)
  - `PATCH /notifications/read-all` — set readAt=now for all unread

- `workers/drop-notification.worker.ts` — consume `drops` queue; on `upcoming-drop-24h` or `upcoming-drop-1h` job: fetch opted-in users + followers of the artist; create Notification records (type=UPCOMING_DROP); send email via BullMQ email queue (BL-61)

- **Drop enqueue** (in SongsService on approve/create): when song is SCHEDULED, enqueue two BullMQ delayed jobs:
  ```
  queue.add('upcoming-drop-24h', { songId }, { delay: dropAt - now - 24h })
  queue.add('upcoming-drop-1h', { songId }, { delay: dropAt - now - 1h })
  ```

- **Drop firing cron** `@Cron('* * * * *')` every minute (BL-62):
  ```
  SELECT * FROM songs WHERE status='SCHEDULED' AND drop_at <= NOW()
  → UPDATE status='LIVE'
  → INSERT FeedEvent type=NEW_RELEASE
  → Write AuditLog
  ```

**Endpoints**

```
GET    /songs/:songId/teaser
POST   /songs/:songId/notify
DELETE /songs/:songId/notify
DELETE /songs/:songId/drop
PATCH  /songs/:songId/drop
GET    /drops
GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:notificationId/read
PATCH  /notifications/read-all
```

### Frontend

**Screens:** I1 (Drop Teaser Page — public), I2 (Artist My Drops list), I3 (Cancel Drop Modal), I4 (Reschedule Drop Modal), H3 (Notification Bell dropdown)

- `DropCountdown.tsx` — live countdown using `date-fns/differenceInSeconds`, updates every second via `setInterval`
- `DropCard.tsx` — shows drop artwork, title, countdown, opt-in button
- `CancelDropModal.tsx`, `RescheduleDropModal.tsx` — confirmation dialogs with date picker for reschedule
- `NotificationBell.tsx` — icon in header; polls `GET /notifications/unread-count` every 30s; red badge when count > 0; click opens Radix Dropdown with last 10 notifications; "Mark all read" button; each item links to relevant entity
- `useNotifications` hook — wraps API calls, manages unread count state

### Testable outcome

```
Browser test:
1. Artist uploads song with dropAt = now+25h → status=SCHEDULED → teaser page visible at /songs/:id/teaser
2. User clicks "Notify me" on teaser → opt-in created
3. 24h before dropAt: Notification appears in bell + email in MailHog with "dropping tomorrow" message
4. 1h before dropAt: 2nd notification appears
5. Per-minute cron fires at dropAt → song goes LIVE → followers see NEW_RELEASE in H1 feed
6. Artist cancels drop before it fires → status reverts to APPROVED → teaser returns 404
7. Artist reschedules 2nd time → status=PENDING (needs re-approval)
```

---

## Phase 9 — Reports, Analytics & Admin Tools

**BL codes:** BL-38, BL-40, BL-51, BL-68–75

### Backend

**Entities**

- `report.entity.ts` — reporterId FK, targetType (SONG|ARTIST), targetId, reason (EXPLICIT|COPYRIGHT|INAPPROPRIATE), status (PENDING|DISMISSED|ACTIONED), resolvedBy nullable FK, resolvedAt nullable, notes nullable

**Modules**

- `modules/reports/`
  - `POST /reports` — submit report; one report per user per target (upsert on duplicate) (BL-38)
  - `GET /admin/reports?status&targetType&page&limit` — admin list
  - `PATCH /admin/reports/:reportId/dismiss` — status=DISMISSED
  - `PATCH /admin/reports/:reportId/takedown` — status=ACTIONED; set song status=TAKEN_DOWN; emit SONG_TAKEN_DOWN notification to artist

- `modules/analytics/`
  - `GET /artist/analytics/overview` — total plays (all time), total plays (last 30d), top 5 songs by plays, followerCount (BL-51)
  - `GET /artist/analytics/:songId?from&to` — aggregate `SongDailyStats` by date range; returns `[{ date, playCount }]` array for charting

- `modules/admin/` additions
  - `GET /admin/users?page&limit&q` — search users by name/email
  - `GET /admin/users/:userId` — full user detail including roles and session list
  - `PATCH /admin/users/:userId/roles` — body `{ role: 'ARTIST', action: 'add'|'remove' }` (BL-75)
  - `GET /admin/users/:userId/sessions` — list user sessions
  - `DELETE /admin/users/:userId/sessions/:sessionId` — force-revoke session
  - `GET /admin/audit?page&limit&from&to&action&adminId` — immutable audit log (BL-40)
  - `GET /admin/payments?page&limit&provider&status&userId` — payment records

**Endpoints**

```
POST   /reports
GET    /admin/reports?status&targetType&page&limit
PATCH  /admin/reports/:reportId/dismiss
PATCH  /admin/reports/:reportId/takedown
GET    /artist/analytics/overview
GET    /artist/analytics/:songId?from&to
GET    /admin/users?page&limit&q
GET    /admin/users/:userId
PATCH  /admin/users/:userId/roles
GET    /admin/users/:userId/sessions
DELETE /admin/users/:userId/sessions/:sessionId
GET    /admin/audit?page&limit&from&to&action&adminId
GET    /admin/payments?page&limit&provider&status
```

### Frontend

**Screens:** E5 (Report Modal), D3 (Artist Analytics dashboard), L3 (Admin User Management), L4 (Admin Reports Queue), L5 (Admin Audit Log), L6 (Admin Payments)

- `ReportModal.tsx` — triggered from `SongContextMenu`; reason dropdown (EXPLICIT/COPYRIGHT/INAPPROPRIATE); submit → `POST /reports`
- D3 Analytics:
  - Overview stats: total plays, last 30d plays, followerCount (Playfair Display numbers)
  - Line chart: play count by day for selected song (recharts `LineChart`)
  - Top songs table: rank, title, plays, likes
- `UserTable.tsx` (L3) — search box, paginated table; role badges; promote/demote ARTIST; grant/revoke PREMIUM inline
- L4 Reports — table with reason, target link, reporter; Dismiss / Takedown action buttons
- L5 Audit Log — read-only table: admin name, action, target, timestamp; date range filter
- L6 Payments — filter by provider; amount, status, user, date; no actions (read-only)
- Admin Sidebar nav (L1–L6) persistent left panel

### Testable outcome

```
Browser test:
1. Right-click song → Report → select "COPYRIGHT" → submitted → admin sees in L4
2. Admin takes down song → song greyed-out in all playlists; artist gets notification
3. Artist views D3 → total plays, last 30d graph for top song
4. Admin promotes user to ARTIST role → user can now upload songs
5. Admin audit log L5 shows every admin action with actor + timestamp
```

---

## Phase 10 — Recommendations, Mood Engine & AI Chat

**BL codes:** BL-35, BL-35A, BL-35B, BL-36A–B

### Backend

**Entities**

- `recommendation-cache.entity.ts` — userId FK, songId FK, score FLOAT, computedAt; composite PK (userId, songId)

**Redis Keys (new in this phase):**
- `recs:{userId}` — LIST, 24h TTL — cached personalized recommendation result (JSON array)
- `profile:{userId}:genres` — STRING, 24h TTL — top-3 genre IDs as JSON array
- `session:{userId}:played` — SET, 2h TTL — songs played this session (Layer 2)
- `session:{userId}:recs` — LIST, max 20, 2h TTL — recent recommended songs (Layer 3)
- `decay:{userId}:{songId}` — STRING, 7d TTL — recommendation count for decay penalty (Layer 4)

**Modules**

- `modules/recommendations/`
  - `GET /recommendations?page&limit` — personalized recommendations (BL-35):
    1. Check Redis `recs:{userId}` → if hit: return cached array slice
    2. Cache miss: query `recommendation_cache` table for userId ordered by score
    3. If < 5 results (cold start BL-35A): fall back to global popular songs filtered by user's genre preferences
    4. Populate Redis `recs:{userId}` 24h TTL; return paginated slice

  - `GET /recommendations/mood?mood=&timezone=&local_hour=&limit=` — mood-based playlist (BL-36A–B):
    - If `mood` provided: use directly; `inferredMood=false`
    - If `mood` omitted: infer from `timezone` (IANA string) or `local_hour` (0–23):
      - 06:00–11:59 → `focus`; 12:00–17:59 → `null` (neutral); 18:00–22:59 → `chill`; 23:00–05:59 → `sad`
    - Filter LIVE songs by `MOOD_RANGES[mood]` BPM + energy thresholds:
      ```ts
      const MOOD_RANGES = {
        happy:   { bpmMin: 100, bpmMax: 160, energyMin: 60 },
        sad:     { bpmMin: 50,  bpmMax: 90,  energyMax: 40 },
        focus:   { bpmMin: 60,  bpmMax: 110, energyMin: 30, energyMax: 70 },
        chill:   { bpmMin: 60,  bpmMax: 100, energyMax: 50 },
        workout: { bpmMin: 120, bpmMax: 180, energyMin: 70 },
      };
      ```
    - Response: `{ mood, inferredMood: boolean, localHourUsed: number|null, totalItems, items: SongResponse[] }`

  - `PATCH /playback/skip` — record skipped song; add to Redis `skip:{userId}:{songId}` (permanent); exclude from recommendation candidate pool (BL-35B)

  - `workers/recommendation-batch.worker.ts` — daily cron `@Cron('0 2 * * *')`:
    1. For each user with ≥1 play in last 30d:
    2. Fetch user's top genres (from liked songs + playback history genre weights)
    3. Score all LIVE songs: `score = genreMatch * 0.4 + followerBoost * 0.3 + recencyBoost * 0.2 + novelty * 0.1`
    4. Write top-200 to `recommendation_cache` (upsert)
    5. Delete Redis `recs:{userId}` key (invalidate cache)

**Endpoints**

```
GET    /recommendations?page&limit
GET    /recommendations/mood?mood&timezone&local_hour&limit
PATCH  /playback/skip
POST   /ai/chat
```

### DSP — No New Endpoint

Mood filtering is done server-side in NestJS using the `bpm` and `energy` columns already populated in Phase 4A. No DSP changes required in Phase 10.

### AI Chat Agent

**New module: `apps/api/src/modules/ai/`**

```
ai.module.ts            — imports SongsModule, PlaylistsModule, RecommendationsModule, PlaybackModule
ai.controller.ts        — POST /ai/chat; @UseGuards(JwtAuthGuard); @Throttle(20, 60)
ai.service.ts           — buildMessages(); runReActLoop(); buildSystemPrompt()
skills.dispatcher.ts    — dispatch(toolCall) → routes to NestJS service methods
skills.registry.ts      — Anthropic tool_use schemas (7 skills)
conversation.service.ts — Redis: LPUSH conv:{userId}:{convId}; LTRIM to 40; TTL 1h
dto/
  chat-request.dto.ts   — { message: string, conversationId?: string, timezone?: string }
  chat-response.dto.ts  — { reply: string, actions: ActionItem[], conversationId: string, tokensUsed: number }
```

**`ai.service.ts` — System prompt template (ephemeral cache):**
```ts
const systemPrompt = `You are a music assistant for MyMusic.
Current user: ${user.name} | Roles: ${user.roles.join(',')} | Premium: ${user.isPremium}
Current time: ${localTime} (${timezone})
Help users discover music, create playlists, and control playback.
Always use tools to fetch real data. Never fabricate song IDs or titles.
Confirm before creating playlists with >20 songs.
Respond concisely. Use bullet lists for song recommendations.`;
```

**`ai.service.ts` — ReAct loop:**
```ts
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
  tools: skillsRegistry,
  messages,
});

let iterations = 0;
while (iterations < 3 && response.stop_reason === 'tool_use') {
  const toolUses = response.content.filter(b => b.type === 'tool_use');
  const toolResults = await Promise.all(toolUses.map(t => dispatcher.dispatch(t)));
  messages.push({ role: 'assistant', content: response.content });
  messages.push({ role: 'user', content: toolResults.map((r, i) => ({
    type: 'tool_result', tool_use_id: toolUses[i].id, content: JSON.stringify(r)
  }))});
  const next = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024,
    system: [...], tools: skillsRegistry, messages });
  response = next;
  iterations++;
}
return response.content.find(b => b.type === 'text')?.text ?? '';
```

**`skills.registry.ts` — 7 tool schemas:**
```ts
// 1. search_songs
{ name: 'search_songs', input_schema: { q: string, genre?: string, mood?: string, bpmMin?: number, bpmMax?: number, limit?: number } }
// Returns: SongSummary[] { id, title, artistName, coverArtUrl, duration, bpm, camelotKey }

// 2. get_recommendations
{ name: 'get_recommendations', input_schema: { limit?: number } }

// 3. get_mood_playlist
{ name: 'get_mood_playlist', input_schema: { mood: 'happy'|'sad'|'focus'|'chill'|'workout', limit?: number } }

// 4. create_playlist
{ name: 'create_playlist', input_schema: { name: string, songIds?: string[], isPublic?: boolean } }
// Returns: { playlistId, title, songCount }

// 5. add_to_queue
{ name: 'add_to_queue', input_schema: { songIds: string[], playNext?: boolean } }
// Returns: { added: number }

// 6. get_artist_info
{ name: 'get_artist_info', input_schema: { artistId: string } }
// Returns: artist profile + top 5 songs

// 7. analyze_listening_history
{ name: 'analyze_listening_history', input_schema: { days: 7 | 30 } }
// Returns: { topGenres, topSongs, totalPlays, avgDailyPlays }
```

**`conversation.service.ts` — Redis history:**
```ts
// Key: conv:{userId}:{conversationId}  (conversationId = nanoid on first message)
// Value: JSON array of {role, content} message objects
// TTL: 3600s (1 hour); max 20 turn-pairs (40 messages) via LTRIM
async getHistory(userId, convId): Promise<Message[]>
async appendMessages(userId, convId, messages: Message[]): Promise<void>
```

**FE Screen: `apps/web/src/app/[locale]/(app)/ai/page.tsx` (Screen H5)**
- Chat bubble list (user right / assistant left, Playfair Display italic for AI name)
- Input field at bottom with Send button
- `conversationId` in `useState` — set on first response, passed on subsequent requests
- `actions` array rendering: if action type is `search_songs` → render horizontal SongCard row below AI bubble
- Loading state: typing indicator (3 dots bouncing via CSS animation)

### Testable outcome

```
Browser test:
1. Home page "Recommended for you" section shows personalized songs (trigger batch worker manually)
2. G7 Mood page: select "workout" → energetic high-BPM songs appear
3. G7: no mood selected + timezone provided → mood inferred → inferredMood=true in response header log
4. Redis cache hit: 2nd GET /recommendations returns in <10ms (verify via response time)
5. Skip a song (PATCH /playback/skip) → re-fetch /songs/:id/next → skipped song never appears
6. AI chat: "Play some focus music for coding" → assistant calls get_mood_playlist(mood=focus) → queue updated → song plays
7. AI chat: "Create a playlist with 5 chill songs" → create_playlist called → playlist appears in G1
```

---

## Phase Summary

| Phase | Feature Slice | BE | DSP | FE | Test in browser? |
|-------|--------------|-----|-----|-----|-----------------|
| 1 | Infrastructure + App Shell | NestJS scaffold, Docker | Scaffold: GET /health, POST /extract stub | Next.js scaffold, stores, layout | Health endpoints + blank app |
| 2 | Auth & Sessions | auth module, mail worker | — | A1–A7, B4 screens | Full auth flow + Jest + Playwright |
| 3 | User & Artist Profiles | users, artist-profile, follow, onboarding | — | B1–B3, C1–C3 | Edit profile, follow, genre onboarding |
| 4A | Content Upload & DSP Processing | songs, albums, audio-extraction worker | Full extract.py: BPM + Camelot + Energy | D1–D2, D3a, G9–G10 | Upload → PENDING, BPM extracted from DSP |
| 4B | Admin Approval & Moderation | admin, audit, genres, bulk-tag worker | — | D4–D5, L1–L2 | Approve → LIVE, reject email, genre tag |
| 5 | Browse, Search & Streaming | browse, search, playback, queue, next-song | — | E1–E4, F2, PlayerBar | Search → click → plays + OS lock screen |
| 6 | Playlists & Social Feed | playlists, liked songs, feed | — | G1–G6, H1, H4 | Create playlist, like, feed, add songs modal |
| 7 | Payments & Premium Downloads | payments, downloads, crons | — | B5, J1–J3, K1–K2 | Pay → premium → download |
| 8 | Drops & Notifications | drops, notifications, drop cron | — | I1–I4, H3 | Schedule drop → fires → notified |
| 9 | Reports, Analytics & Admin Tools | reports, analytics, admin CRUD | — | E5, D3, L3–L6 | Report → resolve; artist analytics charts |
| 10 | Recommendations, Mood & AI Chat | recommendations, batch worker, AI module | Mood ranges (NestJS only, no DSP change) | G7, E1 update, H5 AI chat | Mood page, home recs, chat creates playlist |
