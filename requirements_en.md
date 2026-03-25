# Music Streaming App — Product Requirements Document
**Version 3.0 · March 2026**

> A self-hosted, ad-free Spotify alternative for small communities (20–200 users).

**v3.0 adds:** Offline Downloads (BL-52–58) · Artist Live Drops (BL-59–65)

---

## 1. Introduction

This document is the single source of truth for all business logic, roles, feature requirements, and non-functional requirements for the Music Streaming App. Version 3.0 adds two premium engagement features: **Offline Downloads** and **Artist Live Drops**.

### 1.1 Design Principles

- Artists and Admins can upload music. Users are listeners and curators only.
- All uploads (regardless of role) enter `PENDING` status and require Admin approval before going public.
- Artists self-register — no application or approval gate on the account itself.
- Roles are additive: a user can hold `ARTIST + PREMIUM` simultaneously (modelled as a many-to-many join table).
- Genres grow from artist suggestions reviewed by Admin, feeding the AI recommendation engine.
- Offline downloads use DRM-lite encryption — AES-256 per song, license JWT per user.
- Scheduled drops fire via a per-minute cron — all `SCHEDULED → LIVE` transitions are automated.

### 1.2 Tech Stack Assumptions

| Layer | Technology |
|---|---|
| Backend | NestJS / TypeORM |
| Auth | JWT (access + refresh tokens), bcrypt (rounds = 10) |
| Payments | VNPay |
| Scheduled tasks | Cron jobs (including per-minute for drop firing) |
| Storage | File server with encrypted `.enc` variants for downloadable songs |
| AI | Rules-based engine now; ML integration path kept open |

---

## 2. Roles & Permissions

Three roles exist in the system. `PREMIUM` is a payment tier that stacks on top of `USER` or `ARTIST` — it is not a separate role. All roles are stored in a `user_roles` join table (many-to-many), never as a single enum column.

| Role | Who they are | Core privilege |
|---|---|---|
| USER | Listeners, playlist curators | Stream, like, follow, create playlists. Cannot upload. |
| ARTIST | Music creators — self-register at signup | Everything USER can do + upload songs, manage own albums, analytics, public profile, schedule drops. |
| ADMIN | Platform administrator | Everything ARTIST can do + approve/reject content, manage genres, audit log, all sessions. |
| PREMIUM (tier) | Paid upgrade — stacks on USER or ARTIST | 320 kbps audio, offline downloads (100 songs), higher upload limits. Unlocked via VNPay. |

### 2.1 Permission Matrix

| Permission | USER | ARTIST | ADMIN |
|---|---|---|---|
| **Listening & Curation** | | | |
| Browse & stream approved / live songs | yes | yes | yes |
| Like songs, follow artists & users | yes | yes | yes |
| Create & manage personal playlists | yes | yes | yes |
| Save / follow public playlists | yes | yes | yes |
| Report content | yes | yes | yes |
| View drop teaser page (public) | yes | yes | yes |
| Opt-in to drop notification | yes | yes | yes |
| **Offline Downloads — PREMIUM only** | | | |
| Download songs for offline play | no | no | yes |
| Download songs (PREMIUM tier) | — | → review | yes |
| Revalidate download licenses | no | → review | yes |
| Remove downloaded songs | no | → review | yes |
| **Content Creation — Artist & Admin only** | | | |
| Upload songs (→ PENDING review) | no | → review | → review |
| Schedule a drop date on upload | no | yes | yes |
| Cancel / reschedule a drop | no | own only | yes |
| Create & manage albums | no | own only | any |
| Edit / delete own songs | no | own only | any |
| Public artist profile page | no | yes | yes |
| View song analytics | no | own only | any |
| Suggest new genres on upload | no | → review | instant |
| **Admin only** | | | |
| Approve / reject song uploads | no | no | yes |
| Approve / reject genre suggestions | no | no | yes |
| Delete any content | no | no | yes |
| Resolve content reports | no | no | yes |
| Manage confirmed genre list | no | no | yes |
| View audit log & all sessions | no | no | yes |
| Promote / demote user roles | no | no | yes |

