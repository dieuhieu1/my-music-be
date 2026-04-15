# Tổng Quan Kế Hoạch Triển Khai & Tiến Độ Hiện Tại

**Cập nhật: 12/04/2026**

---

## Kiến Trúc Tổng Thể

Ứng dụng nghe nhạc tự host (thay thế Spotify), phục vụ 20–200 người dùng. Stack chính:

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui + next-intl |
| Backend | NestJS + TypeORM + BullMQ |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ |
| Object Storage | MinIO (audio, ảnh, file mã hóa) |
| DSP Sidecar | Python FastAPI + librosa (trích xuất BPM/Key) |
| Email | Nodemailer SMTP → MailHog (dev) |
| Payment | VNPay + MoMo |

---

## Tổng Quan 10 Phase

| Phase | Tính năng | Trạng thái |
|-------|-----------|------------|
| **1** | Infrastructure + App Shell | ✅ Hoàn thành |
| **2** | Auth & Sessions | 🔄 Gần xong (~85%) |
| **3** | User & Artist Profiles | 🔄 Đang làm (~70%) |
| **4A** | Upload nhạc & DSP Processing | ⬜ Chưa bắt đầu |
| **4B** | Admin duyệt bài & Moderation | ⬜ Chưa bắt đầu |
| **5** | Browse, Search & Streaming | ⬜ Chưa bắt đầu |
| **6** | Playlists & Social Feed | ⬜ Chưa bắt đầu |
| **7** | Payments & Premium Downloads | ⬜ Chưa bắt đầu |
| **8** | Live Drops & Notifications | ⬜ Chưa bắt đầu |
| **9** | Reports, Analytics & Admin Tools | ⬜ Chưa bắt đầu |
| **10** | Recommendations & Mood Engine | ⬜ Chưa bắt đầu |

---

## Chi Tiết Từng Phase

---

### ✅ Phase 1 — Infrastructure & App Shell

**Mục tiêu:** Dựng toàn bộ hạ tầng, không có tính năng người dùng nào.

#### Backend — ĐÃ XONG
- `docker-compose.yml` với 6 services: `postgres`, `redis`, `minio`, `mailhog`, `api`, `dsp`
- NestJS scaffold đầy đủ:
  - `ConfigModule` (global) với 5 config namespace: database, redis, minio, jwt, throttler
  - `TypeOrmModule`, `BullModule`, `ThrottlerModule` (Redis-backed), `ScheduleModule`
  - `HealthModule` — `GET /api/v1/health` (DB + Redis ping)
  - `StorageModule` — MinIO service với 3 bucket: `audio`, `audio-enc`, `images`
  - `QueueModule` (global) — đăng ký 6 BullMQ queue
  - `MailModule` — Nodemailer SMTP
  - Global guards: `ThrottlerGuard`, `JwtAuthGuard`
  - Common: enums, decorators (`@Public`, `@CurrentUser`, `@Roles`), interceptors (`TransformInterceptor`), filters (`GlobalExceptionFilter`)
- `apps/dsp/` — Python FastAPI sidecar (`GET /health`, `POST /extract`)

#### Frontend — ĐÃ XONG
- Next.js App Router scaffold với locale routing (`[locale]`)
- Route groups: `(public)`, `(auth)`, `(app)` với middleware auth check
- Tất cả `lib/api/*.api.ts` stub files (18 files)
- `lib/api/axios.ts` — axios instance + 401 → refresh interceptor
- Layout shell: `(app)/layout.tsx` với Sidebar + PlayerBar placeholder
- `LanguageSwitcher.tsx`

---

### 🔄 Phase 2 — Auth & Sessions

**BL codes:** BL-01–08, BL-41–43, BL-46–47, BL-78–79

**Mục tiêu:** Đăng ký, đăng nhập, quản lý session, reset mật khẩu, xác thực email.

#### Backend — ĐÃ XONG (~90%)
**Entities đã tạo (+ migrations):**
- `user.entity.ts` — roles, failedAttempts, lockUntil, is_email_verified
- `artist-profile.entity.ts` — userId FK, stageName, bio, followerCount, socialLinks
- `session.entity.ts` — deviceName, deviceType, IP, lastSeenAt, refreshTokenId
- `password-reset.entity.ts`
- `verification-code.entity.ts`

