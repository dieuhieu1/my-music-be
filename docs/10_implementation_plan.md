# Music Streaming App — Phased Implementation Plan

**Version 2.1 · April 2026**

> Strategy: vertical slices — each phase ships BE + FE end-to-end testable immediately.
> Completed phases are summarized only. Full historical detail is in git history.

---

## Implementation Status

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
| 9 | 🔄 In Progress | Reports, Analytics & Admin Tools |
| 10 | 🔲 Todo | Recommendations, Mood Engine & AI Chat |

---

## Phases 1–6 — COMPLETE (summary only)

| Phase | Key deliverables |
|-------|-----------------|
| 1 | Docker compose (postgres, redis, minio, mailhog, api, dsp, web), NestJS + Next.js + FastAPI scaffolds, `/health` |
| 2 | JWT httpOnly cookies, register/login/logout/refresh, forgot-password, email verify, brute-force lock, sessions CRUD |
| 3 | User + artist profiles, follow/unfollow, avatar upload (sharp→MinIO), genre onboarding |
| 4A | Song upload: magic-byte validate, AES-256-CBC `.enc`, DSP BPM/key/energy extraction, PENDING status |
| 4B | Admin approval queue, approve/reject/reupload/restore, genre suggestion + bulk-tag worker, audit log |
| 5 | Browse + search (songs/albums/artists/playlists), streaming presigned URL, playback state, queue, Smart Order, next-song algo |
| 6 | Playlists CRUD, liked-songs auto-playlist, save/unsave, social feed (FeedEvent), TAKEN_DOWN handling |

**Entities in DB (phases 1–6):** `users`, `user_roles`, `sessions`, `password_resets`, `verification_codes`, `artist_profiles`, `follows`, `user_genre_preferences`, `songs`, `song_encryption_keys`, `song_daily_stats`, `albums`, `album_songs`, `genres`, `genre_suggestions`, `audit_logs`, `playback_history`, `playback_state`, `queue_items`, `playlists`, `playlist_songs`, `saved_playlists`, `feed_events`

**Global conventions (apply to every phase):**

- **Response envelope:** all endpoints return `{ success: true, data: {...} }` or `{ success: false, data: null, error: { code, message } }` via `TransformInterceptor`
- **Pagination shape:** `{ items: [...], total, page, size, totalPages }`
- **Guard order:** `JwtAuthGuard → EmailVerifiedGuard → RolesGuard → Controller → Service (BL-50 ownership check)`
- **Ownership check (BL-50):** always in service layer — `if (resource.userId !== currentUser.id && !isAdmin) throw ForbiddenException`
- **Auth cookies:** `access_token` httpOnly 15 min · `refresh_token` httpOnly 30 days; JWT denylist in Redis on logout
- **`song_encryption_keys` table:** one row per song; `encryptedAesKey` = AES-256-CBC key encrypted with `AES_MASTER_KEY` env var; needed in Phase 7 download endpoint to build licenseJwt
- **Role `PREMIUM`:** stored as a row in `user_roles` join table (same as USER/ARTIST/ADMIN); checked via `@Roles('PREMIUM')` guard
- **NotificationType enum values:** `UPCOMING_DROP`, `NEW_RELEASE`, `SONG_LIKED`, `ARTIST_FOLLOWED`, `SONG_TAKEN_DOWN`, `PREMIUM_ACTIVATED`, `DROP_CANCELLED`

---

## Phase 7 — Payments & Premium Downloads 🔄 CURRENT

**BL codes:** BL-20–21, BL-26, BL-52–58, BL-74–77

### Progress Tracker

