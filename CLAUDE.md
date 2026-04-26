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

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->