---

## 3. Authentication & Registration

### Registration Flows

| Code | Name | Description |
|---|---|---|
| BL-01 | User registration | `POST /auth/register` with `role=USER` (default). Fields: `name`, `email`, `password`, `confirmPassword`. Validate email uniqueness, password match, hash with bcrypt (rounds=10), assign USER role, save user, generate access + refresh tokens, send welcome email async. Return `TokenResponse`. |
| BL-46 | Artist registration | `POST /auth/register` with `role=ARTIST`. All BL-01 fields plus: `stageName` (required), `bio` (required), `genres[]` (required, min 1), `socialLinks[]` (optional). Validate all artist fields before creating any records. On success: create User (role=ARTIST) + ArtistProfile atomically. Account is active immediately. |
| BL-47 | Artist profile record | `ArtistProfile` created atomically with User during artist registration. Fields: `userId` (FK, unique), `stageName`, `bio`, `followerCount=0`, `socialLinks[]`, `suggestedGenres[]`. Public immediately via `GET /artists/:id/profile` showing stageName, bio, followerCount, and LIVE songs only. |

### Login & Session

| Code | Name | Description |
|---|---|---|
| BL-02 | Login | Find user by email (throw UNAUTHENTICATED if not found). Compare password with bcrypt (throw UNAUTHENTICATED if mismatch). Check account not locked (BL-43). Generate access + refresh tokens, save refresh token, create/update Session record (BL-42). Return `TokenResponse`. |
| BL-03 | Logout | Verify access token. Store `jti` + expiry in `InvalidatedToken` table (blacklist). Invalidate associated Session record. Return void. |
| BL-04 | Refresh token | Verify refresh token signature + expiry. Check token exists in `tbl_refresh_token` and not expired. Get user from `sub` claim. Generate new access token. Return `TokenResponse`. |
| BL-05 | Change password | Get current user from JWT. Verify `oldPassword` matches hash. Validate `newPassword == confirmPassword`. Hash new password. Update user in DB. Return `UserResponse`. |

### Forgot Password Flow

| Code | Name | Description |
|---|---|---|
| BL-06 | Forgot password | Receive email. Find user (throw if not found). Generate 6-digit numeric code. Set expiry = now + 10 min. Save `VerificationCode` to DB. Send code via email. Return `VerificationCode` entity. |
| BL-07 | Verify code | Find `VerificationCode` by email + code. Check not expired. Generate reset password JWT (15 min expiry). Save `ForgotPasswordToken` to DB. Return `ForgotPasswordToken` entity. |
| BL-08 | Reset password | Find `ForgotPasswordToken` by token string. Verify JWT validity + expiry. Validate `newPassword == confirmPassword`. Hash + update user password. Delete `ForgotPasswordToken`. Delete all `VerificationCodes` for that email. Return void. |

### Security Hardening

| Code | Name | Description |
|---|---|---|
| BL-41 | Rate limiting | Auth endpoints: max 10 req/min per IP. Upload endpoints: max 5 req/min. General API: max 200 req/min. Return 429 with `Retry-After` header on breach. |
| BL-42 | Device session management | Each login creates a Session record (`deviceName`, `deviceType`, IP, `lastSeenAt`, `refreshTokenId`). Users can view and revoke sessions. Auto-expire sessions inactive for 30 days. |
| BL-43 | Brute force protection | After 5 consecutive failed logins, lock account for 15 minutes. Store `failedAttempts` + `lockUntil` on user. Reset counter on success. Notify user via email on lock. |

---

## 4. Content Management

### 4.1 Song Status State Machine

| Status | Description |
|---|---|
| PENDING | Uploaded but not yet reviewed by admin. Not visible to users. |
| APPROVED | Admin approved. No drop date set — becomes LIVE immediately. |
| SCHEDULED | Admin approved with a future `dropAt`. Teaser page visible. Audio locked (returns 423). |
| LIVE | Publicly streamable. Appears in browse, search, artist profile, and follower feeds. |
| REJECTED | Admin rejected with a reason string. Artist notified via email. |
| TAKEN DOWN | Previously LIVE song removed by admin following a content report. |

