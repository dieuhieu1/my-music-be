# Music Streaming App — Product Requirements Document
**Version 3.0 · March 2026**

> A self-hosted, ad-free Spotify alternative for small communities (20–200 users).

**v3.0 adds:** Artist Live Drops (BL-59–65)

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
| Payments | VNPay, MoMo |
| Scheduled tasks | Cron jobs (including per-minute for drop firing) |
| Async job queue | **BullMQ (Redis-backed)** — used for drop notification jobs (24h/1h before dropAt), session TTL cleanup, audio metadata extraction (BL-37A), and all async email sending |
| Email | **SMTP via Nodemailer** — all emails sent asynchronously via BullMQ, never blocking API responses |
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
| PREMIUM (tier) | Paid upgrade — stacks on USER or ARTIST | 320 kbps audio, offline downloads (100 songs), higher upload limits. Unlocked via VNPay or MoMo (automatic), or manually granted by Admin. |

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
| BL-01 | User registration | `POST /auth/register` with `role=USER` (default). Fields: `name`, `email`, `password`, `confirmPassword`. Validate email uniqueness, password match, hash with bcrypt (rounds=10), assign USER role, save user with `is_email_verified=false`, generate access + refresh tokens. Send email verification code (6-digit, 10 min expiry) async using the `verification_codes` table. **Unverified users can log in but cannot stream, like, create playlists, or access premium features until email is verified (BL-78).** Return `TokenResponse`. |
| BL-46 | Artist registration | `POST /auth/register` with `role=ARTIST`. All BL-01 fields plus: `stageName` (required), `bio` (required), `genres[]` (required, min 1), `socialLinks[]` (optional). Validate all artist fields before creating any records. On success: create User (role=ARTIST) + ArtistProfile atomically with `is_email_verified=false`. Send email verification code same as BL-01. Unverified artists cannot upload songs. Return `TokenResponse`. |
| BL-47 | Artist profile record | `ArtistProfile` created atomically with User during artist registration. Fields: `userId` (FK, unique), `stageName`, `bio`, `followerCount=0`, `socialLinks[]`, `suggestedGenres[]`. Public immediately via `GET /artists/:id/profile` showing stageName, bio, followerCount, and LIVE songs only. |

### Email Verification

| Code | Name | Description |
|---|---|---|
| BL-78 | Verify email | `POST /auth/verify-email`. Body: `{ email, code }`. Find `VerificationCode` by email + code. Check not expired. Set `is_email_verified=true` on user. Delete the `VerificationCode` record. Return `UserResponse`. |
| BL-79 | Resend verification email | `POST /auth/resend-verification-email`. Authenticated. If `is_email_verified=true`, return error. Generate new 6-digit code, save to `verification_codes` (invalidate previous ones for same email), send verification email. Return `VerificationCodeResponse`. |

### Profile Management

| Code | Name | Description |
|---|---|---|
| BL-66 | Update user profile | `PATCH /users/me`. Authenticated user only. Updatable fields: `name`, `avatarUrl`. Validate name is non-empty. Return `UserResponse`. |
| BL-67 | Update artist profile | `PATCH /artists/me/profile`. ARTIST role only. Updatable fields: `stageName`, `bio`, `avatarUrl`, `socialLinks[]`. Validate stageName is non-empty if provided. Return `ArtistProfileResponse`. |

### Login & Session

| Code | Name | Description |
|---|---|---|
| BL-02 | Login | Find user by email (throw UNAUTHENTICATED if not found). Compare password with bcrypt (throw UNAUTHENTICATED if mismatch). Check account not locked (BL-43). Generate access + refresh tokens, save refresh token, create/update Session record (BL-42). Return `TokenResponse`. |
| BL-03 | Logout | `POST /auth/logout`. Requires `Authorization: Bearer <accessToken>` header. Backend executes the following **sequentially within a single transaction**: (1) **Token invalidation** — extract `jti` from the access token, insert into `InvalidatedToken` table with its expiry to block replay attacks; (2) **Session clearance** — invalidate the refresh token and soft-delete the associated Session record for this device/login instance; (3) **Play queue hard-delete** — permanently delete all queue rows for this user (BL-31, not soft delete). Returns void. **Frontend teardown:** on success, client clears all local auth state (JWT + refresh token from storage/cookies), clears local queue state, and redirects to Login or Home screen. |
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
| BL-42 | Device session management | Each login creates a Session record (`deviceName`, `deviceType`, IP, `lastSeenAt`, `refreshTokenId`). Sessions have a TTL of **30 days from last activity**. On session creation, enqueue a cleanup job at the TTL expiry time — the job hard-deletes the session and its associated refresh token when the TTL hits. BL-45 cron remains as a safety-net sweep. Users can view active sessions via `GET /auth/sessions` and manually revoke any session via `DELETE /auth/sessions/:id` (soft-delete then hard-delete on next cleanup). |
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
| REJECTED | Admin permanently rejected with a reason string. Artist notified via email. Cannot be resubmitted. |
| REUPLOAD_REQUIRED | Admin flagged the song as needing changes (e.g. inappropriate content). Artist notified with reason notes. Artist can edit and resubmit → status returns to `PENDING` (BL-85). |
| TAKEN_DOWN | Previously LIVE song removed by admin following a content report. Can be restored to LIVE by admin (BL-83). |