| Layer | Status | Notes |
|-------|--------|-------|
| DB / Entities | ✅ Done | `payment_records`, `download_records` migrated |
| API Endpoints | ✅ Done | All 10 endpoints implemented (see commits) |
| Jobs / Cron | ✅ Done | Hourly expiry cron + daily hard-delete cron |
| FE — J1 PaymentPage | ✅ Done | Plan cards + gateway selector + redirect flow |
| FE — J2 VNPay return | ✅ Done | Suspense + callback verify + store sync |
| FE — J3 MoMo return | ✅ Done | Suspense + callback verify + store sync |
| FE — PremiumUpgradeModal | ✅ Done | Radix Dialog; reusable from any page |
| FE — B5 Premium Status | 🔲 Todo | `profile/premium/page.tsx` — current plan + expiry |
| FE — K1 DownloadModal | ✅ Done | Quota bar + AES decrypt flow + browser save |
| FE — K2 Downloads list | ✅ Done | Active/expiring/revoked rows, remove, silent revalidate |
| FE — PremiumBadge | ✅ Done | `PremiumBadge.tsx` — pill + icon variants; wired into Sidebar user section |
| FE — SongContextMenu download | ✅ Done | `SongContextMenu.tsx` — Download item only for `isPremium()` |
| FE — `lib/utils/crypto.ts` | ✅ Done | AES-CBC decrypt via Web Crypto API + `triggerBlobDownload` |

### DB / Entities

| Entity | Key fields |
|--------|-----------|
| `payment_records` | userId FK, provider (VNPAY\|MOMO\|ADMIN_GRANTED), amount, premiumType (1month\|3month\|6month\|12month), status (PENDING\|SUCCESS\|FAILED), transactionId, expiresAt, createdAt |
| `download_records` | userId FK, songId FK, licenseJwt TEXT, downloadedAt, revokedAt nullable, expiresAt |

**Index:** `idx_download_records_user` on `(userId, revokedAt)` — quota checks.

**Premium pricing:**

| Plan | VND |
|------|-----|
| 1 month | 30,000 |
| 3 months | 79,000 |
| 6 months | 169,000 |
| 12 months | 349,000 |

### API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/payment/vn-pay?premiumType=` | JWT | Build HMAC-SHA512 URL (env: `VNPAY_HASH_SECRET`); include `vnp_ReturnUrl=<API_BASE>/payment/vn-pay/callback`; create PaymentRecord PENDING; return `{ paymentUrl }` |
| GET | `/payment/vn-pay/callback` | @Public | Verify `vnp_SecureHash` HMAC-SHA512; idempotent (skip if PaymentRecord already SUCCESS); set SUCCESS; add PREMIUM role; compute expiresAt; send email |
| POST | `/payment/momo?premiumType=` | JWT | POST to MoMo endpoint with HMAC-SHA256 (env: `MOMO_SECRET_KEY`); `redirectUrl=<API_BASE>/payment/momo/callback`; return `{ paymentUrl }` — **note: client calls our API via POST; our API calls MoMo internally** |
| POST | `/payment/momo/callback` | @Public | Verify HMAC-SHA256; idempotent; same grant flow as VNPay |
| POST | `/admin/users/:userId/premium` | ADMIN | Manual grant; body `{ premiumType }`; expiresAt = now + duration map (1month=30d, 3month=90d, 6month=180d, 12month=365d); ADMIN_GRANTED provider |
| DELETE | `/admin/users/:userId/premium` | ADMIN | Revoke PREMIUM role + cascade revokedAt on all DownloadRecords |
| POST | `/songs/:songId/download` | PREMIUM\|ADMIN | Quota check (USER 100, ARTIST 200, ADMIN ∞); build licenseJwt; 5-min presigned `.enc` URL; insert DownloadRecord |
| GET | `/songs/downloads` | JWT | List non-revoked DownloadRecords `{ songId, title, downloadedAt, expiresAt }` |
| POST | `/songs/downloads/revalidate` | JWT | Batch check PREMIUM active; set revokedAt where lapsed (BL-55) |
| DELETE | `/songs/downloads/:songId` | JWT | Set revokedAt=now (manual remove) |

**licenseJwt construction:**
1. Fetch `song_encryption_keys.encryptedAesKey` for the song
2. Decrypt with `AES_MASTER_KEY` env var → raw `aesKey` (hex string) + `iv` (first 16 bytes stored alongside key, or derived as `sha256(songId+userId)[:16]` — must be consistent with FE decrypt)
3. Sign with `JWT.sign({ songId, userId, aesKey, iv, expiresAt: now+30d }, env.DOWNLOAD_JWT_SECRET, { algorithm: 'HS256' })`
4. `DOWNLOAD_JWT_SECRET` = separate env var (not the auth JWT secret)