### 4.2 Upload & Approval Workflow

| Code | Name | Description |
|---|---|---|
| BL-48 | Upload restriction | `POST /songs/upload` checks `user.role IN [ARTIST, ADMIN]`. If USER role, throw FORBIDDEN. All uploads regardless of role enter `status=PENDING`. Admin uploads also go through PENDING to maintain audit trail. |
| BL-37 | Song approval workflow | Admin approves (`status=APPROVED` or `SCHEDULED` if `dropAt` set) or rejects (`status=REJECTED`) with a required reason string. Only LIVE songs appear in browse/search. Notify uploader via email. Log to AuditLog (BL-40). |
| BL-44 | File validation on upload | Validate MIME type via magic bytes, enforce max duration (20 min), strip embedded metadata. Reject silently renamed files. Server also generates an AES-256 encrypted `.enc` variant for offline download use. |
| BL-39 | Upload limits | Non-premium ARTIST: max 50 songs, max 50 MB/file. PREMIUM ARTIST: max 200 songs, max 200 MB/file. ADMIN: no limit. Return `UPLOAD_LIMIT_EXCEEDED` with current usage stats on breach. |
| BL-49 | Genre suggestion on upload | Artist may include `suggestedGenres[]` not in the confirmed list. Each creates a `GenreSuggestion` record (name, suggestedBy, songId, status=PENDING). Admin reviews in the same queue as song uploads. On approval: add to confirmed list and tag the song. |

### 4.3 Counters & Computed Fields

| Code | Name | Description |
|---|---|---|
| BL-09 | Song listener counter | Every `GET /songs/:id` increments `song.listener` by 1. |
| BL-10 | Album follower counter | Every `GET /albums/:id` increments `album.follower` by 1. |
| BL-11 | Artist follower counter | Every `GET /artists/:id` increments `artist.follower` by 1. |
| BL-12 | Playlist counters | Every `GET /playlists/:id` increments both `playlist.follower` and `playlist.listener` by 1. |
| BL-14 | Album totalTracks & totalHours | Computed from associated songs. Recalculate on album create/update and when song added/removed. |
| BL-15 | Playlist totalTracks & totalHours | Same pattern as BL-14. Recalculate on playlist create/update and song added/removed. |

### 4.4 Cascade & Deletion Rules

| Code | Name | Description |
|---|---|---|
| BL-16 | Song deletion cascade | On delete: remove song from all playlists. Update album `totalTracks` + `totalHours`. Revoke all DownloadRecords for that song (set `revokedAt = now`). |
| BL-17 | Playlist deletion cascade | On delete: remove from all users' `savedPlaylists`. Remove all playlist-song associations. |
| BL-18 | Album deletion cascade | On delete album: delete ALL songs in that album (triggers BL-16 for each). |
| BL-19 | Artist deletion cascade | On delete: remove artist from all songs' and albums' artist lists. Do NOT delete the songs or albums themselves. |

### 4.5 Playlists & Ownership

| Code | Name | Description |
|---|---|---|
| BL-13 | Save playlist | Add playlist to user's `savedPlaylists` (many-to-many). Increment `playlist.listener` by 1. Return `PlaylistResponse`. |
| BL-22 | Playlist creator assignment | On create: set `creator` = current user from JWT. Creator cannot be changed after creation. |
| BL-50 | Ownership guard | All mutating endpoints on songs and albums: if `user.role == ARTIST`, verify `resource.creatorId == currentUser.id`, throw FORBIDDEN if not. Admins bypass. USERs blocked at route level. |

### 4.6 Moderation & Reporting