### 4.2 Upload & Approval Workflow

| Code | Name | Description |
|---|---|---|
| BL-48 | Upload restriction | `POST /songs/upload` checks `user.role IN [ARTIST, ADMIN]`. If USER role, throw FORBIDDEN. All uploads regardless of role enter `status=PENDING`. Admin uploads also go through PENDING to maintain audit trail. |
| BL-37 | Song approval workflow | Admin reviews a PENDING song. Actions: **Approve** → `status=APPROVED` (or `SCHEDULED` if `dropAt` set); **Reject** → `status=REJECTED` with required reason (permanent); **Request reupload** → `status=REUPLOAD_REQUIRED` with required notes (BL-84). Only LIVE songs appear in browse/search. Notify uploader via **in-app notification and email** for all outcomes (approved, rejected, reupload required). Log to AuditLog (BL-40). |
| BL-44 | File validation on upload | Validate MIME type via magic bytes, enforce max duration (20 min), strip embedded metadata. Reject silently renamed files. Server also generates an AES-256 encrypted `.enc` variant for offline download use. |
| BL-39 | Upload limits | Non-premium ARTIST: max 50 songs, max 50 MB/file. PREMIUM ARTIST: max 200 songs, max 200 MB/file. ADMIN: no limit. **Song count is calculated from songs with status `PENDING`, `APPROVED`, `SCHEDULED`, or `LIVE` only — `REJECTED` and `REUPLOAD_REQUIRED` songs do not consume a slot.** Return `UPLOAD_LIMIT_EXCEEDED` with current usage stats on breach. |
| BL-49 | Genre suggestion on upload | Artist may include `suggestedGenres[]` not in the confirmed list. Each creates a `GenreSuggestion` record (`name`, `suggestedBy`, `songId`, `status=PENDING`). Admin reviews in the same queue as song uploads. On approval, the full retroactive tagging workflow below applies. |

**BL-49 Approval & Retroactive Tagging Workflow:**

1. **Approval trigger** — Admin approves a `GenreSuggestion` (e.g. `"Vinahouse"`) via the admin dashboard. The system creates a new confirmed `Genre` entity.
2. **Retroactive scan** — Upon genre creation, the system queries all `GenreSuggestion` records with `status=PENDING` whose `name` matches the approved name (case-insensitive, whitespace-trimmed — `" Vinahouse "`, `"vinahouse"`, and `"VinaHouse"` all match).
3. **Bulk tagging** — The system maps the new `Genre` to all matching songs in a single background operation (enqueued via BullMQ to avoid blocking the admin response).
4. **Cleanup** — All matched `GenreSuggestion` records are marked `status=APPROVED` and the temporary suggestion text is cleared from those songs.
5. **String normalisation rule** — All genre name comparisons must use `LOWER(TRIM(name))` to ensure consistent matching.

### 4.3 Counters & Computed Fields

| Code | Name | Description |
|---|---|---|
| BL-09 | Song listener counter | Every `GET /songs/:id` increments `song.listener` by 1 (all-time counter). Simultaneously **upserts** a record in the `SongDailyStats` table for `(song_id, date=today)`, incrementing its `play_count` by 1. This dual-write feeds both the all-time display counter and the time-bound analytics engine (BL-51). |
| BL-10 | Album listener counter | Every `GET /albums/:id` increments `album.listener` by 1. **Separate from social follow** — `album.followerCount` is only incremented by explicit follow action. |
| BL-11 | Artist listener counter | Every `GET /artists/:id` increments `artist.listener` by 1. **Separate from social follow** — `artist.followerCount` is only incremented by BL-32 (Follow action). |
| BL-12 | Playlist counters | Every `GET /playlists/:id` increments `playlist.listener` by 1. `playlist.follower` is a **view-count proxy** (also incremented on GET) and is separate from the save/follow action (BL-13). |
| BL-14 | Album totalTracks & totalHours | Computed from associated songs. Recalculate on album create/update and when song added/removed. |
| BL-15 | Playlist totalTracks & totalHours | Same pattern as BL-14. Recalculate on playlist create/update and song added/removed. |

### 4.4 Cascade & Deletion Rules

