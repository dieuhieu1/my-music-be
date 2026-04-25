# MyMusic — Project CLAUDE.md

Self-hosted Spotify alternative for 20–200 users. NestJS + Next.js + Python DSP sidecar.

---

## Monorepo Structure

```
my-music/
  apps/
    api/     ← NestJS backend, port 3001, prefix /api/v1
    web/     ← Next.js frontend, port 3000
    dsp/     ← Python FastAPI sidecar, port 8000
  packages/
    types/   ← Shared TS enums + DTOs
  docs/      ← All spec docs (01–10)
  docker-compose.yml
  .env.example
```

Sub-apps have their own `CLAUDE.md`:
- `apps/web/CLAUDE.md` — design system, routing, components, API layer, Zustand stores
- `apps/dsp/CLAUDE.md` — librosa pipeline, endpoint contract, CAMELOT_MAP

---

## Services & Ports

| Service | Port | Notes |
|---------|------|-------|
| NestJS API | 3001 | `/api/v1` prefix |
| Next.js | 3000 | locale-prefixed routes |
| Python DSP | 5000 | `GET /health`, `POST /extract` |
| PostgreSQL | 5432 | TypeORM |
| Redis | 6379 | BullMQ + cache + JWT denylist |
| AWS S3 | — | 3 buckets: `mymusic-audio` (private), `mymusic-audio-enc` (private), `mymusic-images` (public-read) |

---

## Phase Status

| Phase | Status | Feature |
|-------|--------|---------|
| 1 | ✅ Done | Infrastructure + App Shell |
| 2 | ✅ Done | Auth & Sessions |
| 3 | ✅ Done | User & Artist Profiles |
| 4A | ✅ Done | Content Upload & DSP Processing |
| 4B | ✅ Done | Admin Approval & Moderation |
| 5 | ✅ Done | Browse, Search & Streaming |
| 6 | ✅ Done | Playlists & Social Feed |
| 7 | ✅ Done | Payments & Premium Downloads |
| 8 | ✅ Done | Drops & Notifications |
| 9 | ✅ Done | Reports, Analytics & Admin Tools |
| 10 | 🔲 Todo | Recommendations, Mood Engine & AI Chat |

Full implementation plan: `docs/10_implementation_plan.md`

---

## API Conventions (NestJS)

**Response envelope** (all endpoints):
```json
{ "success": true, "data": { ... } }
{ "success": false, "data": null, "error": { "code": "ERR_CODE", "message": "..." } }
```
Wrapped automatically by `TransformInterceptor`.

**Pagination** (all list endpoints):
```json
{ "items": [...], "total": 100, "page": 1, "size": 20, "totalPages": 5 }
```

**Auth**: httpOnly cookies — `access_token` (15 min), `refresh_token` (30 days). JWT denylist in Redis on logout.

**Rate limits**: 10 req/min auth routes · 5 req/min upload · 200 req/min general.

**Guard execution order**: JwtAuthGuard → EmailVerifiedGuard → RolesGuard → Controller → Service (BL-50 ownership check).

**Ownership check (BL-50)**: always in service layer: `if (resource.userId !== currentUser.id && !isAdmin) throw ForbiddenException`.

---

## BullMQ Queue Names (`QUEUE_NAMES` in `modules/queue/queue.constants.ts`)

| Queue | Job Names | Worker File |
|-------|-----------|-------------|
| `email` | `send-email` | `workers/email.worker.ts` |
| `audio` | `extract-metadata` | `workers/audio-extraction.worker.ts` |
| `drops` | `upcoming-drop-24h`, `upcoming-drop-1h` | `workers/drop-notification.worker.ts` |
| `genres` | `bulk-tag-songs` | `workers/genre-bulk-tagging.worker.ts` |
| `recommendations` | `compute-batch` | `workers/recommendation-batch.worker.ts` |
| `sessions` | `cleanup-session` | `workers/session-cleanup.worker.ts` |

---

## Song Status Machine

```
PENDING → (admin approve) → LIVE
                          → SCHEDULED (if dropAt set)
        → (admin reject)  → REJECTED
        → (admin reupload-required) → REUPLOAD_REQUIRED
REUPLOAD_REQUIRED → (artist resubmit) → PENDING
LIVE → (admin takedown) → TAKEN_DOWN
TAKEN_DOWN → (admin restore) → LIVE
SCHEDULED → (cron at dropAt) → LIVE
          → (admin cancel drop) → APPROVED
```

---

## Roles & Premium

- **Roles**: USER, ARTIST, ADMIN — stored in `user_roles` join table; additive
- **PREMIUM**: payment tier stored in same `user_roles` table; not a separate role
- **Download quotas**: USER+PREMIUM 100, ARTIST+PREMIUM 200, ADMIN unlimited

---

## Key Environment Variables (.env.example)

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_AUDIO=mymusic-audio
AWS_S3_BUCKET_AUDIO_ENC=mymusic-audio-enc
AWS_S3_BUCKET_IMAGES=mymusic-images
AWS_S3_PRESIGN_EXPIRES_SEC=3600
JWT_SECRET=...
JWT_REFRESH_SECRET=...
DSP_URL=http://dsp:5000
ANTHROPIC_API_KEY=sk-ant-...
VNPAY_HASH_SECRET=...
MOMO_SECRET_KEY=...
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16char_app_password
MAIL_FROM=your_email@gmail.com
```

---

## Cron Schedule Summary

| Schedule | BL | Job |
|----------|----|-----|
| Every minute | BL-62 | Fire scheduled drops (SCHEDULED → LIVE) |
| Hourly | BL-26 | Premium expiry check + cascade BL-56 |
| Daily 2AM | BL-35 | Recommendation batch compute |
| Daily 3AM | BL-58 | Hard-delete expired download records |
| Daily midnight | BL-25, BL-27 | Token cleanup + verification code cleanup |
| Daily 2AM | BL-45 | Inactive session cleanup (30-day window) |

---

## Reference Docs

Read the CLAUDE.md files first. Only open a doc when it answers something the CLAUDE.md can't.

| Doc | Read when… |
|-----|-----------|
| `docs/01_requirements_en.md` | You need the exact wording of a BL code (e.g. BL-34, BL-52) |
| `docs/02_specification.md` | You need screen-level detail: which role can see what, modal vs page |
| `docs/04_architecture.md` | You need data-flow or system-design decisions (MinIO buckets, auth flow, SmartOrder algo) |
| `docs/05_module_map.md` | You need to know which NestJS module owns a BL code |
| `docs/06_project_structure.md` | You need the exact file/folder path for a new file |
| `docs/07_api_interfaces.md` | You need the full request/response shape for a specific endpoint |
| `docs/08_ai_architecture.md` | You're implementing the AI chat agent (Phase 10) |
| `docs/09_recommendation_engine.md` | You're implementing next-song recommendation or mood engine (Phase 10) |
| `docs/10_implementation_plan.md` | You're starting a new phase — read **only that phase's section** |

**Rule**: look up one doc, extract what you need, then close it. Never read all docs upfront.
