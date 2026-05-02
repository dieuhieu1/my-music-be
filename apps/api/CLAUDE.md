## Project Identity

NestJS 10 backend for **MyMusic** — self-hosted Spotify alternative, 20–200 users.
Monorepo root: `my-music/`. Siblings: `apps/web` (Next.js, port 3000), `apps/dsp` (Python FastAPI, port 5000).
API: port 3001, global prefix `/api/v1`. Entry: `src/main.ts`.

---

## Stack Snapshot

| Layer | Technology | Key config |
|-------|-----------|-----------|
| Framework | NestJS 10 + Express | `src/app.module.ts` |
| ORM | TypeORM 0.3 | `autoLoadEntities: true`; dev: `synchronize: true`; prod: migrations only |
| DB | PostgreSQL 16 | `src/config/database.config.ts` |
| Queue / Cache | BullMQ + Redis 7 | `src/modules/queue/queue.module.ts` — `@Global()` |
| Storage | AWS S3 (`@aws-sdk/client-s3` v3) | buckets: `mymusic-audio` (private), `mymusic-audio-enc` (private), `mymusic-images` (public-read); config: `src/config/storage.config.ts` |
| Auth | Passport JWT | httpOnly cookies: `access_token` 15 min, `refresh_token` 30 days |
| Email | Nodemailer + Gmail SMTP | App Password auth; transport: `smtp.gmail.com:587` STARTTLS; config: `src/config/mail.config.ts` |
| DSP sidecar | Python FastAPI | `DSP_URL` env, `/extract` endpoint |
| Cron | `@nestjs/schedule` | `ScheduleModule.forRoot()` in AppModule |
| Migrations | TypeORM CLI | `src/database/data-source.ts`; folder: `src/database/migrations/` |

---

## Completed Phases

- ✅ Phase 1 — Infrastructure + App Shell
- ✅ Phase 2 — Auth & Sessions
- ✅ Phase 3 — User & Artist Profiles
- ✅ Phase 4A — Content Upload & DSP Processing
- ✅ Phase 4B — Admin Approval & Moderation
- ✅ Phase 5 — Browse, Search & Streaming
- ✅ Phase 6 — Playlists & Social Feed
- ✅ Phase 7 — Payments & Premium Downloads
- ✅ Phase 8 — Drops & Notifications
- ✅ Phase 9 — Reports, Analytics & Admin Tools
- ⬜ Phase 10 — Recommendations, Mood Engine & AI Chat

---

## Module Map

```
src/modules/
  auth/               User, Session, VerificationCode, PasswordReset — Phase 2
  users/              User CRUD + avatar — Phase 3
  artist-profile/     ArtistProfile bio/social — Phase 3
  songs/              Upload, DSP enqueue, Song/EncryptionKey/DailyStats — Phase 4A
  albums/             Album + AlbumSong junction — Phase 4A
  genres/             Genre CRUD + GenreSuggestion workflow — Phase 4B
  admin/              Song approval state machine, genre moderation — Phase 4B
  audit/              AuditLog entity + AuditService — Phase 4B
  notifications/      Notification entity + service + controller — Phase 4B/8
  playback/           Presigned stream URLs, PlayHistory, QueueItem — Phase 5
  search/             Full-text across songs/albums/artists — Phase 5
  playlists/          Playlist/PlaylistSong/SavedPlaylist — Phase 6
  feed/               FeedEvent entity + createEvent() — Phase 6/8
  follow/             Follow entity — Phase 6
  downloads/          DownloadRecord, download endpoint — Phase 7
  payments/           PaymentRecord, VNPay/MoMo callbacks — Phase 7
  drops/              DropNotification, drop lifecycle, teaser, cron — Phase 8
  health/             GET /health + Redis indicator
  storage/            MinIO wrapper (upload + presigned URL)
  mail/               Nodemailer templates + EmailWorker
  queue/              BullMQ queue registration + workers
```

**Note:** `artist-profile` entity lives in `auth/entities/artist-profile.entity.ts`, NOT `artist-profile/entities/`.

---

## Guard Execution Order

Per request, in order:

