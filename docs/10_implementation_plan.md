# Music Streaming App — Phased Implementation Plan

**Version 1.0 · April 2026**

> Strategy: **vertical slices** — each phase ships BE endpoints **and** the FE screens that consume them in parallel, so the feature is end-to-end testable in the browser immediately after the phase completes.
>
> Phases 1 is infrastructure-only (no user-facing feature yet). Every phase after that ends with a concrete browser test scenario.

---

## Implementation Status

| Phase | Status | Completed |
|-------|--------|-----------|
| 1 | ✅ Done | Infrastructure, Docker, NestJS scaffold, Next.js shell, health endpoint |
| 2 | ✅ Done | Auth (register, login, logout, refresh, forgot/reset password, email verify, sessions) |
| 3 | ✅ Done | User & Artist Profiles, follow/unfollow, avatar upload, public artist page |
| 4A | ✅ Done | Content Upload & DSP Processing — songs, albums, genres, AES-256 enc, audio-extraction worker |
| 4B | 🔲 Next | Admin Approval & Moderation |
| 5 | 🔲 Todo | Browse, Search & Streaming |
| 6 | 🔲 Todo | Playlists & Social Feed |
| 7 | 🔲 Todo | Payments & Premium Downloads |
| 8 | 🔲 Todo | Drops & Notifications |
| 9 | 🔲 Todo | Reports, Analytics & Admin Tools |
| 10 | 🔲 Todo | Recommendations & Mood Engine |

---

## Phase 1 — Infrastructure & App Shell ✅ COMPLETE

**BE + FE run in parallel. No user-facing feature yet.**

### Backend

#### Containerization (docker-compose.yml)

All infrastructure runs in Docker. The dev compose file starts 6 services on a shared bridge network (`mymusic-net`). All stateful services use named volumes so data survives container restarts.

| Service | Image | Ports | Health check | Purpose |
|---------|-------|-------|--------------|---------|
| `postgres` | postgres:16-alpine | 5432 | `pg_isready` | Primary datastore |
| `redis` | redis:7-alpine | 6379 | `redis-cli ping` | BullMQ broker + cache + JWT denylist + rate limit counters |
| `minio` | minio/minio | 9000 (S3 API), 9001 (console) | `curl /minio/health/live` | Object storage — audio files, encrypted `.enc`, cover art, avatars |
| `mailhog` | mailhog/mailhog | 1025 (SMTP), 8025 (UI) | — | Local SMTP trap — all emails visible at `http://localhost:8025` |
| `api` | built from `apps/api/Dockerfile` | 3001 | depends_on healthy | NestJS backend (dev: hot reload via volume mount) |
| `dsp` | built from `apps/dsp/Dockerfile` | 5000 | — | Python FastAPI audio extraction sidecar |

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
- `modules/storage/` — `StorageService` with `onModuleInit` that creates MinIO buckets (`audio`, `images`) if they don't exist; methods: `upload`, `uploadStream`, `presignedGetObject`, `deleteObject`
- `modules/queue/` — `QueueModule` (global) registers all 6 BullMQ queues by name constant; `queue.constants.ts` exports `QUEUE_NAMES`
- `modules/health/` — `GET /api/v1/health` (@Public): TypeOrmHealthIndicator DB ping + custom RedisHealthIndicator ping via ioredis
- `apps/dsp/` — FastAPI `main.py` (`GET /health`, `POST /extract`), `extract.py` (librosa BPM + Camelot Key + energy), `requirements.txt`, `Dockerfile`
- `packages/types/` — shared TypeScript enums + DTO types (consumed by `apps/web` in Phase 9+)

### Frontend