| Code | Name | Description |
|---|---|---|
| BL-16 | Song deletion cascade | On **hard delete**: remove song from all playlists, update album `totalTracks` + `totalHours`, revoke all DownloadRecords for that song (`revokedAt = now`). **TAKEN_DOWN is NOT a delete** — playlist-song associations are preserved. `GET /playlists/:id` still returns TAKEN_DOWN songs in the response array but with `audio_url` omitted/nullified to prevent playback. Frontend renders TAKEN_DOWN songs as greyed-out and unplayable; the queue auto-skips them during full-playlist playback. Users may manually remove a TAKEN_DOWN song from their playlist. |
| BL-17 | Playlist deletion cascade | On delete: remove from all users' `savedPlaylists`. Remove all playlist-song associations. |
| BL-18 | Album deletion cascade | On delete album: delete ALL songs in that album (triggers BL-16 for each). |
| BL-19 | Artist deletion cascade | On delete: remove artist from all songs' and albums' artist lists. Do NOT delete the songs or albums themselves. |

### 4.5 Song Status Transitions (Admin Actions)

| Code | Name | Description |
|---|---|---|
| BL-83 | Restore taken-down song | `PATCH /admin/songs/:id/restore`. ADMIN only. Song must be in `TAKEN_DOWN` status. Set `status=LIVE`. Log to AuditLog (BL-40). Send **in-app notification and email** to the uploader (14.7). Return `SongResponse`. |
| BL-84 | Request reupload | `PATCH /admin/songs/:id/reupload-required`. ADMIN only. Song must be in `PENDING` status. Set `status=REUPLOAD_REQUIRED`, save `reupload_reason` (required notes — e.g. "audio contains explicit content at 1:34"). Notify uploader via email (14.6) and in-app notification. Log to AuditLog (BL-40). Return `SongResponse`. |
| BL-85 | Resubmit song | `PATCH /songs/:id/resubmit`. ARTIST or ADMIN role, own song only. Song must be in `REUPLOAD_REQUIRED` status. Artist may update `title`, `coverArtUrl`, `genreIds`, and replace the audio file. Set `status=PENDING`. Log to AuditLog. Return `SongResponse`. |

### 4.6 Playlists & Ownership

| Code | Name | Description |
|---|---|---|
| BL-13 | Save playlist | Add playlist to user's `savedPlaylists` (many-to-many). Increment `playlist.listener` by 1. Return `PlaylistResponse`. |
| BL-22 | Playlist creator assignment | On create: set `creator` = current user from JWT. Creator cannot be changed after creation. |
| BL-50 | Ownership guard | All mutating endpoints on songs and albums: if `user.role == ARTIST`, verify `resource.creatorId == currentUser.id`, throw FORBIDDEN if not. Admins bypass. USERs blocked at route level. |

### 4.7 Moderation & Reporting

| Code | Name | Description |
|---|---|---|
| BL-38 | Content reporting | Any user can report a song, playlist, or artist (`EXPLICIT`, `COPYRIGHT`, `INAPPROPRIATE`). Creates `ContentReport` record. Admins resolve: dismiss or takedown (cascade per BL-16 to BL-19). |
| BL-40 | Audit log | Every admin action writes an `AuditLog` entry (`adminId`, `action`, `targetType`, `targetId`, `timestamp`, `notes`). Read-only. Never delete audit log entries. |

---

## 5. Playback & Streaming

| Code | Name | Description |
|---|---|---|
| BL-28 | Audio quality tiers | Standard 128 kbps for non-premium. High 320 kbps for PREMIUM users. Downgrade on next track request if premium expires mid-session. |
| BL-29 | Playback history | ~~Removed~~ — playback history tracking is not implemented. The `PlaybackHistory` table and all related recording logic are excluded from the system. |
| BL-30 | Resume playback | Store last `positionSeconds` per user per song in `PlaybackState` table. Expose via `GET /playback/state` (authenticated) — called on app load to return the last played song + position for the 'Continue listening' prompt. Response includes: `songId`, `songTitle`, `coverArt`, `artistName`, `positionSeconds`. Returns `null` if no playback state exists for the user. |
| BL-31 | Queue management | Server-side play queue per user. Endpoints: add, remove, reorder, clear. Supports shuffle mode. On logout: **hard-delete** all queue rows for that user (not soft delete — queue is gone permanently). On next login, queue starts empty; a new queue is created automatically when the user begins playing a song. |
| BL-51 | Artist analytics | `GET /artist/me/analytics` — ARTIST role only. Admins access any artist via `GET /admin/artists/:id/analytics`. Returns: **(1) All-time play counts** per song — sourced from `song.listener` counter (BL-09). **(2) Time-bound plays (last 30 days)** — sourced from `SongDailyStats` table: `SELECT song_id, SUM(play_count) FROM song_daily_stats WHERE date >= NOW() - 30 days GROUP BY song_id`. **(3) Top 5 songs by plays in last 30 days** — derived from the same `SongDailyStats` query, limited to top 5. **(4) Per-song like counts** — sourced from `LikedSongs` playlist associations. **(5) Follower count** — sourced from `ArtistProfile.followerCount`. `SongDailyStats` schema: `(id, song_id FK, date DATE, play_count INT)` with a unique index on `(song_id, date)` for upsert performance. |