1. `ThrottlerGuard` — rate limit (Redis-backed; 200/min general, 10/min auth, 5/min upload)
2. `JwtAuthGuard` — global; reads `access_token` cookie; `@Public()` bypasses both 2 and 3
3. `EmailVerifiedGuard` — global; `@SkipEmailVerified()` bypasses
4. `RolesGuard` — activates only when `@Roles()` decorator is present on handler
5. `ValidationPipe` — `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`
6. Controller method
7. Service — all BL + ownership check (BL-50)
8. `TransformInterceptor` — wraps response on the way out
9. `AuditLogInterceptor` — fires after success when `@AuditAction()` is present

**Ownership check (BL-50):** always in service:
```typescript
if (resource.userId !== user.id && !isAdmin) throw new ForbiddenException();
```

---

## Response Envelope

All endpoints — produced by `TransformInterceptor`:

```json
{ "success": true,  "data": { ... } }
{ "success": false, "data": null, "error": { "code": "SNAKE_CASE_CODE", "message": "..." } }
```

Paginated lists (standard shape for all list endpoints):
```json
{ "items": [...], "totalItems": 100, "page": 1, "size": 20, "totalPages": 5 }
```

**Pagination param name is `size` (not `limit`) for Phase 8+ endpoints.** Phase 1–7 endpoints use `limit`.

---

## Locked Decisions

- **teaserText**: never stored in DB; derived at read time in `DropsService.getTeaser()` as `"{stageName} · drops in {relative}"`
- **dropAt validation**: ISO8601 format checked in DTO; business range `now+1h ≤ dropAt ≤ now+90d` validated in service (class-validator cannot check dynamic dates)
- **drop notifications (24h/1h)**: BullMQ delayed jobs ONLY — never `@Cron`; enqueued by `AdminService.approveSong()` via `DropsService.enqueueDropJobs(song)` when song becomes SCHEDULED
- **drop job IDs**: stored on `song.dropJob24hId` and `song.dropJob1hId`; used to `.remove()` jobs on cancel/reschedule
- **reschedule limit**: one per song, tracked via `song.hasRescheduled: boolean`; second attempt → 403 `"Reschedule limit reached — contact admin"`
- **reschedule time constraint**: `new > original - 24h` AND `new ≥ now + 1h` AND `new ≤ now + 90d`
- **DROP_FIRED audit log**: `adminId = song.userId` (cron has no human actor; using a SYSTEM string would break FK constraint)
- **drop firing idempotency**: `UPDATE songs SET status='LIVE' WHERE id=? AND status='SCHEDULED'`; `affected=0` → skip (handles concurrent cron instances)
- **DropNotification records**: deleted immediately when the drop fires (within the same transaction)
- **cancel drop**: sets `status = APPROVED` (not PENDING — no re-review needed); clears `dropAt`, job IDs, opt-in records
- **notification payload jsonb**: field is `payload` in entity/DB (spec calls it `metadata`); FE reads `payload`
- **notification title/body**: auto-generated inside `NotificationsService.create()` from `type` + `payload`; existing Phase 4B callers unchanged (3-arg signature preserved)
- **email job name**: use `send-email`; legacy Phase 4B code uses `send`; both work because `EmailWorker` does not filter on job name
- **play count increment**: `listenCount` on `song` incremented only via `POST /playback/:songId/play` at ≥30 s mark from FE — never on list/browse endpoints
- **PREMIUM role**: stored in `user_roles` join table alongside USER/ARTIST/ADMIN — not a separate table
- **song energy field**: never expose in API responses; internal DSP value only
- **encrypted file**: `song.encryptedFileUrl` is a MinIO object path; decrypt AES key from `song_encryption_keys` before use
- **DropNotificationWorker location**: `DropsModule.providers` — NOT in `QueueModule`; it depends on DropsModule entities
- **recommendations query count**: 7 queries per general-rec compute, zero loops — play_history (1), played-song metadata (1), liked-song IDs (2 — playlist + playlist_songs), candidate songs+artist JOIN (1), genre batch (1). N+1 enforced at query layer, not application logic.
- **song.energy in recommendations**: stripped inside `toDto()` in `RecommendationsService` — never reaches any `SongRecommendationDto` instance or any API response
- **recommendations size param**: values > 50 silently clamped to 50; no 422 thrown; `timeRange` values outside `7d`|`30d` → 422
- **UNIQUE(userId, mood) null-safety**: handled via `findOne` + `update/save` (not TypeORM `upsert`) — PostgreSQL standard `UNIQUE` treats each NULL as a distinct value; app-layer guard prevents duplicate general-rec rows
- **RecordPlayDto.skipped**: optional boolean, defaults `false` — backwards-compatible with all Phase 5 clients; FE must send `skipped: true` on pre-30s skip for BL-35B penalty to activate