- `apps/web` scaffold: Next.js App Router, Tailwind, shadcn/ui, next-intl (en + vi)
- `middleware.ts` — locale routing + auth cookie presence check
- `store/` — `useAuthStore`, `usePlayerStore`, `useQueueStore`, `useLocaleStore`
- `lib/api/axios.ts` — axios instance + 401 → `POST /auth/refresh` → retry interceptor
- All `lib/api/*.api.ts` stub files (auth, songs, albums, playlists, users, artist, playback, recommendations, notifications, feed, drops, downloads, payments, genres, reports, admin)
- Layout shell: `(app)/layout.tsx` (Sidebar + PlayerBar placeholder + NotificationBell placeholder)
- `LanguageSwitcher.tsx`
- `messages/en.json` + `messages/vi.json` (all keys, values can be placeholder strings)

### Testable outcome

```
docker-compose up → all services healthy
GET http://localhost:3001/api/v1/health → 200 { db: "ok", redis: "ok" }
GET http://localhost:5000/health (DSP) → 200
http://localhost:3000 → Next.js app loads with empty shell, no errors
```

---

## Phase 2 — Auth & Sessions ✅ COMPLETE

**BL codes:** BL-01–08, BL-41–43, BL-46–47, BL-78–79

### Backend

**Entities** (+ migrations)

- `user.entity.ts` — roles many-to-many (`user_roles` join table), `failedAttempts`, `lockUntil`, `is_email_verified`
- `artist-profile.entity.ts` — userId FK (unique), stageName, bio, followerCount=0, socialLinks[], suggestedGenres[]
- `session.entity.ts` — deviceName, deviceType, IP, lastSeenAt, refreshTokenId, soft-delete
- `password-reset.entity.ts`
- `verification_codes` table — email, code (6-digit), expiresAt

**Modules**

- `modules/auth/` — register USER (BL-01), register ARTIST (BL-46 + BL-47 atomic), login (BL-02), logout with transaction (BL-03), refresh with rotation (BL-04), change-password (BL-05), forgot-password (BL-06), verify-code (BL-07), reset-password (BL-08), verify-email (BL-78), resend-verification (BL-79)
- `modules/auth/strategies/` — JwtStrategy (access token, httpOnly cookie), JwtRefreshStrategy
- `modules/mail/` — Nodemailer SMTP service + `workers/email.worker.ts` (BullMQ, async, never blocking API)
- `modules/queue/workers/session-cleanup.worker.ts` — hard-deletes session + refresh token at TTL (BL-42)
- Brute force protection on login: `failedAttempts`, `lockUntil`, lock email (BL-43)
- Rate limiting enforced: 10/min on auth routes (BL-41)
- Cron: expired verification code cleanup (BL-27), expired invalidated token cleanup (BL-25)