---

## 6. Social & Discovery

| Code | Name | Description |
|---|---|---|
| BL-32 | Follow user / artist | `POST /users/:id/follow`. Authenticated user follows another user or artist. **Self-follow is forbidden — throw `FORBIDDEN` if `followeeId === currentUserId`.** Create `user_follows` record. Increment followee's `followerCount`. Following an artist surfaces their public playlists and drop announcements in the feed. Return `FollowStatsResponse`. |
| BL-72 | Unfollow user / artist | `DELETE /users/:id/follow`. Authenticated user unfollows. Soft-delete the `user_follows` record. Decrement followee's `followerCount`. Return `FollowStatsResponse`. |
| BL-73 | Follower / following lists | `GET /users/:id/followers` — paginated list of users who follow user `:id`. `GET /users/:id/following` — paginated list of users/artists that user `:id` follows. Both public. Return `PaginatedData<UserResponse>`. |
| BL-33 | Activity feed | Generate feed from followed users and artists. Events: new playlist, song liked, artist followed, `NEW_RELEASE` (drop fired), `UPCOMING_DROP` (notification). Store as `FeedEvent` (`actorId`, `eventType`, `targetId`, `createdAt`). Return paginated, newest first. |
| BL-34 | Song likes | Users can like/unlike songs. `LikedSongs` is a `Playlist` entity with a special `isLikedSongs: boolean` flag — **created atomically on the user's first like**, not at registration. If the playlist does not exist when a like is recorded, create it first then add the song. Return `isLiked: boolean` on `SongResponse`. |
| BL-36 | Genre system | Songs and playlists have genres (many-to-many). Confirmed genres are admin-managed (CRUD via BL-68–71). Artists suggest new genres during upload (BL-49). Feeds AI recommendation engine. |
| BL-80 | List notifications | `GET /notifications` (authenticated, paginated). Returns the current user's in-app notifications ordered by `created_at DESC`. Each item includes: `id`, `type`, `title`, `body`, `isRead`, `targetId`, `targetType`, `createdAt`. |
| BL-81 | Mark notification read | `PATCH /notifications/:id/read`. Authenticated. Sets `is_read=true` and `read_at=now` on the notification. User can only mark their own notifications. Return updated notification. |
| BL-82 | Unread notification count | `GET /notifications/unread-count`. Authenticated. Returns `{ count: number }` — count of notifications where `is_read=false` for the current user. Used to drive the bell badge in the UI. |

#### Notification `type` Enum

All in-app notifications stored in the `notifications` table must use one of the following `type` values:

| Type | Triggered By |
|---|---|
| `SONG_APPROVED` | BL-37 — admin approves a song |
| `SONG_REJECTED` | BL-37 — admin rejects a song |
| `SONG_REUPLOAD_REQUIRED` | BL-84 — admin requests changes before approval |
| `SONG_RESTORED` | BL-83 — admin restores a taken-down song to LIVE |
| `PREMIUM_ACTIVATED` | BL-21, BL-77, BL-74 — premium activated via payment or admin grant |
| `PREMIUM_REVOKED` | BL-75 — admin manually revokes premium |
| `UPCOMING_DROP` | BL-61 — sent 24h and 1h before `dropAt` to artist followers |
| `NEW_RELEASE` | BL-62, BL-64 — drop fired; sent to artist followers and opted-in users |
| `DROP_CANCELLED` | BL-63 — artist or admin cancels a scheduled drop |
| `DROP_RESCHEDULED` | BL-65 — drop date changed by artist or admin |
| BL-68 | Create genre | `POST /genres`. ADMIN only. Validate `name` is unique (case-insensitive). Create confirmed genre record. Return `GenreResponse`. |
| BL-69 | Update genre | `PATCH /genres/:id`. ADMIN only. Update `name`. Validate new name is unique (case-insensitive). Return updated `GenreResponse`. |
| BL-70 | Delete genre | `DELETE /genres/:id`. ADMIN only. Soft delete the genre. Existing song/playlist associations are kept but the genre no longer appears in browse or suggestion lists. Log to AuditLog (BL-40). |
| BL-71 | List / get genre | `GET /genres` (public, paginated). `GET /genres/:id` (public). Returns confirmed genres only (deleted_at IS NULL). |