---

## Entity Field Reference

Only non-obvious fields that caused confusion or were added mid-project.

**`song.entity.ts`:**
```
dropAt            Date | null       — timestamptz nullable; set at upload time
dropJob24hId      string | null     — BullMQ job ID for 24h advance notification
dropJob1hId       string | null     — BullMQ job ID for 1h advance notification
hasRescheduled    boolean           — gates the one-time reschedule (BL-65)
listenCount       number default 0  — play counter; column: listen_count
encryptedFileUrl  string            — S3 object key in `mymusic-audio-enc` bucket (AES-256-CBC .enc file)
genreIds          string[]          — simple-array of Genre UUIDs
energy            number | null     — DSP composite score; NEVER expose in API
```

**`notification.entity.ts`:**
```
title     string   — auto-generated by NotificationsService.create(); column VARCHAR 255
body      string   — auto-generated by NotificationsService.create(); column TEXT
payload   jsonb    — structured metadata for FE (songId, artistName, dropAt, etc.)
isRead    boolean  — default false
readAt    Date | null
```

**`artist-profile.entity.ts`** (lives in `auth/entities/`):
```
stageName       string          — display name; used as artist label across all responses
followerCount   number default 0
listenerCount   number default 0
socialLinks     json array      — [{ platform: string, url: string }]
suggestedGenres string[]        — simple-array; nullable
```

**`drop-notification.entity.ts`:**
```
userId   string  — composite PK with songId
songId   string  — composite PK with userId
```

**`follow.entity.ts`:**
```
followerId   string  — indexed
followeeId   string  — indexed
type         'ARTIST' | 'USER'
```

**`play-history.entity.ts`:**
```
skipped   boolean default false  — true when user skipped before 30s mark (Phase 10 BL-35B)
                                   added Phase 10; column was missing before
@Index(['userId', 'songId', 'skipped'])  — composite index for skip penalty lookup
```

**`recommendation-cache.entity.ts`** (Phase 10 — `src/modules/recommendations/entities/`):
```
userId      uuid FK → users
mood        varchar nullable    — null = general recs; non-null = specific MoodType value
songs       jsonb               — SongRecommendationDto[] pre-serialized; avoids re-scoring on read
computedAt  timestamp
expiresAt   timestamp           — computedAt + 86400s
UNIQUE(userId, mood)            — null-safety handled via findOne+save in app layer
                                  (PostgreSQL standard UNIQUE treats each NULL as distinct)
```

**`user-genre-preference.entity.ts`** (Phase 10 — `src/modules/users/entities/`):
```
userId    uuid   — indexed
genreId   uuid   — FK to genres.id (not declared as ManyToOne — kept lightweight)
UNIQUE(userId, genreId)
Populated by POST /users/me/onboarding (implemented Phase 10)
Read by RecommendationsService as cold-start fallback #1 (BL-35A)
```

**`user.entity.ts`** — Phase 10 addition:
```
onboardingCompleted   boolean default false   — set true on POST /users/me/onboarding
                                               included in every buildUserResponse() call
                                               FE reads from GET /users/me to guard redirect
```

---

## Enum Values (Confirmed)