**AES-256-CBC IV storage decision:** IV is generated at upload time (Phase 4A) and stored in `song_encryption_keys.iv` (hex, 32 chars). Include `iv` in licenseJwt payload so FE can decrypt without a second API call.

### Frontend

**Screens:** B5, J1, J2, J3, K1, K2

| Screen | Status | Description |
|--------|--------|-------------|
| B5 | ✅ Done | `profile/premium/page.tsx` — active/inactive states, expiry + "expiring soon" badge, quota bar, PremiumUpgradeModal CTA |
| J1 | ✅ Done | `payment/page.tsx` — plan cards + VNPay/MoMo gateway selector → redirect to `paymentUrl` |
| J2 | ✅ Done | `payment/vnpay/page.tsx` — reads query params, POSTs callback, shows result card |
| J3 | ✅ Done | `payment/momo/page.tsx` — reads query params, POSTs callback, shows result card |
| K1 | ✅ Done | `DownloadModal.tsx` — quota bar + decrypt flow + browser save; non-premium gate → `PremiumUpgradeModal` |
| K2 | ✅ Done | `downloads/page.tsx` — active/expiring/revoked rows, remove, silent revalidate on load |

**Shared components built (session 2026-04-22):**
- `components/payment/PlanCard.tsx` ✅ — plan card with gold ring pulse on selected
- `components/payment/GatewaySelector.tsx` ✅ — VNPay / MoMo 2-col picker
- `components/payment/PaymentResultCard.tsx` ✅ — loading / success / error states
- `components/payment/PremiumUpgradeModal.tsx` ✅ — Radix Dialog; trigger from anywhere
- `components/payment/plans.ts` ✅ — hardcoded plan data (BL-20 pricing)

**Still to build:**
- `PremiumBadge.tsx` — in header when `isPremium()`
- `lib/utils/crypto.ts` — decrypt flow: `base64url-decode(aesKey) → crypto.subtle.importKey('raw', keyBuf, 'AES-CBC', false, ['decrypt']) → crypto.subtle.decrypt({ name:'AES-CBC', iv: hex2buf(iv) }, key, encryptedBuf) → Blob → object URL → audio.src`
- `SongContextMenu` download option: only visible when `isPremium()`

### Jobs / Cron

| Schedule | BL | Action |
|----------|----|--------|
| `0 * * * *` (hourly) | BL-26, BL-56 | Find `payment_records.expiresAt <= now AND status=SUCCESS` → remove PREMIUM role → set revokedAt on all DownloadRecords |
| `0 3 * * *` (daily 3AM) | BL-58 | Hard-delete DownloadRecords where `revokedAt <= now - 7d` |

### Test Checklist

```
1. B5 → select 1-month VNPay → redirected to VNPay test URL
2. VNPay callback fires → PREMIUM badge visible in header → PaymentRecord status=SUCCESS
3. Admin grants PREMIUM manually → user receives email → badge visible
4. PREMIUM user downloads → K1 shows 1/100 → .enc file received in browser
5. K2: revalidate refreshes expiry; remove sets revokedAt
6. Non-premium: download option absent from SongContextMenu
7. Set expiresAt to past → hourly cron fires → PREMIUM removed → download option gone
8. Offline decrypt: open downloaded .enc + licenseJwt → audio plays via Web Crypto
```

---

## Phase 8 — Artist Live Drops & Notifications

**BL codes:** BL-59–65, BL-80–82

### DB / Entities

| Entity | Key fields |
|--------|-----------|
| `notifications` | userId FK, type (NotificationType), payload JSON, readAt nullable, createdAt |
| `drop_notifications` | userId FK, songId FK; unique (userId, songId) — opt-in |

**`songs` entity additions (Phase 8):** `teaserText VARCHAR(280) nullable` — artist-written teaser copy shown on I1 before drop fires. Set via `PATCH /songs/:songId` (existing edit endpoint).