| Code | Name | Description |
|---|---|---|
| BL-38 | Content reporting | Any user can report a song, playlist, or artist (`EXPLICIT`, `COPYRIGHT`, `INAPPROPRIATE`). Creates `ContentReport` record. Admins resolve: dismiss or takedown (cascade per BL-16 to BL-19). |
| BL-40 | Audit log | Every admin action writes an `AuditLog` entry (`adminId`, `action`, `targetType`, `targetId`, `timestamp`, `notes`). Read-only. Never delete audit log entries. |

---

## 5. Playback & Streaming

| Code | Name | Description |
|---|---|---|
| BL-28 | Audio quality tiers | Standard 128 kbps for non-premium. High 320 kbps for PREMIUM users. Downgrade on next track request if premium expires mid-session. |
| BL-29 | Playback history | Record `PlaybackHistory` entry (`userId`, `songId`, `playedAt`, `skipped: boolean`) when user plays past 30 seconds. Plays < 10 seconds recorded as `skipped=true`. Cap at 200 entries per user. |
| BL-30 | Resume playback | Store last `positionSeconds` per user per song in `PlaybackState` table. On app load, return last played song + position for 'Continue listening' prompt. |
| BL-31 | Queue management | Transient server-side play queue per user, cleared on logout. Endpoints: add, remove, reorder, clear. Supports shuffle mode. |
| BL-51 | Artist analytics | `GET /artist/me/analytics` — ARTIST role only. Returns per-song play counts, like counts, follower count, top 5 songs by plays in last 30 days. Admins access any artist via `GET /admin/artists/:id/analytics`. |

---

## 6. Social & Discovery

| Code | Name | Description |
|---|---|---|
| BL-32 | Following system | Users can follow other users and artists (many-to-many `user_follows`). Following an artist surfaces their public playlists and drop announcements in the feed. Return follower/following counts on responses. |
| BL-33 | Activity feed | Generate feed from followed users and artists. Events: new playlist, song liked, artist followed, `NEW_RELEASE` (drop fired), `UPCOMING_DROP` (notification). Store as `FeedEvent` (`actorId`, `eventType`, `targetId`, `createdAt`). Return paginated, newest first. |
| BL-34 | Song likes | Users can like/unlike songs. `LikedSongs` is a special auto-created playlist per user. Return `isLiked: boolean` on `SongResponse`. |
| BL-36 | Genre system | Songs and playlists have genres (many-to-many). Confirmed genres are admin-managed. Artists suggest new genres during upload (BL-49). Feeds AI recommendation engine. |

---

## 7. AI Music Recommendation & Smart Playback

> Note: `SCHEDULED` songs are excluded from all recommendation engines — only `LIVE` songs are eligible.

### 7.1 Personalized Recommendation

| Code | Name | Description |
|---|---|---|
| BL-35 | Rules-based recommendation | Recommend LIVE songs from genres played most in last 30 days. Fallback to globally most-listened LIVE songs if sparse. Recalculate daily. |
| BL-35A | Cold start strategy | New users with < 5 non-skipped plays: prompt for genre preferences at onboarding. Use selection to seed initial recommendations. |
| BL-35B | Skip feedback loop | Plays with `skipped=true` (< 10 sec) act as negative signals. Weight skipped songs/artists/genres lower. Skipped weight decays to neutral after 90 days. |

### 7.2 Mood-Based Recommendation

**Mood mapping:**
- Happy → Pop/Dance, 120–145 BPM, high energy
- Sad → Ballad/Acoustic, 60–90 BPM, low energy
- Focus → Lo-fi/Ambient, 70–100 BPM, medium energy
- Chill → R&B/Jazz, 80–110 BPM, low-medium energy
- Workout → EDM/Hip-Hop, 130–175 BPM, very high energy

| Code | Name | Description |
|---|---|---|
| BL-36A | Explicit mood selection | User selects mood. System maps mood → genre/BPM/energy filters and queries LIVE songs. Return as mood playlist. Combinable with BL-35. |
| BL-36B | Inferred mood (context) | If no explicit mood: infer from time of day (morning → focus, night → chill) and day of week (weekend → happy). Fallback to top genre if confidence below threshold. |

### 7.3 Smart Track Transitions