**Modules đã tạo:**
- `modules/auth/` — AuthController, AuthService, strategies (JWT + JwtRefresh)
- `modules/mail/` — MailService (Nodemailer SMTP)
- `modules/queue/` với workers (SessionCleanupWorker)

**Endpoints đã implement:**
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

#### Frontend — ĐÃ XONG (~80%)
**Screens đã có:**
- `(auth)/login/page.tsx` — A4 Login
- `(auth)/register/page.tsx` — A1/A2 User & Artist Registration
- `(auth)/forgot-password/page.tsx` — A5
- `(auth)/verify-reset/page.tsx` — A6
- `(auth)/reset-password/page.tsx` — A7

**Còn thiếu:**
- `(app)/verify-email/page.tsx` — A3 Email Verification (folder có nhưng cần kiểm tra nội dung)
- `(app)/profile/sessions/page.tsx` — B4 Active Sessions (folder có)
- `(app)/profile/premium/page.tsx` — B5 (folder có, dùng cho Phase 7)

---

### 🔄 Phase 3 — User & Artist Profiles

**BL codes:** BL-11, BL-32, BL-66–67, BL-72–73

**Mục tiêu:** Xem/sửa profile, trang artist công khai, follow/unfollow.

#### Backend — ĐÃ XONG (~75%)
**Modules đã tạo:**
- `modules/users/` — UsersController, UsersService (PATCH /users/me, GET /users/me, GET /users/:id)
- `modules/artist-profile/` — ArtistProfileController, ArtistProfileService
- `modules/follow/` — FollowModule, FollowService, follow.entity.ts

**Còn thiếu:**
- `FollowController` — chưa có file controller trong `modules/follow/` (chỉ có service + entity)
- Endpoint follow/unfollow chưa được expose ra route

#### Frontend — ĐÃ XONG (~80%)
**Screens đã có:**
- `(app)/profile/page.tsx` — B1 My Profile
- `(app)/profile/edit/page.tsx` — B2 Edit Profile
- `(app)/profile/password/page.tsx` — B3 Change Password
- `(app)/artist/profile/page.tsx` — C2 My Artist Profile
- `(app)/artist/edit/page.tsx` — C3 Edit Artist Profile
- `(public)/artists/[id]/page.tsx` — C1 Public Artist Profile

**Components đã có:**
- `components/profile/AvatarUpload.tsx`
- `components/profile/FollowButton.tsx`

**Còn thiếu:**
- Kết nối FollowButton với API follow thực tế (cần backend controller trước)
- Listener counter increment khi view public artist profile (BL-11)

---

### ⬜ Phase 4A — Content Upload & DSP Processing

**BL codes:** BL-37A, BL-39, BL-44, BL-48, BL-14, BL-18

**Những gì cần làm:**
- **BE:** Entities: `song`, `song-encryption-key`, `song-daily-stats`, `album`, `album-song`, `genre`, `genre-suggestion`
- **BE:** `modules/songs/` — upload endpoint với magic-byte validation, AES-256 encryption, MinIO storage, enqueue audio extraction job
- **BE:** `modules/albums/` — CRUD album
- **BE:** `workers/audio-extraction.worker.ts` — gọi DSP sidecar, lưu BPM/camelotKey/energy
- **FE:** D1 Upload form, D2 My Songs list, D3a Edit Song, G9/G10 Album CRUD
- **FE:** `ExtractionStatus.tsx` — polling `GET /songs/:id` mỗi 3s khi đang extract

---

### ⬜ Phase 4B — Admin Approval & Moderation

**BL codes:** BL-37, BL-40, BL-49, BL-68–71, BL-83–85

**Những gì cần làm:**
- **BE:** `audit-log.entity.ts`
- **BE:** Admin endpoints: approve/reject/reupload-required/restore songs
- **BE:** `modules/genres/` — admin duyệt genre suggestion + bulk-tagging worker
- **BE:** `AuditLogInterceptor` — ghi log tất cả admin mutation
- **FE:** D4–D5, L1–L2 screens
- **FE:** `ApprovalQueue.tsx`, `AuditTable.tsx`

---

### ⬜ Phase 5 — Browse, Search & Streaming

**BL codes:** BL-09–12, BL-22–23, BL-28, BL-30–31, BL-37C