---

## 7. AI Music Recommendation & Smart Playback

> Note: `SCHEDULED` songs are excluded from all recommendation engines — only `LIVE` songs are eligible.

### 7.1 Personalized Recommendation

| Code | Name | Description |
|---|---|---|
| BL-35 | Rules-based recommendation | Recommend LIVE songs based on the user's **liked genres** (derived from liked songs and followed artists) since BL-29 playback history is removed. Fallback to globally most-listened LIVE songs if sparse. Recalculate daily via a scheduled batch job. **Storage: Hybrid Cache-Aside** — batch job writes results to a dedicated `recommendation_cache` DB table (persistent source of truth). On request: check Redis first (24h TTL); on cache miss, fetch from DB, return to user, and populate Redis. |
| BL-35A | Cold start strategy | New users with no liked songs or followed artists: prompt for genre preferences at onboarding. Use selection to seed initial recommendations. |
| BL-35B | Skip feedback loop | ~~Removed~~ — depends on `PlaybackHistory` (BL-29, removed). Skip signals are no longer collected. |

### 7.2 Mood-Based Recommendation

**Mood mapping:**
- Happy → Pop/Dance, 120–145 BPM, high energy
- Sad → Ballad/Acoustic, 60–90 BPM, low energy
- Focus → Lo-fi/Ambient, 70–100 BPM, medium energy
- Chill → R&B/Jazz, 80–110 BPM, low-medium energy
- Workout → EDM/Hip-Hop, 130–175 BPM, very high energy

| Code | Name | Description |
|---|---|---|
| BL-36A | Explicit mood selection | User selects mood. System maps mood → genre/BPM/energy filters and queries LIVE songs. Return as mood playlist wrapped in metadata object. Combinable with BL-35. |
| BL-36B | Inferred mood (context) | If no explicit mood: infer from user's **local** time of day and day of week (morning → focus, night → chill, weekend → happy). Client **must** supply either `timezone` (IANA string, e.g. `Asia/Ho_Chi_Minh`) or `local_hour` (0–23 integer) so the server does not use UTC time for inference. Fallback to top genre if confidence below threshold. |

#### Mood Recommendation Endpoint

```
GET /recommendations/mood
```

**Query Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `mood` | No | One of: `happy`, `sad`, `focus`, `chill`, `workout`. If omitted, server infers mood via BL-36B. |
| `timezone` | Conditionally required | IANA timezone string (e.g. `Asia/Ho_Chi_Minh`). Required when `mood` is omitted and `local_hour` is not provided. |
| `local_hour` | Alternative to `timezone` | Integer 0–23 representing the client's current local hour. Accepted as a simpler alternative to `timezone`. |
| `limit` | No | Number of songs to return. Default: 20. Max: 50. |

**Device Context:** Desktop-only for current scope. `X-Device-Type` header and mobile-specific filters (BL-38A) are not implemented.

**Response Payload:**

```json
{
  "mood": "focus",
  "inferredMood": true,
  "localHourUsed": 8,
  "totalItems": 20,
  "items": [ /* SongResponse[] */ ]
}
```

| Field | Description |
|---|---|
| `mood` | The mood used for filtering (either explicit or inferred). |
| `inferredMood` | `true` if mood was inferred from time context; `false` if explicitly provided. |
| `localHourUsed` | The local hour the server resolved from `timezone` or `local_hour`. Useful for client debug and UI labels (e.g. "Your Morning Focus Mix"). |
| `totalItems` | Count of songs returned (≤ `limit`). |
| `items` | Array of `SongResponse` objects (LIVE songs only). |

### 7.3 Smart Track Transitions

| Code | Name | Description |
|---|---|---|
| BL-37A | Compatibility score & audio metadata | Score consecutive pairs from BPM difference, Camelot key, and energy delta (0–100). Full extraction spec below. |
| BL-37B | Crossfade | ~~Removed~~ — crossfade feature removed from product scope to simplify audio player architecture and ensure playback stability. Standard sequential track switching applies. |
| BL-37C | Smart Order | Toggle available in the audio player UI (icon button, similar to Shuffle). **Toggle ON:** client sends queue reorder request to backend; backend reorders all **upcoming unplayed tracks** in the user's current play queue using greedy nearest-neighbor algorithm evaluated on BPM difference, Camelot Key compatibility, and Energy delta (metadata from BL-37A). Reordered queue is persisted server-side (BL-31). Player executes standard sequential playback on the new order — no audio overlap. **Toggle OFF:** queue immediately reverts to original default sequential order. The Smart Order icon in the player reflects active state (highlighted when ON, muted when OFF). |

#### BL-37A: Audio Metadata Extraction & Feedback Mechanism

**1. Processing Architecture (Hybrid Approach)**

