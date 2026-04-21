## Project Overview

NestJS 10 backend for MyMusic — self-hosted streaming platform (20–200 users). Monorepo sibling of `apps/web` and `apps/dsp`.

- **Framework:** NestJS 10 + Express
- **ORM:** TypeORM 0.3 (PostgreSQL)
- **Cache / Queue / Denylist:** Redis via ioredis + BullMQ
- **Storage:** MinIO (S3-compatible) — buckets: `audio`, `images`
- **Auth:** Passport JWT, httpOnly cookies (`access_token` 15 min, `refresh_token` 30 days)
- **Email:** Nodemailer → BullMQ queue → MailHog (dev)
- **DSP sidecar:** Python FastAPI at `DSP_URL` (BPM, Camelot key, energy extraction)
- **Entry point:** `src/main.ts` | **Root module:** `src/app.module.ts` | **Port:** 3001, prefix `/api/v1`

---

## Folder Structure

```
src/
├── main.ts                  # Bootstrap: cookie-parser, helmet, ValidationPipe, global interceptor/filter
├── app.module.ts            # Root: ConfigModule, TypeOrm, BullMQ, Throttler, Schedule + all feature modules
├── common/                  # Shared guards, interceptors, filters, decorators, enums, DTOs
├── config/                  # registerAs() config factories (database, jwt, redis, minio, throttler, dsp)
├── database/
│   └── data-source.ts       # TypeORM CLI DataSource; migrations at src/database/migrations/
└── modules/
    ├── auth/                # JWT strategies, User/Session/VerificationCode/PasswordReset entities
    ├── users/               # User CRUD, profile
    ├── artist-profile/      # Artist bio, social links
    ├── songs/               # Upload, DSP enqueue, Song/EncryptionKey/DailyStats entities
    ├── albums/              # Album + AlbumSong junction
    ├── genres/              # Genre CRUD + GenreSuggestion workflow
    ├── admin/               # Song approval/rejection, genre suggestion moderation
    ├── audit/               # AuditLog entity + service (written by AuditLogInterceptor)
    ├── notifications/       # In-app Notification entity + service
    ├── playback/            # Presigned stream URLs, PlayHistory, QueueItem
    ├── search/              # Full-text search across songs/albums/artists
    ├── playlists/           # Playlist/PlaylistSong/SavedPlaylist
    ├── feed/                # Social feed FeedEvent entity
    ├── follow/              # Follow entity
    ├── health/              # GET /health, custom Redis indicator
    ├── storage/             # MinIO wrapper (upload, presigned URL, delete)
    ├── mail/                # Nodemailer templates + email.worker.ts
    └── queue/               # BullMQ queue registration + workers
```

---

## Architecture & Patterns

Layered monolith: **Controller → Service → TypeORM Repository**. No separate repository classes — services inject `@InjectRepository(Entity)` directly.

**Request pipeline (in order):**

1. ThrottlerGuard (rate limit, Redis-backed)
2. JwtAuthGuard — global; reads `access_token` cookie; `@Public()` bypasses
3. EmailVerifiedGuard — global; `@SkipEmailVerified()` bypasses
4. RolesGuard — activated only when `@Roles()` is present
5. ValidationPipe — `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`
6. Controller method
7. Service (owns all business logic + BL-50 ownership check)
8. TransformInterceptor — wraps response on the way out
9. AuditLogInterceptor — fires after success when `@AuditAction()` is present

**Ownership check (BL-50):** always in service layer — `if (resource.userId !== user.id && !isAdmin) throw ForbiddenException`.

---

## Database

PostgreSQL via TypeORM 0.3. `autoLoadEntities: true`. Dev: `synchronize: true`. Prod: migrations only.

**CLI DataSource:** `src/database/data-source.ts` — used by all `migration:*` scripts.
**Migrations folder:** `src/database/migrations/` (empty in dev; generate before prod deploy).
**No seed files** exist yet.

**Core entity relationships:**

- `User` 1–1 `ArtistProfile` | `User` M–M roles via `user_roles` join table
- `User` 1–N `Song` | `Song` M–M `Genre` via `song_genres`
- `Song` 1–1 `SongEncryptionKey` | `Song` 1–N `SongDailyStats`
- `Album` M–M `Song` via `AlbumSong` (with `position`)
- `Playlist` M–M `Song` via `PlaylistSong` (with `position`) | `User` M–M `Playlist` via `SavedPlaylist`
- `User` M–M `User` via `Follow` | `User` 1–N `FeedEvent`

---

## API Design

REST, versioned under `/api/v1`. All responses wrapped by `TransformInterceptor`:

```
Success: { success: true, data: <payload> }
Error:   { success: false, data: null, error: { code, message }, path, timestamp }
```

Paginated lists return `{ items, total, page, size, totalPages }`.

**Auth flow:** POST login → set two httpOnly cookies → use `access_token` for API calls → `POST /auth/refresh` rotates both tokens → `POST /auth/logout` revokes session + adds token to Redis denylist.

**Rate limits** (ThrottlerModule + Redis): 200 req/min general · 10 req/min auth routes · 5 req/min upload.

---

## Key Files