**Auth endpoints**

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
POST /auth/resend-verification-email
GET  /auth/sessions
DELETE /auth/sessions/:id
```

### Frontend

**Screens:** A1 (Register User), A2 (Register Artist), A3 (Verify Email), A4 (Login), A5 (Forgot Password), A6 (Verify Reset Code), A7 (Reset Password), B4 (Active Sessions)

- `lib/api/auth.api.ts` — all auth API calls
- Forms with react-hook-form + zod validation on every auth screen
- `useAuthStore` — hydrate user on app load from `/users/me`
- Axios 401 interceptor: silent refresh + retry (CSR flows)
- Session list + revoke UI (B4)

### Testable outcome

```
Browser test:
1. Register as USER → receive verification email (MailHog) → verify → login → session appears
2. Register as ARTIST → stageName required → verify email → login
3. Wrong password ×5 → account locked, lock email received
4. Forgot password flow → code email → verify → reset → login with new password
5. Active sessions page shows current device → revoke → logged out on next request
```

> **Definition of done — automated tests required from this phase onward.**
> Every phase must ship with:
> - **Jest API tests** covering the happy path + key edge cases for each endpoint (e.g. duplicate email, wrong password, expired code).
> - **Playwright e2e test** covering the happy path described in the browser test above.
> No phase is complete until its automated tests pass in CI.

---

## Phase 3 — User & Artist Profiles ✅ COMPLETE

**BL codes:** BL-11, BL-32, BL-66–67, BL-72–73

### Backend

**Modules**

- `modules/users/` — `PATCH /users/me` (BL-66: name, avatarUrl), `GET /users/me`, `GET /users/:id` (public)
- `modules/artist-profile/` — `GET /artists/:id/profile` (public, increments listener BL-11), `PATCH /artists/me/profile` (BL-67: stageName, bio, avatarUrl, socialLinks)
- `modules/feed/follow.entity.ts` — follow/unfollow artist + user (BL-32): `POST /artists/:id/follow`, `DELETE /artists/:id/follow`, `POST /users/:id/follow`, `DELETE /users/:id/follow`, `GET /artists/:id/followers`, `GET /users/:id/following`

**Endpoints**

```
GET    /users/me
PATCH  /users/me
GET    /users/:id
GET    /artists/:id/profile
PATCH  /artists/me/profile
POST   /artists/:id/follow
DELETE /artists/:id/follow
POST   /users/:id/follow
DELETE /users/:id/follow
```

### Frontend

**Screens:** B1 (View Profile), B2 (Edit Profile), B3 (Change Password), C1 (Public Artist Profile), C2 (Artist Edit Profile), C3 (Artist Edit Bio/Links)

- ArtistHeader, ArtistCard components
- Follow/unfollow button with optimistic update (React Query mutation)
- Avatar upload (multipart → `PATCH /users/me` or `PATCH /artists/me/profile`)

### Testable outcome

```
Browser test:
1. Edit profile → name + avatar saved → reflected immediately
2. Artist edits stageName/bio/socialLinks
3. Visit public artist profile /artists/:id → listener counter increments
4. Follow an artist → followerCount updates → unfollow resets
```

---

## Phase 4A — Content Upload & DSP Processing (Creator Flow) ✅ COMPLETE

**BL codes:** BL-37A, BL-39, BL-44, BL-48, BL-14, BL-18

> Focus: getting the file from the browser, validating it, storing it securely, and extracting audio metadata. The song ends in `PENDING` — ready for admin review in Phase 4B.

### Backend

**Entities** (+ migrations)

- `song.entity.ts` — status (SongStatus enum), title, duration, fileUrl, encryptedFileUrl, coverArtUrl, genreIds[], bpm, camelotKey, energy, dropAt, reuploadReason, listenCount
- `song-encryption-key.entity.ts` — songId FK, aesKey (stored encrypted)
- `song-daily-stats.entity.ts` — (songId, date) unique, playCount
- `album.entity.ts`, `album-song.entity.ts`
- `genre.entity.ts`, `genre-suggestion.entity.ts`

**Modules**

- `modules/songs/` — `POST /songs/upload` (BL-48 role check, BL-39 quota, BL-44 magic-byte validation + duration + strip metadata, AES-256 `.enc` generation, enqueue audio extraction job), `GET /songs/:id`, `PATCH /songs/:id`, `DELETE /songs/:id`
- `modules/albums/` — CRUD, totalTracks + totalHours recompute (BL-14), cascade delete (BL-18)
- `workers/audio-extraction.worker.ts` — POST DSP `/extract`, save BPM/camelotKey/energy to DB; energy is never exposed to artist (BL-37A)

**Endpoints**

```
POST   /songs/upload
GET    /songs/:id
PATCH  /songs/:id
DELETE /songs/:id
GET    /albums
POST   /albums
GET    /albums/:id
PATCH  /albums/:id
DELETE /albums/:id
GET    /genres
```

### Frontend

**Screens:** D1 (Upload), D2 (My Songs list), D3a (Edit Song), G9 (Create Album), G10 (Edit Album)

- `UploadForm.tsx` — multipart file upload, genre suggestion multi-select, optional drop date picker
- `ExtractionStatus.tsx` — polls `GET /songs/:id` every 3s until bpm/camelotKey populated; shows skeleton on BPM/Camelot fields while DSP is processing; BPM and Camelot Key are artist-editable after extraction (BL-37A)

### Testable outcome

```
Browser test:
1. Artist uploads MP3 → file validated & encrypted → saved to MinIO
2. Song appears in D2 list with status = PENDING
3. ExtractionStatus skeleton shows on BPM/Camelot fields during processing
4. ~5s later → BPM/Camelot fields populate → artist can override BPM value
5. Upload limit enforced: non-premium artist blocked at 50 songs
6. Silently renamed .txt→.mp3 rejected via magic-byte check
```

---

## Phase 4B — Admin Approval & Moderation (Admin Flow)

**BL codes:** BL-37, BL-40, BL-49, BL-68–71, BL-83–85

> Focus: admin review queue, full approval lifecycle, audit logging, email notifications, and genre suggestion approval with retroactive bulk-tagging. Builds directly on the PENDING songs created in Phase 4A.

### Backend

**Entities**

- `audit-log.entity.ts` — adminId, action, targetType, targetId, createdAt

**Modules**

- `modules/songs/` additions — `PATCH /admin/songs/:id/approve` (BL-37), `PATCH /admin/songs/:id/reject` (BL-37), `PATCH /admin/songs/:id/reupload-required` (BL-84), `PATCH /admin/songs/:id/restore` (BL-83), `PATCH /songs/:id/resubmit` (BL-85)
- `modules/genres/` — admin approve/reject genre suggestion (BL-68–71), retroactive bulk-tagging on approval (BL-49)
- `modules/audit/` — `AuditLogInterceptor` (writes to AuditLog after any admin mutation, BL-40)
- `modules/admin/` — `GET /admin/songs?status=PENDING`, genre suggestion queue
- Email notifications on approve/reject/reupload-required (via mail worker)
- `workers/genre-bulk-tagging.worker.ts` — retroactive tag all songs matching approved genre name (BL-49)

**Endpoints**

```
GET    /admin/songs?status=PENDING
PATCH  /admin/songs/:id/approve
PATCH  /admin/songs/:id/reject
PATCH  /admin/songs/:id/reupload-required
PATCH  /admin/songs/:id/restore
PATCH  /songs/:id/resubmit
GET    /admin/genres/suggestions
PATCH  /admin/genres/suggestions/:id/approve
PATCH  /admin/genres/suggestions/:id/reject
```

### Frontend

**Screens:** D4 (Resubmit Song), D5 (Admin Song Queue), L1 (Admin Dashboard), L2 (Admin Genre Management)

- `ApprovalQueue.tsx` — admin lists PENDING songs with audio preview, approve/reject/reupload actions inline
- `AuditTable.tsx` — read-only audit log (also used in L5)
- Approval action → email arrives in MailHog with correct template

### Testable outcome

```
Browser test:
1. Admin logs in → sees PENDING songs from Phase 4A in approval queue
2. Admin approves → song status = LIVE → audit log entry created
3. Admin rejects with reason → artist receives "rejected" email (check MailHog)
4. Admin requests reupload → artist sees REUPLOAD_REQUIRED in D2 → edits + resubmits → back to PENDING
5. Artist suggests genre "Vinahouse" on upload → admin approves in L2 → BullMQ worker retroactively tags all matched songs
```

---

## Phase 5 — Browse, Search & Streaming

**BL codes:** BL-09–12, BL-22–23, BL-28, BL-30–31, BL-37C

### Backend

**Entities**

- `queue-item.entity.ts` — userId, songId, position, addedAt
- `play-history.entity.ts` — userId, songId, playedAt

**Modules**

- `modules/songs/` additions — `GET /songs` (browse, paginated, filter by genre/status=LIVE), `GET /songs/:id` (increment `listenCount` + upsert `SongDailyStats` BL-09)
- `modules/albums/` additions — `GET /albums/:id` (increment listener BL-10)
- Search — `GET /search?q=` → songs + albums + artists + playlists all four entities (BL-23)
- `modules/playback/` — `GET /songs/:id/stream` (presigned MinIO URL, 15-min expiry, BL-28), `POST /playback/history` (BL-30), queue CRUD (BL-31): `GET /queue`, `POST /queue`, `DELETE /queue/:id`, `PATCH /queue/reorder`, `DELETE /queue` (hard-delete on logout BL-03), smart order toggle (BL-37C)

**Endpoints**

```
GET /songs?page&limit&genre&q
GET /songs/:id
GET /songs/:id/stream
GET /albums?page&limit
GET /albums/:id
GET /search?q=&page&limit
GET /queue
POST /queue
PATCH /queue/reorder
DELETE /queue/:id
DELETE /queue
POST /playback/history
```

### Frontend

**Screens:** E1 (Home/Landing), E2 (Browse), E3 (Search results), E4 (Genre Browsing), F2 (Queue page)

**Components:** SongCard, SongRow, AlbumCard, AlbumGrid, HowlerPlayer, QueueDrawer, SmartOrderToggle, ProgressBar, VolumeControl, ProgressBar

- `useStreamUrl` hook — fetches presigned URL on song select, silently refreshes 5 min before expiry
- `usePlayer` hook — howler.js play/pause/seek, wired to `usePlayerStore`
- `useQueue` hook — queue manipulation helpers
- PlayerBar becomes fully functional (current song, progress, volume, queue toggle)
- HTTP Range requests for seek support (Range header on MinIO presigned URL)
- **`navigator.mediaSession` API** — set `metadata` (title, artist, artwork) and wire `actionhandler` callbacks for play, pause, previoustrack, nexttrack, seekto; this is what makes the player controllable from the OS lock screen, notification shade, and smartwatches

### Testable outcome

```
Browser test:
1. Browse page loads LIVE songs paginated
2. Search "pop" → results across songs + albums + artists + playlists
3. Click a song → PlayerBar shows title, plays audio, seek works
4. Add songs to queue → reorder → queue persists across navigation
5. Queue auto-clears on logout (BL-03)
6. listenCount increments on each GET /songs/:id
```

---

## Phase 6 — Playlists & Social Feed

**BL codes:** BL-12–17, BL-22, BL-32–34

### Backend

**Entities**

- `playlist.entity.ts` — `isLikedSongs: boolean`, isPublic, totalTracks, totalHours
- `playlist-song.entity.ts`, `saved-playlist.entity.ts`
- `follow.entity.ts` (already created in Phase 3 — extend if needed)
- `feed-event.entity.ts` — userId, actorId, eventType (NEW_SONG, NEW_ALBUM, FOLLOWING), entityId

**Modules**

- `modules/playlists/` — CRUD (BL-22), add/remove songs, totalTracks + totalHours recompute (BL-15), cascade delete (BL-17), save/unsave public playlists; `GET /playlists/:id` listener counter (BL-12); Liked Songs auto-create on first like (BL-34); TAKEN_DOWN song handling (BL-16): audio_url nullified, song still listed greyed-out
- `modules/feed/` — `GET /feed` (activity from followed artists + users, paginated, BL-33)

**Endpoints**

```
GET    /playlists?page&limit
POST   /playlists
GET    /playlists/:id
PATCH  /playlists/:id
DELETE /playlists/:id
POST   /playlists/:id/songs
DELETE /playlists/:id/songs/:songId
POST   /playlists/:id/save
DELETE /playlists/:id/save
GET    /playlists/liked
POST   /songs/:id/like
DELETE /songs/:id/like
GET    /feed
```

### Frontend

**Screens:** G1 (My Playlists), G2 (Playlist Detail), G3 (Create Playlist), G5 (Liked Songs), G6 (Saved Playlists), H1 (Activity Feed), H4 (Public User Profile)

- PlaylistCard, PlaylistGrid
- SongContextMenu — like, add to playlist, report, download (report/download wired later)
- TAKEN_DOWN song: greyed-out row, no play button, user can remove from playlist
- Feed shows follow activity in reverse chronological order

### Testable outcome

```
Browser test:
1. Create playlist → add songs → reorder → delete song
2. Like a song → Liked Songs playlist auto-created → appears under G5
3. Save another user's public playlist → appears under G6
4. Follow an artist → new song release appears in feed H1
5. TAKEN_DOWN song in playlist: greyed-out, unplayable, removable
```

---

## Phase 7 — Payments & Premium Downloads

**BL codes:** BL-20–21, BL-52–58, BL-74–77

### Backend

**Entities**

- `payment-record.entity.ts` — provider (VNPAY|MOMO), amount, status (PENDING|SUCCESS|FAILED), transactionId
- `download-record.entity.ts` — userId, songId, licenseJwt, downloadedAt, revokedAt

**Modules**

- `modules/payments/` — VNPay: `POST /payments/vnpay/initiate` (BL-20) → redirect URL; `GET /payments/vnpay/callback` (verify HMAC-SHA512, grant PREMIUM role, BL-21); MoMo: same pattern (BL-74–77); admin manual grant: `PATCH /admin/users/:id/premium` (BL-75)
- `modules/downloads/` — `POST /downloads/:songId` (PREMIUM check, 100-song quota BL-52, generate license JWT BL-53), `GET /downloads/:songId/revalidate` (BL-55), `DELETE /downloads/:songId` (BL-56), revoke all on song hard-delete (BL-16)
- `lib/utils/crypto.ts` (shared) — AES-256-CBC `.enc` generated at upload time (BL-44); license JWT decryption key delivery
- Crons: premium expiry check (BL-26), download record cleanup after 30 days (BL-58)

**Endpoints**

```
POST   /payments/vnpay/initiate
GET    /payments/vnpay/callback
POST   /payments/momo/initiate
POST   /payments/momo/callback
PATCH  /admin/users/:id/premium
POST   /downloads/:songId
GET    /downloads
GET    /downloads/:songId/revalidate
DELETE /downloads/:songId
```

### Frontend

**Screens:** B5 (Premium Upgrade), J1 (Payment Selection), J2 (VNPay), J3 (MoMo), K1 (Download Modal), K2 (Downloads Page)

- `DownloadModal.tsx` — triggered from SongContextMenu; shows download status + quota usage
- Downloads page K2 — list downloaded songs, revalidate license, remove
- `lib/utils/crypto.ts` — client-side AES-256-CBC decrypt for offline playback (Web Crypto API)
- SongContextMenu "Download" option visible only to PREMIUM users

### Testable outcome

```
Browser test:
1. Click "Upgrade to Premium" → choose VNPay → redirected → test callback → PREMIUM badge appears
2. Admin manually grants PREMIUM to a user
3. PREMIUM user downloads a song → quota shows 1/100
4. Downloaded song appears in K2 → revalidate license → remove
5. Non-premium user: download option hidden in context menu
6. Premium expiry cron fires → PREMIUM role removed → download locked
```

---

## Phase 8 — Artist Live Drops & Notifications

**BL codes:** BL-59–65, BL-80–82

### Backend

**Entities**

- `notification.entity.ts` — userId, type (NotificationType enum), payload JSON, readAt

**Modules**

- `modules/drops/` — schedule drop on upload (`dropAt` field on song, BL-59), `GET /songs/:id/teaser` (public, BL-60), `DELETE /songs/:id/drop` (cancel, BL-63), `PATCH /songs/:id/drop` (reschedule: 1st reschedule stays SCHEDULED; 2nd sets PENDING, BL-64–65), `POST /songs/:id/drop/notify` (opt-in, BL-80)
- `modules/notifications/` — `GET /notifications?page&limit` (BL-80), `GET /notifications/unread-count` (BL-82), `PATCH /notifications/:id/read` (BL-81), `PATCH /notifications/read-all`
- `workers/drop-notification.worker.ts` — sends 24h + 1h in-app notification + email to opted-in followers (BL-61)
- Cron (per-minute) — scans `SCHEDULED` songs where `dropAt <= now`, sets `LIVE`, creates `NEW_RELEASE` feed events + fires drop notification jobs (BL-62)

**Endpoints**

```
GET    /songs/:id/teaser
POST   /songs/:id/drop/notify
DELETE /songs/:id/drop
PATCH  /songs/:id/drop
GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
```

### Frontend

**Screens:** I1 (Drop Teaser Page — public), I2 (Artist My Drops list), I3 (Cancel Drop Modal), I4 (Reschedule Drop Modal), H3 (Notification Bell dropdown)

- `DropCountdown.tsx` — live countdown using date-fns
- `DropCard.tsx`, `ScheduleDropModal.tsx`, `RescheduleDropModal.tsx`, `CancelDropModal.tsx`
- `NotificationBell.tsx` — polls `GET /notifications/unread-count` every 30s (`refetchInterval`), shows unread badge, dropdown list, mark-all-read
- `useNotifications` hook

### Testable outcome

```
Browser test:
1. Artist schedules a drop 24h out → teaser page visible at /songs/:id/teaser
2. User opts in for drop notification
3. 24h/1h before dropAt → notification appears in bell + email in MailHog
4. Per-minute cron fires → song goes LIVE → followers see it in feed
5. Artist cancels drop → song stays SCHEDULED→APPROVED, no teaser
6. Artist reschedules 2nd time → song back to PENDING for admin re-approval
```

---

## Phase 9 — Reports, Analytics & Admin Tools

**BL codes:** BL-38, BL-40, BL-51, BL-68–75 (admin role mgmt)

### Backend

**Entities**

- `report.entity.ts` — reporterId, targetType (SONG|ARTIST), targetId, reason, status (PENDING|RESOLVED), resolvedBy, resolvedAt

**Modules**

- `modules/reports/` — `POST /reports` (BL-38), `GET /admin/reports?status=PENDING`, `PATCH /admin/reports/:id/resolve`
- `modules/analytics/` — `GET /artist/analytics/:songId?from&to` (aggregate `SongDailyStats` by date range, BL-51), `GET /artist/analytics/overview` (top songs, total plays)
- `modules/admin/` additions — `GET /admin/users`, `PATCH /admin/users/:id/role` (promote/demote), `GET /admin/audit` (BL-40), `GET /admin/payments` (payment records)

**Endpoints**

```
POST   /reports
GET    /admin/reports?status
PATCH  /admin/reports/:id/resolve
GET    /artist/analytics/:songId?from&to
GET    /artist/analytics/overview
GET    /admin/users?page&limit
PATCH  /admin/users/:id/role
GET    /admin/audit?page&limit
GET    /admin/payments?page&limit
```

### Frontend

**Screens:** E5 (Report Modal), D3 (Artist Analytics), L3 (Admin User Management), L4 (Admin Reports), L5 (Admin Audit Log), L6 (Admin Payments)

- `ReportModal.tsx` — triggered from SongContextMenu
- Analytics charts (D3): play count over time (recharts or similar), top performing songs
- `UserTable.tsx` — admin search users, promote/demote role, grant/revoke PREMIUM
- Admin sidebar navigation (L1–L6)

### Testable outcome

```
Browser test:
1. User right-clicks song → Report → reason submitted → admin sees it in L4
2. Admin resolves report → status = RESOLVED
3. Artist views D3 analytics → play counts by day for last 7/30 days
4. Admin promotes user to ARTIST role → user can now upload
5. Admin audit log shows all admin actions with timestamp + actor
```

---

## Phase 10 — Recommendations & Mood Engine

**BL codes:** BL-35, BL-35A, BL-36A–B

### Backend

**Entity**

- `recommendation-cache.entity.ts` — userId, songId, score, computedAt (composite PK userId+songId)

**Module**

- `modules/recommendations/` —
  - `GET /recommendations` — cache-aside: check Redis (key `recs:{userId}`, 24h TTL) → miss → fetch from DB → populate Redis → return (BL-35, BL-35A)
  - `GET /recommendations/mood?mood=&timezone=&limit=` — if `mood` omitted: infer from `timezone` (IANA) or `local_hour` (0–23) using time-of-day rules; filter songs by energy + BPM ranges matching mood; response: `{ mood, inferredMood: boolean, localHourUsed, totalItems, items: SongResponse[] }` (BL-36A–B)
- `workers/recommendation-batch.worker.ts` — daily cron: for each active user compute scores (listen history weight + followed artist weight + genre preference weight), write to `recommendation-cache` table, invalidate their Redis key

**Endpoints**

```
GET /recommendations?page&limit
GET /recommendations/mood?mood&timezone&local_hour&limit
```

### Frontend

**Screens:** G7 (Mood Playlist page), Home page recommendation sections (E1 update)

- G7 mood selector: happy | sad | focus | chill | workout + "detect from time" toggle
- Home page: "Recommended for you" row (calls `GET /recommendations`)
- "Mood mix" section on home using `GET /recommendations/mood` with user's local timezone

### Testable outcome

```
Browser test:
1. Home page shows personalized recommendations (after daily batch or manually trigger worker)
2. G7: select "workout" mood → energetic high-BPM songs returned
3. G7: omit mood + provide timezone → mood inferred from current hour → inferredMood: true in response
4. Cache hit: 2nd request returns instantly from Redis (verify via logs)
5. Force cache miss → fetches from DB → re-populates Redis
```

---

## Phase Summary

| Phase | Feature Slice                          | BE                                       | FE                               | Test in browser?                       |
| ----- | -------------------------------------- | ---------------------------------------- | -------------------------------- | -------------------------------------- |
| 1     | Infrastructure + App Shell             | NestJS scaffold, DSP, Docker             | Next.js scaffold, stores, layout | Health endpoints + blank app           |
| 2     | Auth & Sessions                        | auth module, mail worker                 | A1–A7, B4 screens                | Full auth flow + Jest + Playwright     |
| 3     | User & Artist Profiles                 | users, artist-profile, follow            | B1–B2, C1–C3                     | Edit profile, follow artist            |
| 4A    | Content Upload & DSP Processing        | songs, albums, audio-extraction worker   | D1–D2, D3a, G9–G10               | Upload → PENDING, BPM extracted        |
| 4B    | Admin Approval & Moderation            | admin, audit, genres, genre-tagging worker | D4–D5, L1–L2                   | Approve → LIVE, reject email, genre tag |
| 5     | Browse, Search & Streaming             | browse, search, playback, queue          | E1–E4, F2, PlayerBar             | Search → click → plays + lock screen  |
| 6     | Playlists & Social Feed                | playlists, liked songs, feed             | G1–G3, G5–G6, H1, H4             | Create playlist, like, feed            |
| 7     | Payments & Premium Downloads           | payments, downloads, crons               | B5, J1–J3, K1–K2                 | Pay → premium → download               |
| 8     | Drops & Notifications                  | drops, notifications, drop cron          | I1–I4, H3                        | Schedule drop → fires → notified       |
| 9     | Reports, Analytics & Admin Tools       | reports, analytics, admin CRUD           | E5, D3, L3–L6                    | Report → resolve; artist analytics     |
| 10    | Recommendations & Mood Engine          | recommendations, batch worker            | G7, E1 update                    | Mood page, home recs                   |