| Code | Name | Description |
|---|---|---|
| BL-37A | Compatibility score | Score consecutive pairs from BPM difference, Camelot key, and energy delta (0–100). Stored as song metadata set on upload. |
| BL-37B | Crossfade | Configurable per user (0–12 sec, default 3s). Server signals to client in `NowPlaying` response. Client handles audio fade. |
| BL-37C | Smart playlist ordering | Reorder tracks to maximize average compatibility using greedy nearest-neighbor. Applied only when user enables 'Smart Order'. |

### 7.4 Context-Aware Recommendation

| Code | Name | Description |
|---|---|---|
| BL-38A | Device context | Mobile → prefer songs < 4 min, higher energy. Desktop → no restriction. Soft filter on BL-35. |
| BL-38B | Time context | Morning 6–10 AM: focus/chill. Afternoon: neutral. Evening 6–10 PM: chill/happy. Night 10 PM–2 AM: lo-fi. |
| BL-38C | Location context | Coarse location → activity context. Location never stored — in-request only. Privacy notice on first grant. |

---

## 8. Premium & Payments

### VNPay Payment Flow

| Code | Name | Description |
|---|---|---|
| BL-20 | Initiate payment | `GET /v1/payment/vn-pay?premiumType=`. Map: 1-month = 30,000 VND, 3-month = 79,000 VND, 6-month = 169,000 VND, 12-month = 349,000 VND. Build VNPay params, sort alphabetically, sign with HMAC-SHA512. Return `paymentUrl`. |
| BL-21 | VNPay callback | On `responseCode == '00'`: calculate `premiumExpiryDate`, set `premiumStatus=true`, add PREMIUM role (does not replace existing roles), save user, send confirmation email. Return `PremiumResponse`. |

---

## 9. Search & Pagination

| Code | Name | Description |
|---|---|---|
| BL-23 | Search | Search format: array of strings e.g. `["name~Rock", "listener>1000"]`. Operators: `~` (LIKE), `>` (gt), `<` (lt). Combined with AND. Build TypeORM QueryBuilder dynamically. Search only returns LIVE songs — SCHEDULED songs excluded. |
| BL-24 | Pagination | Default: `page=1`, `size=10`, `sortBy='id'`. All list endpoints return: `page`, `size`, `totalPages`, `totalItems`, `items[]`. |

---

## 10. Scheduled Tasks

| Code | Name | Schedule | Description |
|---|---|---|---|
| BL-25 | Refresh token cleanup | `0 0 * * *` (daily midnight) | Delete all RefreshToken records where `expiryDate < now`. |
| BL-26 | Premium expiry check | Every hour | Find users where `premiumStatus=true AND premiumExpiryDate < now`. Set `premiumStatus=false`. Remove PREMIUM role. Trigger BL-56 (revoke all download licenses). |
| BL-27 | Verification code cleanup | Every hour | Delete all VerificationCode records where `expirationTime < current time in minutes`. |
| BL-45 | Inactive session cleanup | Daily at 2 AM | Delete Session records where `lastSeenAt < 30 days ago`. Also delete associated refresh tokens. |
| BL-58 | Expired download record cleanup | Daily at 3 AM | Hard-delete DownloadRecord entries where `revokedAt < now - 7 days`. Does not delete server-side audio files. |
| BL-62 | Drop firing cron | Every minute (`* * * * *`) | Query songs `WHERE status=SCHEDULED AND dropAt <= now`. For each: set `status=LIVE`, insert `NEW_RELEASE` FeedEvent for all artist followers, include in search/browse. Log `DROP_FIRED` to AuditLog. |

---

## 11. Offline Downloads

Premium users can download approved songs for offline play. Files are AES-256 encrypted server-side. The client holds a license JWT containing the wrapped decryption key — playback requires a valid, unexpired license. Active premium users never notice the 30-day expiry because licenses auto-revalidate on app open.

### 11.1 Encryption Model