```typescript
enum SongStatus {
  PENDING | APPROVED | SCHEDULED | LIVE | REJECTED | REUPLOAD_REQUIRED | TAKEN_DOWN
}

enum NotificationType {
  SONG_APPROVED | SONG_REJECTED | SONG_REUPLOAD_REQUIRED | SONG_RESTORED
  PREMIUM_ACTIVATED | PREMIUM_REVOKED
  UPCOMING_DROP | NEW_RELEASE | DROP_CANCELLED | DROP_RESCHEDULED
}

enum FeedEventType {
  NEW_PLAYLIST | SONG_LIKED | ARTIST_FOLLOWED | NEW_RELEASE
  UPCOMING_DROP | DROP_CANCELLED | DROP_RESCHEDULED
}

enum Role { USER | ARTIST | ADMIN | PREMIUM }

enum PaymentProvider { VNPAY | MOMO | ADMIN }
enum PaymentStatus   { PENDING | SUCCESS | FAILED | REFUNDED | ADMIN_GRANTED }
enum PremiumType     { ONE_MONTH | THREE_MONTH | SIX_MONTH | TWELVE_MONTH }
enum GenreSuggestionStatus { PENDING | APPROVED | REJECTED }
enum DeviceType      { MOBILE | DESKTOP | TABLET | OTHER }
enum MoodType        { HAPPY | SAD | FOCUS | CHILL | WORKOUT }  // Phase 10 — added to common/enums.ts
```

**Song status machine:**
```
PENDING → approve (no dropAt) → LIVE
        → approve (with dropAt) → SCHEDULED
        → reject → REJECTED
        → reupload-required → REUPLOAD_REQUIRED
REUPLOAD_REQUIRED → resubmit → PENDING
SCHEDULED → cron at dropAt → LIVE
          → artist cancel → APPROVED
          → artist reschedule (1st) → SCHEDULED (new dropAt)
          → artist reschedule (2nd) → PENDING (re-approval)
LIVE → admin takedown → TAKEN_DOWN
TAKEN_DOWN → admin restore → LIVE
```

---

## Email Templates

No `.hbs` files. All email content is inline HTML returned by `MailService` methods:

| Method | Trigger |
|--------|---------|
| `verificationEmail(code)` | Registration |
| `passwordResetEmail(code)` | Forgot password |
| `accountLockedEmail()` | Brute-force lockout |
| `premiumActivatedEmail(expiresAt)` | Payment success / admin grant |
| `premiumRevokedEmail()` | Hourly expiry cron |
| `songApprovedEmail(title)` | Admin approve |
| `songRejectedEmail(title, reason)` | Admin reject |
| `songReuploadRequiredEmail(title, notes)` | Admin reupload request |
| `songRestoredEmail(title)` | Admin restore |
| `upcomingDropEmail(title, artist, dropAt, is24h)` | BullMQ drop-notify-24h / drop-notify-1h |
| `dropCancelledEmail(title, artist)` | Drop cancel (BL-63) |
| `dropRescheduledEmail(title, artist, newDropAt)` | Drop reschedule (BL-65) |

---

## BullMQ Queues and Job Names

All queues registered in `QueueModule` (`@Global()`). Workers **must** be in the `providers` array of their feature module.

| Queue constant | Queue name | Job name(s) | Worker file |
|---------------|------------|-------------|-------------|
| `QUEUE_NAMES.EMAIL` | `email` | `send-email` (legacy: `send`) | `modules/mail/workers/email.worker.ts` |
| `QUEUE_NAMES.AUDIO_EXTRACTION` | `audio-extraction` | `extract-metadata` | `modules/queue/workers/audio-extraction.worker.ts` |
| `QUEUE_NAMES.DROP_NOTIFICATION` | `drop-notification` | `drop-notify-24h`, `drop-notify-1h` | `modules/queue/workers/drop-notification.worker.ts` |
| `QUEUE_NAMES.GENRE_BULK_TAGGING` | `genre-bulk-tagging` | `bulk-tag-songs` | `modules/queue/workers/genre-bulk-tagging.worker.ts` |
| `QUEUE_NAMES.SESSION_CLEANUP` | `session-cleanup` | `cleanup-session` | `modules/queue/workers/session-cleanup.worker.ts` |
| `QUEUE_NAMES.RECOMMENDATION_BATCH` | `recommendation-batch` | `compute-batch` | `modules/recommendations/workers/recommendation-batch.worker.ts` (triggered by `@Cron`, not BullMQ job) |

**Cron schedule (all in respective services via `@Cron`):**