**`dropAt` validation rules (BL-59):** min = now+1h · max = now+90d · must be validated on both upload (`POST /songs/upload`) and edit (`PATCH /songs/:songId`).

**Status transition for drops:**
```
Admin approves song WITH dropAt set → status = SCHEDULED (not LIVE)
Admin approves song WITHOUT dropAt  → status = LIVE
SCHEDULED song at dropAt (cron)     → status = LIVE
Artist cancels drop                 → status = APPROVED (back to pre-drop approved state)
Artist reschedules (2nd time)       → status = PENDING (requires re-approval)
```

### API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/songs/:songId/teaser` | @Public | Returns `{ id, title, artistName, coverArtUrl, dropAt, teaserText }`; 423 on stream attempt |
| POST | `/songs/:songId/notify` | JWT | Opt-in drop notification |
| DELETE | `/songs/:songId/notify` | JWT | Opt-out |
| DELETE | `/songs/:songId/drop` | ARTIST | Cancel drop; revert APPROVED; dequeue BullMQ jobs; notify opted-in users |
| PATCH | `/songs/:songId/drop` | ARTIST | Reschedule: 1st=update dropAt (≥24h from original); 2nd=PENDING |
| GET | `/drops` | ARTIST\|ADMIN | ARTIST sees own; ADMIN sees all SCHEDULED |
| GET | `/notifications` | JWT | Paginated, createdAt DESC |
| GET | `/notifications/unread-count` | JWT | Count readAt IS NULL |
| PATCH | `/notifications/:id/read` | JWT | Set readAt=now |
| PATCH | `/notifications/read-all` | JWT | Mark all unread read |

**Drop enqueue** (on approve, if dropAt set):
```
queue.add('upcoming-drop-24h', { songId }, { delay: dropAt - now - 86400000 })
queue.add('upcoming-drop-1h',  { songId }, { delay: dropAt - now - 3600000 })
```

### Frontend

| Screen | Description |
|--------|-------------|
| I1 | Drop Teaser Page (@Public) — `DropCountdown.tsx` (setInterval, date-fns), Notify Me button |
| I2 | Artist My Drops list — SCHEDULED songs with countdown + Cancel/Reschedule actions |
| I3 | `CancelDropModal.tsx` — confirmation dialog |
| I4 | `RescheduleDropModal.tsx` — date picker; shows reschedule limit warning on 2nd attempt |
| H3 | `NotificationBell.tsx` — polls unread-count every 30s; Radix Dropdown last 10; Mark all read |

### Jobs / Cron

| Schedule | BL | Action |
|----------|----|--------|
| `* * * * *` (every minute) | BL-62 | `SELECT songs WHERE status=SCHEDULED AND drop_at <= NOW()` → LIVE + FeedEvent NEW_RELEASE + AuditLog |
| BullMQ `drops` queue | BL-61 | `upcoming-drop-24h/1h` worker: notify opted-in users + artist followers via Notification + email |

### Test Checklist

```
1. Upload song with dropAt=now+25h → status=SCHEDULED → teaser at /songs/:id/teaser
2. User opts in → DropNotification record created
3. 24h job fires → Notification in bell + MailHog email "dropping tomorrow"
4. 1h job fires → 2nd notification
5. Per-minute cron at dropAt → song LIVE → H1 feed shows NEW_RELEASE
6. Cancel drop → status=APPROVED → teaser 404
7. Reschedule 2nd time → status=PENDING (re-approval required)
```

---

## Phase 9 — Reports, Analytics & Admin Tools

**BL codes:** BL-38, BL-40, BL-51, BL-68–75

### DB / Entities

| Entity | Key fields |
|--------|-----------|
| `reports` | reporterId FK, targetType (SONG\|ARTIST), targetId, reason (EXPLICIT\|COPYRIGHT\|INAPPROPRIATE), status (PENDING\|DISMISSED\|ACTIONED), resolvedBy FK nullable, resolvedAt nullable, notes nullable |