- Server stores two file versions: a streaming version (served as-is) and a download version (`.enc`, AES-256 encrypted with a per-song key).
- The per-song AES key is stored server-side in secure key storage, never sent raw to the client.
- On download, the server wraps the AES key with a user-specific `HMAC(userId + serverSecret)` before embedding it in the license JWT.
- Even if a license JWT is extracted from device storage, it cannot be used on a different account.

### 11.2 Quota Limits

| Role | Quota |
|---|---|
| PREMIUM USER | max 100 downloaded songs |
| PREMIUM ARTIST | max 200 downloaded songs |
| ADMIN | no limit |

> Quota is enforced server-side via DownloadRecord count — never trust the client.

### 11.3 Business Logic

| Code | Name | Description |
|---|---|---|
| BL-52 | Download eligibility check | `POST /songs/:id/download` validates: user has PREMIUM role, song `status` is LIVE, user's `downloadCount` is below quota. Return `DOWNLOAD_LIMIT_EXCEEDED` or `PREMIUM_REQUIRED` on failure. |
| BL-53 | Download license issuance | On pass: retrieve song's AES-256 key, wrap with `HMAC(userId+serverSecret)`, generate license JWT `{ songId, userId, encryptedKey, expiresAt: now+30d, version }`. Create `DownloadRecord` (`userId`, `songId`, `issuedAt`, `expiresAt`, `revokedAt: null`). Return signed one-time download URL (5-min TTL) + license JWT. |
| BL-54 | Download quota tracking | `downloadCount = DownloadRecord WHERE userId=X AND revokedAt IS NULL`. Increment on new download, decrement when user removes a song. Enforce at BL-52 check time. |
| BL-55 | License revalidation (online) | `POST /songs/downloads/revalidate` — called silently on app open when online. For each active DownloadRecord: if PREMIUM still active, reissue fresh license JWT (30-day reset). If PREMIUM lapsed, set `revokedAt=now` and return `revoked: true` so client greys out the song. |
| BL-56 | Premium lapse cascade | When BL-26 cron downgrades a user: set `revokedAt=now` on all their DownloadRecords. Files remain on device but become unplayable at next revalidation. Records kept for 7-day grace period in case user renews. After 7 days, BL-58 hard-deletes. |
| BL-57 | Manual download removal | `DELETE /songs/downloads/:songId` — user removes a downloaded song. Set `DownloadRecord.revokedAt=now`. Return updated `downloadCount`. Client deletes the local `.enc` file. |

---

## 12. Artist Live Drops

Artists schedule a future release date for a song. While `SCHEDULED`, a public teaser page shows title, cover art, and a live countdown — but audio is fully locked. At the exact drop time a per-minute cron fires the release automatically, inserts it into follower feeds, and makes it available in browse and search.

### 12.1 Drop Constraints

- Minimum drop window: **1 hour** from upload time.
- Maximum drop window: **90 days** from upload time.
- Drop date can only be set at upload time or during admin approval — not after going SCHEDULED.
- Artists may reschedule **once** (BL-65), up to 24 hours before the original `dropAt`.
- `SCHEDULED` songs return **HTTP 423 Locked** on any audio stream request — no exceptions.
- `SCHEDULED` songs are excluded from search, browse, and all AI recommendation engines.

### 12.2 Notification Schedule

| Timing | Event |
|---|---|
| 24 hours before `dropAt` | `UPCOMING_DROP` FeedEvent sent to all artist followers |
| 1 hour before `dropAt` | Second `UPCOMING_DROP` FeedEvent sent |
| At `dropAt` | `NEW_RELEASE` FeedEvent sent to followers + direct notification to opted-in users (BL-64) |
| On cancellation | `DROP_CANCELLED` notification to opted-in users and followers who received the 24h notice |

### 12.3 Business Logic