The system automatically calculates audio metadata (BPM, Camelot Key, and Energy) from the raw audio file using an asynchronous background worker (Python DSP sidecar using librosa/essentia via BullMQ).

| Field | Editable by Artist | Notes |
|---|---|---|
| BPM | Yes | Auto-extracted, surfaced in upload UI. Artist may override to correct half-time/double-time errors. |
| Camelot Key | Yes | Auto-extracted, surfaced in upload UI. Artist may override. |
| Energy | No | Calculated by machine only. Saved silently to DB. Never exposed to artist. Ensures integrity of compatibility scoring. |

**2. Client-Server Communication (Short-Polling)**

The system uses **Short-Polling** (not WebSockets) to minimize infrastructure complexity.

- On upload success, the server returns a `jobId`.
- The client polls `GET /songs/upload/:jobId/status` every **3 seconds** until the job reaches a terminal state (`completed` or `failed`).

**3. UI State Machine**

| State | Trigger | UI Behaviour |
|---|---|---|
| **Initiation** | File accepted by server | Server returns `jobId`. BPM and Key fields are **disabled** and show a "Processing..." loading state. Polling begins. |
| **Processing** | Poll returns `status: "pending"` or `"processing"` | Fields remain disabled. Loading state persists. |
| **Success** | Poll returns `status: "completed"` | Polling stops. Fields are **auto-filled** with extracted BPM and Key values and **unlocked** for manual override. |
| **Error / Timeout** | Poll returns `status: "failed"` or no response after timeout | Polling stops. Gentle error message shown: *"Auto-extraction failed"*. Fields are **unlocked** so artist can enter values manually. Energy is left null until a successful extraction or resubmission. |

### 7.4 Context-Aware Recommendation

| Code | Name | Description |
|---|---|---|
| BL-38A | Device context | **Desktop only (current scope).** No device filter applied — all songs eligible regardless of duration or energy. Mobile context deferred to a future version. |
| BL-38B | Time context | Morning 6–10 AM: focus/chill. Afternoon: neutral. Evening 6–10 PM: chill/happy. Night 10 PM–2 AM: lo-fi. Always resolved from client's local time (see BL-36B timezone handling). |
| BL-38C | Location context | Coarse location → activity context. Location never stored — in-request only. Privacy notice on first grant. |

---

## 8. Premium & Payments

### VNPay Payment Flow

| Code | Name | Description |
|---|---|---|
| BL-20 | Initiate VNPay payment | `GET /payment/vn-pay?premiumType=`. Map: 1-month = 30,000 VND, 3-month = 79,000 VND, 6-month = 169,000 VND, 12-month = 349,000 VND. Build VNPay params, sort alphabetically, sign with HMAC-SHA512. Return `paymentUrl`. |
| BL-21 | VNPay callback | **First verify signature:** recompute HMAC-SHA512 over all callback params (sorted alphabetically, excluding `vnp_SecureHash`) using the VNPay secret key; reject with 400 if `vnp_SecureHash` mismatch. On `responseCode == '00'`: calculate `premiumExpiryDate`, set `premiumStatus=true`, add PREMIUM role (does not replace existing roles), save user, send in-app + email confirmation. Return `PremiumResponse`. |

### MoMo Payment Flow

| Code | Name | Description |
|---|---|---|
| BL-76 | Initiate MoMo payment | `GET /payment/momo?premiumType=`. Same tier pricing as VNPay. Build MoMo params, sign with HMAC-SHA256. Return `paymentUrl` (MoMo redirect). |
| BL-77 | MoMo callback | Verify MoMo signature: recompute HMAC-SHA256 over the callback params using `accessKey + secretKey`; reject with 400 if signature mismatch. On `resultCode == 0`: calculate `premiumExpiryDate`, set `premiumStatus=true`, add PREMIUM role (does not replace existing roles), save user, send in-app + email confirmation. Return `PremiumResponse`. |

### Admin Manual Premium Management

| Code | Name | Description |
|---|---|---|
| BL-74 | Admin grant premium | `POST /admin/users/:id/premium`. ADMIN only. Body: `{ premiumType, reason }`. Calculate `premiumExpiryDate` from `premiumType` using the same tier durations. Set `premiumStatus=true`, add PREMIUM role. Create a `payment_records` entry with `status=ADMIN_GRANTED` and `amount_vnd=0`. Log to AuditLog (BL-40). Send **in-app notification and email** to user (template 14.2). Return `PremiumResponse`. |
| BL-75 | Admin revoke premium | `DELETE /admin/users/:id/premium`. ADMIN only. Body: `{ reason }`. Set `premiumStatus=false`, remove PREMIUM role. Trigger BL-56 (revoke all download licenses). Log to AuditLog (BL-40). Send **in-app notification and email** to user. Return `UserResponse`. |