### API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/reports` | JWT | Upsert on (reporterId, targetType, targetId) |
| GET | `/admin/reports` | ADMIN | `?status&targetType&page&limit` |
| PATCH | `/admin/reports/:id/dismiss` | ADMIN | status=DISMISSED |
| PATCH | `/admin/reports/:id/takedown` | ADMIN | status=ACTIONED; song=TAKEN_DOWN; notify artist |
| GET | `/artist/analytics/overview` | ARTIST | Total plays, last 30d plays, top 5 songs, followerCount |
| GET | `/artist/analytics/:songId` | ARTIST | `?from&to` → `[{ date, playCount }]` from SongDailyStats |
| GET | `/admin/users` | ADMIN | `?page&limit&q` search by name/email |
| GET | `/admin/users/:userId` | ADMIN | Full detail + roles + sessions |
| PATCH | `/admin/users/:userId/roles` | ADMIN | `{ role: 'ARTIST', action: 'add'\|'remove' }` |
| GET | `/admin/users/:userId/sessions` | ADMIN | List sessions |
| DELETE | `/admin/users/:userId/sessions/:sessionId` | ADMIN | Force-revoke |
| GET | `/admin/audit` | ADMIN | `?page&limit&from&to&action&adminId` — immutable |
| GET | `/admin/payments` | ADMIN | `?page&limit&provider&status&userId` — read-only |

### Frontend

| Screen | Description |
|--------|-------------|
| E5 | `ReportModal.tsx` — from SongContextMenu; reason dropdown; POST /reports |
| D3 | Artist Analytics — overview stats (Playfair numbers), recharts LineChart per song, top songs table |
| L3 | Admin User Management — search, paginated table, role badges, promote/demote ARTIST, grant/revoke PREMIUM |
| L4 | Admin Reports Queue — reason, target link, reporter; Dismiss / Takedown buttons |
| L5 | Audit Log — read-only; admin name, action, target, timestamp; date range filter |
| L6 | Payments — filter by provider; amount, status, user, date; read-only |

Admin sidebar L1–L6 persistent left panel.

### Jobs / Cron

None new. AuditLogInterceptor (Phase 4B) already covers all `PATCH /admin/*` routes.

### Test Checklist

```
1. Right-click song → Report "COPYRIGHT" → admin sees in L4
2. Admin takes down → song greyed in all playlists; artist notification created
3. Artist D3: total plays + last 30d line chart renders for top song
4. Admin promotes user to ARTIST → user can upload
5. L5 audit log shows all admin actions with actor + timestamp
6. Admin L6 payment list filters by provider correctly
```

---

## Phase 10 — Recommendations, Mood Engine & AI Chat

**BL codes:** BL-35, BL-35A, BL-35B, BL-36A–B

### DB / Entities

| Entity | Key fields |
|--------|-----------|
| `recommendation_cache` | userId FK, songId FK, score FLOAT, computedAt; composite PK (userId, songId) |

**Redis keys (new):**

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `recs:{userId}` | LIST | 24h | Cached personalized recs (JSON array) |
| `profile:{userId}:genres` | STRING | 24h | Top-3 genre IDs JSON |
| `skip:{userId}:{songId}` | STRING | permanent | Skipped songs — excluded from pool |

(session-scoped keys `session:{userId}:played`, `session:{userId}:recs`, `decay:{userId}:{songId}` already used in Phase 5 next-song algo)

### API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/recommendations` | JWT | `?page&limit`; Redis cache → recommendation_cache → cold-start fallback |
| GET | `/recommendations/mood` | JWT | `?mood&timezone&local_hour&limit`; infer mood from local_hour if omitted |
| PATCH | `/playback/skip` | JWT | Add `skip:{userId}:{songId}` (permanent); exclude from pool |
| POST | `/ai/chat` | JWT | `@Throttle(20,60)`; body `{ message, conversationId?, timezone? }` |

**Mood ranges (server-side, no DSP change):**