| Schedule | Action | Service |
|----------|--------|---------|
| `* * * * *` | Fire SCHEDULED drops → LIVE | `DropsService.fireDueDrops()` |
| `0 * * * *` | Premium expiry + cascade download revoke | `PaymentsService` |
| `0 3 * * *` | Recommendation batch compute | `RecommendationBatchWorker.runBatch()` |
| `0 3 * * *` | Hard-delete expired download records | `DownloadsService` |
| `0 0 * * *` | JWT denylist + verification code cleanup | `AuthService` |
| `0 3 * * *` | Inactive session hard-delete | `SessionCleanupWorker` |

---

## API Contract Quick Reference

### Auth (Phase 2)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | @Public | |
| POST | `/auth/login` | @Public | sets httpOnly cookies |
| POST | `/auth/logout` | JWT | revokes session + Redis denylist |
| POST | `/auth/refresh` | @Public | reads refresh_token cookie |
| POST | `/auth/forgot-password` | @Public | |
| POST | `/auth/reset-password` | @Public | |
| POST | `/auth/verify-email` | JWT | |

### Songs & Drops (Phase 4A, 8)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/songs/upload` | ARTIST | multipart; DSP enqueued async |
| GET | `/songs/:id` | JWT | |
| PATCH | `/songs/:id` | ARTIST | ownership check BL-50 |
| DELETE | `/songs/:id` | ARTIST | |
| GET | `/songs/:id/teaser` | @Public | only returns data if status=SCHEDULED |
| POST | `/songs/:id/notify` | JWT | opt-in drop notification |
| DELETE | `/songs/:id/notify` | JWT | opt-out |
| DELETE | `/songs/:id/drop` | ARTIST\|ADMIN | cancel drop → APPROVED |
| PATCH | `/songs/:id/drop` | ARTIST\|ADMIN | reschedule; body `{ dropAt: ISO8601 }` |
| GET | `/drops` | ARTIST\|ADMIN | ARTIST: own; ADMIN: all SCHEDULED |
| POST | `/songs/:id/download` | PREMIUM\|ADMIN | quota check; returns presigned .enc URL |
| GET | `/songs/downloads` | JWT | list non-revoked DownloadRecords |
| POST | `/songs/downloads/revalidate` | JWT | batch revoke if PREMIUM lapsed |
| DELETE | `/songs/downloads/:songId` | JWT | manual remove |

### Notifications (Phase 8)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/notifications` | JWT | paginated; `?page&size` |
| GET | `/notifications/unread-count` | JWT | `{ count: number }` |
| PATCH | `/notifications/read-all` | JWT | static route — must be declared before `:id/read` |
| PATCH | `/notifications/:id/read` | JWT | |

### Admin (Phase 4B + Phase 9)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/songs` | ADMIN | filterable by `status`, `search`, paginated; response includes `coverArtUrl` |
| PATCH | `/admin/songs/:id/approve` | ADMIN | PENDING → LIVE or SCHEDULED; enqueues BullMQ drop jobs if SCHEDULED |
| PATCH | `/admin/songs/:id/reject` | ADMIN | body `{ reason }` |
| PATCH | `/admin/songs/:id/reupload-required` | ADMIN | body `{ notes }` |
| PATCH | `/admin/songs/:id/restore` | ADMIN | TAKEN_DOWN → LIVE |
| PATCH | `/admin/songs/:id/takedown` | ADMIN | LIVE → TAKEN_DOWN |
| GET | `/admin/users` | ADMIN | filterable by `role`, `search`, paginated |
| GET | `/admin/users/:id` | ADMIN | single user detail |
| PATCH | `/admin/users/:id/roles` | ADMIN | body `{ roles: string[] }` |
| GET | `/admin/users/:id/sessions` | ADMIN | returns plain array of `AdminSession` |
| DELETE | `/admin/users/:id/sessions/:sessionId` | ADMIN | revoke one session |
| GET | `/admin/genres/suggestions` | ADMIN | returns **plain array** (no pagination) |
| PATCH | `/admin/genres/suggestions/:id/approve` | ADMIN | |
| PATCH | `/admin/genres/suggestions/:id/reject` | ADMIN | body `{ notes? }` |
| GET | `/admin/reports` | ADMIN | filterable by `status`, `targetType`, paginated |
| PATCH | `/admin/reports/:id/dismiss` | ADMIN | body `{ notes? }` |
| PATCH | `/admin/reports/:id/takedown` | ADMIN | body `{ notes? }` |
| GET | `/admin/audit` | ADMIN | filterable by `action`, `adminId`, `from`, `to`, paginated |
| GET | `/admin/payments` | ADMIN | filterable by `provider`, `status`, `from`, `to`, paginated |
| GET | `/admin/payments/manual-grants` | ADMIN | paginated |
| POST | `/admin/payments/grant` | ADMIN | body `{ userId, durationDays, notes? }` |
| POST | `/admin/payments/revoke` | ADMIN | body `{ userId, notes? }` — POST not DELETE |