---

## 9. Search & Pagination

| Code | Name | Description |
|---|---|---|
| BL-23 | Search | Search format: array of strings e.g. `["name~Rock", "listener>1000"]`. Operators: `~` (LIKE), `>` (gt), `<` (lt). Combined with AND. Build TypeORM QueryBuilder dynamically. **Searches across four entities: songs, albums, artists, and playlists.** Search only returns LIVE songs — SCHEDULED songs excluded from song results. |
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
| BL-52 | Download eligibility check | `POST /songs/:id/download` validates: user has PREMIUM role (or is ADMIN), song `status` is LIVE, user's `downloadCount` is below quota. **ADMIN bypasses the PREMIUM_REQUIRED check entirely and has no download quota.** Return `DOWNLOAD_LIMIT_EXCEEDED` or `PREMIUM_REQUIRED` on failure (non-admin, non-premium users only). |
| BL-53 | Download license issuance | On pass: retrieve song's AES-256 key, wrap with `HMAC(userId+serverSecret)`, generate license JWT `{ songId, userId, encryptedKey, expiresAt: now+30d, version }`. Create `DownloadRecord` (`userId`, `songId`, `issuedAt`, `expiresAt`, `revokedAt: null`). Return signed one-time download URL (5-min TTL) + license JWT. |
| BL-54 | Download quota tracking | `downloadCount = DownloadRecord WHERE userId=X AND revokedAt IS NULL`. Increment on new download, decrement when user removes a song. Enforce at BL-52 check time. |
| BL-55 | License revalidation (online) | `POST /songs/downloads/revalidate` — called silently on app open when online. **Request body: `{ songIds: string[] }` — client sends only the IDs of songs it currently has downloaded locally.** Server queries `DownloadRecord WHERE userId=X AND songId IN (songIds)` for targeted lookup performance. For each matched record: if PREMIUM still active, reissue fresh license JWT (30-day reset); if PREMIUM lapsed, set `revokedAt=now` and return `revoked: true` so client greys out the song. |
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
| At `dropAt` | `NEW_RELEASE` FeedEvent sent to followers + in-app notification to opted-in users (BL-64) |
| On cancellation | `DROP_CANCELLED` notification to opted-in users and followers who received the 24h notice |

### 12.3 Business Logic

| Code | Name | Description |
|---|---|---|
| BL-59 | Scheduled drop upload | Artist optionally sets `dropAt` (future datetime, min 1h, max 90 days). If `dropAt` set and admin approves: song enters `status=SCHEDULED`. If no `dropAt`: approved songs become LIVE immediately (existing behaviour). |
| BL-60 | Pre-drop public teaser | `GET /songs/:id/teaser` (public, no JWT required). Returns: `title`, `coverArt`, `artistName`, `dropAt`, `countdownSeconds`. Returns 404 if PENDING or REJECTED. Any audio stream endpoint returns 423 Locked for SCHEDULED songs — no exceptions, even for admins. |
| BL-61 | Drop notifications | When song enters SCHEDULED: enqueue two notification jobs — 24h before and 1h before `dropAt`. Each sends `UPCOMING_DROP` FeedEvent to all artist followers. If drop is cancelled before job fires, dequeue both jobs. |
| BL-62 | Drop firing cron | Cron: every minute. Query `WHERE status=SCHEDULED AND dropAt <= now`. For each: set `status=LIVE`, insert `NEW_RELEASE` FeedEvent for followers, add to search/browse. Log `DROP_FIRED` to AuditLog. Index required on `(status, dropAt)`. |
| BL-63 | Drop cancellation | Artist or admin: `DELETE /songs/:id/drop`. Sets `dropAt=null`, reverts `status=APPROVED` (no re-approval needed). Dequeues pending notification jobs. Sends `DROP_CANCELLED` to opted-in users. |
| BL-64 | Notify me opt-in | `POST /songs/:id/notify` (authenticated). Creates `DropNotification` record (`userId`, `songId`). At drop time cron, send **in-app notification** to all opted-in users in addition to followers. In-app notification is stored in the `notifications` table and surfaced in the user's notification bell/inbox. `DELETE /songs/:id/notify` to opt out. |
| BL-65 | Drop rescheduling | `PATCH /songs/:id/drop` — artist updates `dropAt` once, at least 24h before original time. New `dropAt` must be at least 1h in future. Reschedule notification jobs. Send `DROP_RESCHEDULED` FeedEvent to opted-in users and followers. **Second reschedule:** artist submits the new `dropAt` → song status reverts to `PENDING` → admin reviews and approves or declines the new release date before it takes effect. |

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

## 14. Email Notification Templates

All emails are sent asynchronously via **BullMQ + Nodemailer (SMTP)** and must never block API responses.