| Mood | BPM | Energy |
|------|-----|--------|
| happy | 100–160 | ≥60 |
| sad | 50–90 | ≤40 |
| focus | 60–110 | 30–70 |
| chill | 60–100 | ≤50 |
| workout | 120–180 | ≥70 |

**Time → mood inference:** 06–11 → focus · 18–22 → chill · 23–05 → sad · 12–17 → null

### AI Chat Module (`modules/ai/`)

Files: `ai.module.ts`, `ai.controller.ts`, `ai.service.ts`, `skills.dispatcher.ts`, `skills.registry.ts`, `conversation.service.ts`

**System prompt:** ephemeral cache (`cache_control: { type: 'ephemeral' }`); includes user name, roles, isPremium, localTime.

**ReAct loop:** max 3 tool-use iterations; `model: claude-sonnet-4-6`; `max_tokens: 1024`.

**7 tools:** `search_songs`, `get_recommendations`, `get_mood_playlist`, `create_playlist`, `add_to_queue`, `get_artist_info`, `analyze_listening_history`

**Conversation history:** Redis `conv:{userId}:{convId}` LIST, LTRIM 40, TTL 1h.

### Frontend

| Screen | Description |
|--------|-------------|
| G7 | Mood page — 5 mood buttons; renders SongGrid from `/recommendations/mood`; shows inferredMood badge |
| E1 update | "Recommended for you" section on Home — `GET /recommendations` slice |
| H5 | AI Chat — bubble list (user right/assistant left); conversationId in useState; `actions` renders horizontal SongCard row; typing indicator (3-dot CSS animation) |

### Jobs / Cron

| Schedule | BL | Action |
|----------|----|--------|
| `0 2 * * *` (daily 2AM) | BL-35 | Batch worker: score all LIVE songs per active user; upsert top-200 to recommendation_cache; invalidate `recs:{userId}` |

**Score formula:** `genreMatch×0.4 + followerBoost×0.3 + recencyBoost×0.2 + novelty×0.1`

| Term | Definition |
|------|-----------|
| `genreMatch` | 1.0 if song's genreId in user's top-3 genres, else 0 |
| `followerBoost` | `min(1, artist.followerCount / 10000)` — normalised popularity signal |
| `recencyBoost` | 1.0 if song uploaded within last 14d, 0.5 if within 30d, else 0 |
| `novelty` | 1 − `min(1, userPlayCount / 5)` — penalises songs user already heard ≥5 times |

### Test Checklist

```
1. Trigger batch worker manually → GET /recommendations returns songs (not cold-start fallback)
2. 2nd GET /recommendations < 10ms (Redis cache hit)
3. G7 "workout" → songs with BPM 120–180 + energy ≥70
4. G7 no mood + timezone → mood inferred → inferredMood=true in response
5. PATCH /playback/skip → skip song → GET /songs/:id/next never returns that song
6. AI: "play focus music" → get_mood_playlist called → queue updated → song plays
7. AI: "make a chill playlist" → create_playlist called → appears in G1
8. Conversation continues across messages (conversationId threaded correctly)
```

---

## Phase Summary

| Phase | BE | FE | Status |
|-------|----|----|--------|
| 1 | NestJS + Docker scaffold | Next.js shell | ✅ |
| 2 | Auth, mail, sessions | A1–A7, B4 | ✅ |
| 3 | Profiles, follow, onboarding | B1–B3, C1–C3 | ✅ |
| 4A | Upload, DSP worker | D1–D2, D3a, G9–G10 | ✅ |
| 4B | Admin queue, audit, genre tags | D4–D5, L1–L2 | ✅ |
| 5 | Browse, search, playback, queue | E1–E4, F2, PlayerBar | ✅ |
| 6 | Playlists, liked, feed | G1–G6, H1, H4 | ✅ |
| 7 | Payments, downloads, crons | ✅ Complete | ✅ |
| 8 | Drops, notifications, cron | I1–I4, H3 | 🔲 |
| 9 | Reports, analytics, admin CRUD | E5, D3, L3–L6 | 🔲 |
| 10 | Recommendations, mood, AI chat | G7, E1 update, H5 | 🔲 |