**Admin DTO field names (confirmed from source):**

| DTO / endpoint | Field | NOT |
|----------------|-------|-----|
| `toUserSummaryDto` (users list/detail) | `name` | `displayName` |
| `getUserSessions` (sessions array) | `ip` | `ipAddress` |
| `getUserSessions` (sessions array) | `lastSeenAt` | `lastUsedAt` |
| `listPayments` | `amountVnd` | `amount` |
| `listSongsAdmin` | `createdAt` | `uploadedAt` |
| All paginated list endpoints | `totalItems` | `total` |

### Payments (Phase 7)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/payment/vn-pay` | JWT | `?premiumType=`; returns `{ paymentUrl }` |
| GET | `/payment/vn-pay/callback` | @Public | HMAC-SHA512 verify; idempotent |
| POST | `/payment/momo` | JWT | calls MoMo internally; returns `{ paymentUrl }` |
| POST | `/payment/momo/callback` | @Public | HMAC-SHA256 verify; idempotent |

### Playback (Phase 5)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/songs/:id/stream` | JWT | returns presigned MinIO URL |
| POST | `/playback/:id/play` | JWT | record play + increment `listenCount` at ≥30s |
| GET/POST/DELETE/PATCH | `/queue/*` | JWT | queue CRUD + smart order |

---

## Frontend Store Map

| Store | Key state / methods | File |
|-------|---------------------|------|
| `useAuthStore` | `user`, `roles`, `isPremium()`, `hasRole()`, `premiumStatus`, `premiumExpiryDate`, `onboardingCompleted` | `src/store/useAuthStore.ts` |
| `usePlayerStore` | `currentSong`, `isPlaying`, `volume`, `position` | `src/store/usePlayerStore.ts` |
| `useQueueStore` | `tracks`, `smartOrder` toggle | `src/store/useQueueStore.ts` |

- Stores hydrated by `AuthProvider` on mount via `GET /users/me`
- `isPremium()` in `useAuthStore` also returns `true` for ADMIN (bypasses premium gate)
- Response unwrap pattern: `res.data?.data ?? res.data` — axios interceptor may pre-unwrap envelope

---

## Infrastructure Locked Decisions (post-Phase 9 migration)

**Storage — AWS S3 via `@aws-sdk/client-s3` v3**
- SDK: `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` + `@aws-sdk/s3-request-presigner` — AWS SDK v3 only
- Config namespace: `storage.*` in `src/config/storage.config.ts`; env vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_AUDIO`, `AWS_S3_BUCKET_AUDIO_ENC`, `AWS_S3_BUCKET_IMAGES`, `AWS_S3_PRESIGN_EXPIRES_SEC`
- 3 buckets — bucket-per-type (not key prefixes): `mymusic-audio` (private), `mymusic-audio-enc` (private), `mymusic-images` (public-read)
- `StorageService.getPublicUrl()` returns a direct S3 URL (`https://{bucket}.s3.{region}.amazonaws.com/{key}`) — no signing; requires `mymusic-images` bucket to have a public-read bucket policy
- `StorageService.presignedGetObject()` returns a signed S3 URL — used for audio streaming (short TTL, BL-28) and encrypted file downloads (5 min, BL-53)
- `StorageService.getBuckets()` returns `{ audio, audioEnc, images }` — use `getBuckets().audioEnc` for encrypted download presign; never hardcode bucket names
- `StorageService` public API is unchanged — all callers (`songs`, `users`, `artist-profile`, `albums`, `downloads`, `follow`, `search`, `playlists`, `playback`) require zero changes
- MinIO is fully removed — no container in docker-compose, no `minio.config.ts` import, no `minio` npm package
- `src/config/minio.config.ts` is a dead file — delete it; never import it