**Những gì cần làm:**
- **BE:** Entities: `queue-item`, `play-history`
- **BE:** Browse/search endpoints, `GET /songs/:id/stream` (presigned MinIO URL)
- **BE:** Playback queue CRUD + Smart Order algorithm
- **FE:** PlayerBar hoạt động đầy đủ với howler.js
- **FE:** `navigator.mediaSession` API cho OS lock screen control
- **FE:** E1–E4, F2 screens; SongCard, AlbumCard, HowlerPlayer components

---

### ⬜ Phase 6 — Playlists & Social Feed

**BL codes:** BL-12–17, BL-22, BL-32–34

**Những gì cần làm:**
- **BE:** Entities: `playlist`, `playlist-song`, `saved-playlist`, `feed-event`
- **BE:** Playlist CRUD + like song (auto-create Liked Songs playlist on first like)
- **BE:** `GET /feed` — hoạt động từ followed artists/users
- **FE:** G1–G3, G5–G6, H1, H4 screens; PlaylistCard, SongContextMenu

---

### ⬜ Phase 7 — Payments & Premium Downloads

**BL codes:** BL-20–21, BL-52–58, BL-74–77

**Những gì cần làm:**
- **BE:** Entities: `payment-record`, `download-record`
- **BE:** VNPay + MoMo payment flow (HMAC-SHA512 verification)
- **BE:** Download endpoint với license JWT (AES-256 key delivery)
- **FE:** B5, J1–J3 payment screens; K1–K2 download screens
- **FE:** Client-side AES-256 decrypt (Web Crypto API)

---

### ⬜ Phase 8 — Live Drops & Notifications

**BL codes:** BL-59–65, BL-80–82

**Những gì cần làm:**
- **BE:** `notification.entity.ts`
- **BE:** Drop scheduling (BullMQ delayed jobs 24h/1h), per-minute cron để fire drops
- **BE:** Notification endpoints + `DropNotificationWorker`
- **FE:** I1–I4 Drop screens; H3 Notification Bell (polling unread-count mỗi 30s)

---

### ⬜ Phase 9 — Reports, Analytics & Admin Tools

**BL codes:** BL-38, BL-40, BL-51, BL-68–75

**Những gì cần làm:**
- **BE:** `report.entity.ts`; report + analytics + admin CRUD modules
- **BE:** `GET /artist/analytics/:songId` — aggregate SongDailyStats theo date range
- **FE:** E5 Report Modal; D3 Analytics charts (recharts); L3–L6 Admin screens

---

### ⬜ Phase 10 — Recommendations & Mood Engine

**BL codes:** BL-35, BL-35A, BL-36A–B

**Những gì cần làm:**
- **BE:** `recommendation-cache.entity.ts`
- **BE:** `GET /recommendations` — Cache-aside (Redis 24h TTL → DB fallback)
- **BE:** `GET /recommendations/mood` — infer mood từ timezone/local_hour nếu không truyền mood
- **BE:** `RecommendationBatchWorker` — daily cron tính score và ghi DB
- **FE:** G7 Mood Playlist page; E1 Home page recommendation sections

---

## Tổng Kết Tiến Độ

```
Phase 1  ██████████ 100%  ✅ Hoàn thành
Phase 2  ████████░░  85%  🔄 Cần thêm: verify-email screen, sessions UI
Phase 3  ███████░░░  70%  🔄 Cần thêm: follow controller BE, kết nối FE
Phase 4A ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 4B ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 5  ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 6  ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 7  ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 8  ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 9  ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
Phase 10 ░░░░░░░░░░   0%  ⬜ Chưa bắt đầu
```

### Việc cần làm ngay để hoàn thành Phase 3:

1. **[BE]** Tạo `FollowController` trong `modules/follow/` — expose các endpoint:
   - `POST /artists/:id/follow`
   - `DELETE /artists/:id/follow`
   - `GET /artists/:id/followers`
   - `GET /users/:id/following`

2. **[BE]** Đăng ký `FollowModule` vào `app.module.ts`

3. **[FE]** Kết nối `FollowButton.tsx` với API thực tế

4. **[FE/BE]** Kiểm tra listener counter (BL-11) khi view `GET /artists/:id/profile`

5. **Sau khi xong Phase 3:** Chạy browser test scenario được định nghĩa trong plan, rồi viết Jest API tests + Playwright e2e tests trước khi chuyển Phase 4A.