| File                                                  | Role                                                  |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `src/main.ts`                                         | Bootstrap, global middleware/pipes                    |
| `src/app.module.ts`                                   | Root module, all imports                              |
| `src/common/enums.ts`                                 | All domain enums (Role, SongStatus, FeedEventType, …) |
| `src/common/dto/pagination.dto.ts`                    | Reusable page/limit params                            |
| `src/common/guards/jwt-auth.guard.ts`                 | Global JWT guard                                      |
| `src/common/guards/email-verified.guard.ts`           | Email check guard                                     |
| `src/common/guards/roles.guard.ts`                    | RBAC guard                                            |
| `src/common/interceptors/transform.interceptor.ts`    | Response envelope                                     |
| `src/common/interceptors/audit-log.interceptor.ts`    | Admin action logger                                   |
| `src/common/filters/global-exception.filter.ts`       | Unified error format                                  |
| `src/common/decorators/current-user.decorator.ts`     | `@CurrentUser()` / `@CurrentUser('id')`               |
| `src/config/database.config.ts`                       | TypeORM factory                                       |
| `src/config/jwt.config.ts`                            | JWT secrets/expiry                                    |
| `src/database/data-source.ts`                         | TypeORM CLI entry                                     |
| `src/modules/auth/strategies/jwt.strategy.ts`         | Access token validation                               |
| `src/modules/auth/strategies/jwt-refresh.strategy.ts` | Refresh token + session validation                    |
| `src/modules/queue/queue.constants.ts`                | All BullMQ queue name constants                       |
| `src/modules/storage/storage.service.ts`              | MinIO upload + presigned URL helper                   |
| `src/modules/songs/songs.service.ts`                  | Upload flow, DSP enqueue, ownership                   |
| `src/modules/admin/admin.service.ts`                  | Song approval state machine                           |

---

## Naming Conventions

- **Files:** `kebab-case.type.ts` — e.g., `song-daily-stats.entity.ts`, `jwt-auth.guard.ts`
- **Classes:** PascalCase — `SongsService`, `JwtAuthGuard`, `CreatePlaylistDto`
- **Methods:** camelCase — `findAllByArtist`, `enqueueExtraction`
- **Tables:** snake_case plural — `songs`, `song_daily_stats`, `playlist_songs`
- **Columns:** snake_case — `created_at`, `artist_id`, `is_email_verified`
- **Queue names:** SCREAMING_SNAKE_CASE constants in `queue.constants.ts`
- **Enums:** PascalCase name, UPPER_SNAKE members — `SongStatus.REUPLOAD_REQUIRED`
- **DTOs:** suffixed `Dto` — `UploadSongDto`, `BrowseSongsDto`

---

## Error Handling

`GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`) catches everything globally.

- **HttpException** → forwards HTTP status + extracts `error.code` from the response object
- **class-validator errors** → 400, joins all constraint messages with `"; "`
- **Unknown errors** → 500, logs full stack, returns generic message in prod

Services throw standard NestJS HTTP exceptions: `BadRequestException`, `ConflictException`, `NotFoundException`, `ForbiddenException`. No custom exception hierarchy.

Error code convention in responses: `SNAKE_CASE` string matching the business rule — e.g., `SONG_NOT_FOUND`, `EMAIL_ALREADY_EXISTS`.

---

## Background Jobs & Events

BullMQ backed by Redis. Queue names are constants in `src/modules/queue/queue.constants.ts`. `QueueModule` is `@Global()` so any service can inject queues.

| Worker file                                  | Queue      | Trigger                                           |
| -------------------------------------------- | ---------- | ------------------------------------------------- |
| `queue/workers/audio-extraction.worker.ts`   | `AUDIO`    | After song upload — calls DSP sidecar             |
| `queue/workers/genre-bulk-tagging.worker.ts` | `GENRES`   | After genre suggestion approved by admin          |
| `queue/workers/session-cleanup.worker.ts`    | `SESSIONS` | Cron: purge expired sessions + verification codes |
| `mail/workers/email.worker.ts`               | `EMAIL`    | Any service calling `MailService.enqueue()`       |

**Scheduled tasks** (via `@nestjs/schedule` in `AppModule`):

- Every minute: fire SCHEDULED drops → LIVE
- Hourly: premium expiry check
- Daily 2 AM: recommendation batch, download record cleanup
- Daily 3 AM: inactive session hard-delete
- Daily midnight: JWT denylist + verification code cleanup

---

## Common Commands

```bash
# Dev server (watch mode)
npm run start:dev

# Build
npm run build

# Generate migration from entity diff
npm run migration:generate

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Lint + auto-fix
npm run lint
```

---

## Environment & Config

Config loaded via `@nestjs/config` `registerAs()` factories in `src/config/`. All are available via `ConfigService.get('namespace.key')`.

| Namespace   | Key env vars                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `database`  | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`                                                                               |
| `jwt`       | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`                                            |
| `redis`     | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`                                                                                            |
| `minio`     | `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_PUBLIC_URL`, `MINIO_BUCKET_AUDIO`, `MINIO_BUCKET_IMAGES` |
| `dsp`       | `DSP_URL`                                                                                                                               |
| `throttler` | (hardcoded limits, no env vars)                                                                                                         |

No Joi/class-validator schema for env vars — missing vars will surface as runtime errors.

---

## Known Gotchas

- **`synchronize: true` in dev** — entity changes auto-alter the DB. Never run against prod without migrations.
- **`artist-profile` entity lives in `auth/entities/`** — not in `artist-profile/entities/`. The `artist-profile` module doesn't own the entity.
- **PREMIUM is a role, not a separate table** — stored in `user_roles` alongside USER/ARTIST/ADMIN. Querying premium users = check `roles` array.
- **Guard order matters** — JwtAuthGuard populates `req.user`; EmailVerifiedGuard and RolesGuard depend on it. Adding a new global guard must go after JwtAuthGuard in `AppModule` providers array.
- **BullMQ workers are NestJS processors** — they must be registered in their module's `providers` array AND the module must import the correct `BullModule.registerQueue()`.
- **MinIO dual clients** — `StorageService` has both an internal client (for uploads) and a public URL client (for generating presigned URLs). Using the wrong one produces signed URLs that resolve to the wrong host.
- **SongStatus machine** — transitions are enforced in `AdminService`/`SongsService`. Do not update `song.status` directly via repository; always go through the service method that validates the transition.