| Code | Name | Description |
|---|---|---|
| BL-59 | Scheduled drop upload | Artist optionally sets `dropAt` (future datetime, min 1h, max 90 days). If `dropAt` set and admin approves: song enters `status=SCHEDULED`. If no `dropAt`: approved songs become LIVE immediately (existing behaviour). |
| BL-60 | Pre-drop public teaser | `GET /songs/:id/teaser` (public, no JWT required). Returns: `title`, `coverArt`, `artistName`, `dropAt`, `countdownSeconds`. Returns 404 if PENDING or REJECTED. Any audio stream endpoint returns 423 Locked for SCHEDULED songs — no exceptions, even for admins. |
| BL-61 | Drop notifications | When song enters SCHEDULED: enqueue two notification jobs — 24h before and 1h before `dropAt`. Each sends `UPCOMING_DROP` FeedEvent to all artist followers. If drop is cancelled before job fires, dequeue both jobs. |
| BL-62 | Drop firing cron | Cron: every minute. Query `WHERE status=SCHEDULED AND dropAt <= now`. For each: set `status=LIVE`, insert `NEW_RELEASE` FeedEvent for followers, add to search/browse. Log `DROP_FIRED` to AuditLog. Index required on `(status, dropAt)`. |
| BL-63 | Drop cancellation | Artist or admin: `DELETE /songs/:id/drop`. Sets `dropAt=null`, reverts `status=APPROVED` (no re-approval needed). Dequeues pending notification jobs. Sends `DROP_CANCELLED` to opted-in users. |
| BL-64 | Notify me opt-in | `POST /songs/:id/notify` (authenticated). Creates `DropNotification` record (`userId`, `songId`). At drop time cron, send direct notification to all opted-in users in addition to followers. `DELETE /songs/:id/notify` to opt out. |
| BL-65 | Drop rescheduling | `PATCH /songs/:id/drop` — artist updates `dropAt` once, at least 24h before original time. New `dropAt` must be at least 1h in future. Reschedule notification jobs. Send `DROP_RESCHEDULED` FeedEvent to opted-in users and followers. Second reschedule requires admin approval. |

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | AI recommendation API latency < 200 ms. General API p95 < 500 ms. Drop firing cron completes within 30 seconds of `dropAt`. |
| Scalability | Supports 20–200 concurrent users now. AI layer designed to scale to 1,000+ with minimal refactoring. |
| Privacy | GDPR-like compliance. Location data (BL-38C) never persisted. AES download keys never sent raw to client. Users can request full data export and account deletion. |
| Observability | Structured logging for all AI recommendation decisions. Cron job execution logged with row counts. Drop firing events logged to AuditLog. Supports A/B testing via feature flags. |
| Availability | Target 99.5% uptime. Scheduled tasks must not impact API response times. Drop cron failure must alert admin. |
| Security | HTTPS only. All endpoints require JWT except public browse and teaser pages. Audit log immutable. Brute force protection on all auth endpoints. Download license JWTs signed and user-scoped. |
| Upload safety | All audio files validated server-side by magic bytes before storage. `.enc` variants generated at upload time — not on demand. |
| DB indexing | Composite index on `songs(status, dropAt)` required for drop cron performance. Index on `download_records(userId, revokedAt)` for quota checks. |

---

## 14. Business Logic Reference Index

All BL codes in numerical order. Total: **65 codes**.