**Email — Gmail SMTP via Nodemailer App Password**
- Config namespace: `mail.*` in `src/config/mail.config.ts`; env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`
- Transport: `smtp.gmail.com:587` STARTTLS (`secure: false`, `requireTLS: true`) — hardcoded in `MailService` constructor; not configurable via env
- `MailService` public API unchanged — all 13 inline HTML templates untouched, `EmailWorker` untouched, all BullMQ `emailQueue.add('send-email', …)` callers untouched
- MailHog is fully removed — no container in docker-compose, no `SMTP_HOST`/`SMTP_PORT` env vars

**docker-compose services (dev + prod)**
- Containers: `postgres`, `redis`, `api`, `dsp` only — MinIO and MailHog are gone
- AWS S3 credentials come from `.env` via `env_file: .env` on the `api` service

---

## What NOT To Do

- **NEVER** `synchronize: true` in production — migrations only
- **NEVER** return raw TypeORM entity from a controller — use mapped response objects
- **NEVER** reference `song.listener` or `song.total_plays` — the field is `song.listenCount`
- **NEVER** increment `listenCount` in a list/browse/search endpoint — only on `POST /playback/:id/play`
- **NEVER** use `@Cron` for drop 24h/1h notifications — BullMQ delayed jobs only
- **NEVER** add `teaserText` to `song.entity.ts` — derived at read time, never persisted
- **NEVER** call `MailService.send()` from a controller — queue via `emailQueue.add('send-email', ...)`
- **NEVER** directly update `song.status` via repository without transition validation — use `AdminService` / `DropsService`
- **NEVER** expose `song.energy` in any API response shape
- **NEVER** put `DropNotificationWorker` in `QueueModule` — it belongs in `DropsModule.providers`
- **NEVER** re-register the `drop-notification` queue in `DropsModule` — `QueueModule` is `@Global()` and already registers it
- **NEVER** use `dropAt` range constraint in DTO class — validate `now+1h` / `now+90d` in service only
- **NEVER** approve a TAKEN_DOWN song directly — must use the `restore` endpoint
- **NEVER** add `@Global()` to a new feature module without flagging — only infrastructure modules are global
- **NEVER** use `song.encryptedFileUrl` raw — must decrypt AES key from `song_encryption_keys` first
- **NEVER** use Tailwind `gray-*` palette in the FE — use CSS vars (`--surface`, `--muted-text`)
- **NEVER** query the DB on a Redis recommendation cache hit — keys `rec:user:{userId}:general` and `rec:user:{userId}:mood:{MOOD}` are cache-aside; return immediately on hit
- **NEVER** omit `onboardingCompleted` from `buildUserResponse()` in `UsersService` — FE `useAuthStore.AuthUser` reads it from `GET /users/me`; if absent the field is `undefined` (falsy) and every user gets redirected to onboarding on every login
- **NEVER** include `song.energy` in any DTO or response — stripped at `toDto()` in `RecommendationsService`; internal DSP value only (BL-37A)
- **NEVER** recommend non-LIVE songs — `WHERE status = 'LIVE'` enforced in `fetchCandidateSongs()` before scoring; all other statuses excluded
- **NEVER** add a 90d time range to recommendations — permanently removed (Q2 GAP decision); only `7d` and `30d` are valid

---

## Session Startup Checklist

Every new implementation session, in order:

1. Read `apps/api/CLAUDE.md` (this file) — establishes all locked decisions
2. Read the `### Phase N` section of `docs/10_implementation_plan.md` for the current phase only
3. Check `src/app.module.ts` imports array before adding a new module
4. If adding a new module: confirm no circular dep by tracing its imports chain
5. Open a source file **only** when a specific bug or field question requires it
6. After implementation: update Phase status in `docs/10_implementation_plan.md` progress tracker