---

### 14.1 Email Verification (sent on BL-01, BL-46, BL-79)

| Field | Value |
|---|---|
| **Subject** | Verify your email — Music App |
| **To** | Registered user email |
| **Body** | Hi `{name}`, your verification code is: **`{code}`**. This code expires in 10 minutes. If you did not register, ignore this email. |
| **Action** | User enters the code in-app → triggers BL-78 |

---

### 14.2 Premium Activation (sent on BL-21, BL-77, BL-74)

| Field | Value |
|---|---|
| **Subject** | Premium activated — Welcome to Music App Premium! |
| **To** | User email |
| **Body** | Hi `{name}`, your Premium plan has been activated successfully. **Plan:** `{premiumType}` · **Expires:** `{premiumExpiryDate}` · **Amount paid:** `{amountVnd}` VND. You now have access to 320 kbps audio, offline downloads (up to 100 songs), and higher upload limits. Enjoy! |
| **Note** | If granted by Admin (BL-74), `Amount paid` shows "Complimentary" and `Plan` shows the tier granted. |

---

### 14.3 Premium Expiry Warning (future cron — not yet a BL)

> Not currently implemented. Recommended: send a warning email 3 days before `premiumExpiryDate`. Add as a new cron BL when ready.

---

### 14.4 Song Approval / Rejection (sent on BL-37, also triggers in-app notification)

| Field | Value |
|---|---|
| **Subject (approved)** | Your song has been approved — Music App |
| **Subject (rejected)** | Your song was not approved — Music App |
| **To** | Song uploader email |
| **Body (approved)** | Hi `{name}`, your song **"`{songTitle}`"** has been approved and is now LIVE on the platform. |
| **Body (rejected)** | Hi `{name}`, your song **"`{songTitle}`"** was not approved. Reason: `{reason}`. You may revise and re-upload. |

---

### 14.6 Reupload Required (sent on BL-84, also triggers in-app notification)

| Field | Value |
|---|---|
| **Subject** | Action required: your song needs changes — Music App |
| **To** | Song uploader email |
| **Body** | Hi `{name}`, your song **"`{songTitle}`"** requires changes before it can be approved. Admin notes: `{reuploadReason}`. Please update your song and resubmit via the app. |

---

### 14.7 Song Restored (sent on BL-83, also triggers in-app notification)

| Field | Value |
|---|---|
| **Subject** | Your song is live again — Music App |
| **To** | Song uploader email |
| **Body** | Hi `{name}`, your song **"`{songTitle}`"** has been restored and is now LIVE on the platform again. |

---

### 14.8 Premium Revoked (sent on BL-75, also triggers in-app notification)

| Field | Value |
|---|---|
| **Subject** | Your Premium has been revoked — Music App |
| **To** | User email |
| **Body** | Hi `{name}`, your Premium access has been revoked by an administrator. Reason: `{reason}`. Your downloaded songs will remain on your device but will become unplayable. Please contact support if you believe this is a mistake. |

---

### 14.9 Account Locked (sent on BL-43)

| Field | Value |
|---|---|
| **Subject** | Your account has been temporarily locked — Music App |
| **To** | User email |
| **Body** | Hi `{name}`, your account has been locked for 15 minutes due to 5 consecutive failed login attempts. If this wasn't you, consider resetting your password. |

---

## 15. Business Logic Reference Index

All BL codes in numerical order. Total: **85 codes**.

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
| BL-20 | Initiate VNPay payment | 8. Premium & Payments |
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
| BL-66 | Update user profile | 3. Authentication |
| BL-67 | Update artist profile | 3. Authentication |
| BL-68 | Create genre | 6. Social & Discovery |
| BL-69 | Update genre | 6. Social & Discovery |
| BL-70 | Delete genre | 6. Social & Discovery |
| BL-71 | List / get genre | 6. Social & Discovery |
| BL-72 | Unfollow user / artist | 6. Social & Discovery |
| BL-73 | Follower / following lists | 6. Social & Discovery |
| BL-74 | Admin grant premium | 8. Premium & Payments |
| BL-75 | Admin revoke premium | 8. Premium & Payments |
| BL-76 | Initiate MoMo payment | 8. Premium & Payments |
| BL-77 | MoMo callback | 8. Premium & Payments |
| BL-78 | Verify email | 3. Authentication |
| BL-79 | Resend verification email | 3. Authentication |
| BL-80 | List notifications | 6. Social & Discovery |
| BL-81 | Mark notification read | 6. Social & Discovery |
| BL-82 | Unread notification count | 6. Social & Discovery |
| BL-83 | Restore taken-down song | 4. Content Management |
| BL-84 | Request reupload | 4. Content Management |
| BL-85 | Resubmit song | 4. Content Management |