| Code | Name | Section |
|---|---|---|
| BL-01 | User registration | 3. Authentication |
| BL-02 | Login | 3. Authentication |
| BL-03 | Logout | 3. Authentication |
| BL-04 | Refresh token | 3. Authentication |
| BL-05 | Change password | 3. Authentication |
| BL-06 | Forgot password | 3. Authentication |
| BL-07 | Verify code | 3. Authentication |
| BL-08 | Reset password | 3. Authentication |
| BL-09 | Song listener counter | 4. Content Management |
| BL-10 | Album follower counter | 4. Content Management |
| BL-11 | Artist follower counter | 4. Content Management |
| BL-12 | Playlist counters | 4. Content Management |
| BL-13 | Save playlist | 4. Content Management |
| BL-14 | Album totalTracks & totalHours | 4. Content Management |
| BL-15 | Playlist totalTracks & totalHours | 4. Content Management |
| BL-16 | Song deletion cascade | 4. Content Management |
| BL-17 | Playlist deletion cascade | 4. Content Management |
| BL-18 | Album deletion cascade | 4. Content Management |
| BL-19 | Artist deletion cascade | 4. Content Management |
| BL-20 | Initiate payment (VNPay) | 8. Premium & Payments |
| BL-21 | VNPay callback | 8. Premium & Payments |
| BL-22 | Playlist creator assignment | 4. Content Management |
| BL-23 | Search | 9. Search & Pagination |
| BL-24 | Pagination | 9. Search & Pagination |
| BL-25 | Refresh token cleanup (cron) | 10. Scheduled Tasks |
| BL-26 | Premium expiry check (cron) | 10. Scheduled Tasks |
| BL-27 | Verification code cleanup (cron) | 10. Scheduled Tasks |
| BL-28 | Audio quality tiers | 5. Playback & Streaming |
| BL-29 | Playback history | 5. Playback & Streaming |
| BL-30 | Resume playback | 5. Playback & Streaming |
| BL-31 | Queue management | 5. Playback & Streaming |
| BL-32 | Following system | 6. Social & Discovery |
| BL-33 | Activity feed | 6. Social & Discovery |
| BL-34 | Song likes | 6. Social & Discovery |
| BL-35 | Rules-based recommendation | 7. AI Recommendation |
| BL-35A | Cold start strategy | 7. AI Recommendation |
| BL-35B | Skip feedback loop | 7. AI Recommendation |
| BL-36 | Genre system | 6. Social & Discovery |
| BL-36A | Explicit mood selection | 7. AI Recommendation |
| BL-36B | Inferred mood (context) | 7. AI Recommendation |
| BL-37 | Song approval workflow | 4. Content Management |
| BL-37A | Track compatibility score | 7. AI Recommendation |
| BL-37B | Crossfade | 7. AI Recommendation |
| BL-37C | Smart playlist ordering | 7. AI Recommendation |
| BL-38 | Content reporting | 4. Content Management |
| BL-38A | Device context | 7. AI Recommendation |
| BL-38B | Time context | 7. AI Recommendation |
| BL-38C | Location context (optional) | 7. AI Recommendation |
| BL-39 | Upload limits | 4. Content Management |
| BL-40 | Audit log | 4. Content Management |
| BL-41 | Rate limiting | 3. Authentication |
| BL-42 | Device session management | 3. Authentication |
| BL-43 | Brute force protection | 3. Authentication |
| BL-44 | File validation on upload | 4. Content Management |
| BL-45 | Inactive session cleanup (cron) | 10. Scheduled Tasks |
| BL-46 | Artist registration | 3. Authentication |
| BL-47 | Artist profile record | 3. Authentication |
| BL-48 | Upload restriction | 4. Content Management |
| BL-49 | Genre suggestion on upload | 4. Content Management |
| BL-50 | Ownership guard | 4. Content Management |
| BL-51 | Artist analytics | 5. Playback & Streaming |
| BL-52 | Download eligibility check | 11. Offline Downloads |
| BL-53 | Download license issuance | 11. Offline Downloads |
| BL-54 | Download quota tracking | 11. Offline Downloads |
| BL-55 | License revalidation (online) | 11. Offline Downloads |
| BL-56 | Premium lapse cascade | 11. Offline Downloads |
| BL-57 | Manual download removal | 11. Offline Downloads |
| BL-58 | Expired download record cleanup (cron) | 10. Scheduled Tasks |
| BL-59 | Scheduled drop upload | 12. Artist Live Drops |
| BL-60 | Pre-drop public teaser | 12. Artist Live Drops |
| BL-61 | Drop notifications | 12. Artist Live Drops |
| BL-62 | Drop firing cron | 10. Scheduled Tasks |
| BL-63 | Drop cancellation | 12. Artist Live Drops |
| BL-64 | Notify me opt-in | 12. Artist Live Drops |
| BL-65 | Drop rescheduling | 12. Artist Live Drops |
