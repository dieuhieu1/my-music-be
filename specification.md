# Music Streaming App — Specification Document
**Version 1.1 · March 2026**

> Companion to `requirements_en.md` v3.0. Defines users, song lifecycle, visibility rules, and the complete screen inventory for the web desktop app.

---

## 1. Who Are the Users?

### 1.1 Core Roles
Roles are stored in a `user_roles` many-to-many join table — never as a single enum column. Roles are additive (e.g. a user can hold `ARTIST + PREMIUM` simultaneously).

| Role | How They Join | Core Capability |
|---|---|---|
| **USER** | Self-register (`role=USER`, default) | Stream, like, follow, create & save playlists. Cannot upload music. |
| **ARTIST** | Self-register (`role=ARTIST`) | Everything USER can do + upload songs, manage own albums, public artist profile, schedule drops, view own analytics. |
| **ADMIN** | Manually assigned by platform operator | Everything ARTIST can do + approve/reject content, manage genres, moderate reports, manage all users & sessions, view immutable audit log. |

### 1.2 PREMIUM Tier
`PREMIUM` is a **payment tier**, not a role. It stacks on top of `USER` or `ARTIST`.

| How Unlocked | Effect |
|---|---|
| VNPay or MoMo payment (automatic) | Adds PREMIUM role, sets `premiumExpiryDate` |
| Admin manual grant (BL-74) | Same as above, `amount_vnd = 0` |

**PREMIUM benefits:**
- 320 kbps audio (vs 128 kbps standard)
- Offline downloads: 100 songs (PREMIUM USER), 200 songs (PREMIUM ARTIST)
- Higher upload limits: 200 songs / 200 MB per file

**ADMIN privilege:** ADMIN bypasses all PREMIUM checks — unlimited downloads, no quota.

### 1.3 Unverified State
After registration all users start as `is_email_verified = false`.

**Unverified users cannot:** stream, like songs, create playlists, access premium features, or upload songs.
Email verification (BL-78) unlocks full access. This restriction applies globally to all authenticated-only screens.

### 1.4 ADMIN Ownership Bypass
ADMIN role bypasses all ownership guards (BL-50). ADMIN can view, edit, and delete **any** user's songs, albums, and playlists. ARTISTs are restricted to their own content. USERs are blocked at the route level from all mutating upload/album/song endpoints.

---

## 2. Song Status State Machine

Every song in the system has a `status` field. Understanding this lifecycle is required to implement all screens in Section 3.

### 2.1 Status Definitions

| Status | Visible To | Description |
|---|---|---|
| `PENDING` | Owner + ADMIN | Uploaded but not yet reviewed. Not shown in browse, search, or feeds. |
| `APPROVED` | Owner + ADMIN | Admin approved. No `dropAt` set — becomes `LIVE` immediately. |
| `SCHEDULED` | Public (teaser only) | Admin approved with a future `dropAt`. Teaser page visible. **Audio returns HTTP 423 Locked on any stream request — no exceptions, even for ADMIN.** Excluded from search, browse, and all recommendation engines. |
| `LIVE` | Everyone | Publicly streamable. Appears in browse, search, artist profile, follower feeds, and recommendations. |
| `REJECTED` | Owner + ADMIN | Admin permanently rejected with a required reason. Artist notified via email + in-app notification. Cannot be resubmitted. |
| `REUPLOAD_REQUIRED` | Owner + ADMIN | Admin flagged with required change notes. Artist can edit and resubmit → returns to `PENDING`. |
| `TAKEN_DOWN` | Owner + ADMIN | Previously LIVE, removed after a content report. Can be restored to `LIVE` by ADMIN only. |

### 2.2 Status Transition Diagram

```
                  ┌──────────────────────────────────────┐
                  │                                      │
Upload ──► PENDING ──► APPROVED ──► LIVE ◄── TAKEN_DOWN  │
              │            │                    ▲         │
              │            └──► SCHEDULED ──────┘         │
              │                  (dropAt fires)            │
              ├──► REJECTED                               │
              └──► REUPLOAD_REQUIRED ──► PENDING ─────────┘
                         (artist resubmits)
```

### 2.3 Global Visibility Rule
> All browse, search, and recommendation endpoints return **LIVE songs only** unless explicitly noted otherwise.
> SCHEDULED songs appear only on the public teaser page (I1). PENDING, REJECTED, REUPLOAD_REQUIRED, and TAKEN_DOWN songs are only visible to the song owner and ADMIN.

---

## 3. Screen List

### Area A — Authentication · 7 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| A1 | User Registration | Public | Enter name, email, password, confirm password. Assigns USER role. Sends 6-digit verification email (10-min expiry). Returns access + refresh tokens. | BL-01 |
| A2 | Artist Registration | Public | All A1 fields + stageName (required), bio (required), genres[] (min 1), socialLinks[] (optional). Creates User + ArtistProfile atomically in a single transaction. Sends verification email. | BL-46, BL-47 |
| A3 | Email Verification | Authenticated (unverified) | Enter 6-digit code. Resend option available. On success: `is_email_verified=true`, all restricted features unlocked. | BL-78, BL-79 |
| A4 | Login | Public | Email + password. Brute-force protection: 5 consecutive failures → account locked 15 min + email alert sent. Creates device session (30-day TTL from last activity). Returns access + refresh tokens. | BL-02, BL-42, BL-43 |
| A5 | Forgot Password | Public | Enter email → server generates 6-digit code (10-min expiry), sends via SMTP asynchronously (non-blocking). | BL-06 |
| A6 | Verify Reset Code | Public | Enter 6-digit code → server issues a reset JWT (15-min TTL). | BL-07 |
| A7 | Reset Password | Public (with valid reset JWT) | Enter new password + confirm. Hash with bcrypt (rounds=10). Deletes all VerificationCodes and the ForgotPasswordToken for that email. | BL-08 |

---

### Area B — Account & Settings · 5 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| B1 | My Profile | USER / ARTIST / ADMIN | View name, avatar, follower count, following count. Links to: Liked Songs (G5), Saved Playlists (G6), and for ARTISTs: My Artist Profile (C2). **Logout button** — `POST /auth/logout`: (1) server invalidates JWT `jti` in `InvalidatedToken` table; (2) invalidates refresh token + Session record for this device; (3) hard-deletes user's play queue. Client clears all local auth state + queue state, redirects to Login/Home. | BL-66, BL-03 |
| B2 | Edit User Profile | USER / ARTIST / ADMIN | `PATCH /users/me` — update name (non-empty required), avatarUrl. Returns UserResponse. | BL-66 |
| B3 | Change Password | USER / ARTIST / ADMIN | Verify current password with bcrypt. Enter new password + confirm. Update hash in DB. | BL-05 |
| B4 | Active Sessions | USER / ARTIST / ADMIN | List active device sessions: device name, IP, last seen, login date. Revoke any session individually (`DELETE /auth/sessions/:id`). Sessions hard-deleted after 30 days of inactivity by cron (BL-45). | BL-42, BL-45 |
| B5 | Premium Status | PREMIUM USER / PREMIUM ARTIST / ADMIN | View current plan tier, expiry date, downloads used / quota. Renew button → J1. Shown to ADMIN even without PREMIUM (displays "Unlimited"). | BL-26, BL-52 |

---

### Area C — Artist Profile · 3 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| C1 | Public Artist Profile | Public (no JWT required) | stageName, bio, avatarUrl, followerCount, listenerCount, socialLinks. Shows **LIVE songs only**. Follow / Unfollow button (self-follow forbidden). **`artist.listenerCount` increments on every `GET /artists/:id` request (BL-11). `artist.followerCount` is only incremented by BL-32 (explicit Follow action).** | BL-47, BL-11 |
| C2 | My Artist Profile | ARTIST / ADMIN | Same as C1 + Edit button, links to My Songs (D2), Song Analytics (D3), list of pending genre suggestions with their review status. | BL-47, BL-51 |
| C3 | Edit Artist Profile | ARTIST only | `PATCH /artists/me/profile` — update stageName (non-empty if provided), bio, avatarUrl, socialLinks[]. Returns ArtistProfileResponse. | BL-67 |

---

### Area D — Song Management · 7 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| D1 | Upload Song | ARTIST (verified) / ADMIN | Upload audio file (magic-byte MIME validation, max 20 min duration). Set title, coverArtUrl, albumId, genreIds[], optional dropAt (min 1h / max 90 days from now), suggestedGenres[]. All uploads enter `status=PENDING`. Upload slot enforced: count of songs with status `PENDING + APPROVED + SCHEDULED + LIVE` must be below limit. Server generates AES-256 `.enc` variant for offline use (BL-44). Returns jobId for extraction polling (D6). | BL-48, BL-37A, BL-39, BL-44, BL-49, BL-59 |
| D2 | My Songs | ARTIST (own) / ADMIN (all) | List songs grouped by status. Per-song actions by status: **PENDING** — view only; **APPROVED / LIVE** — edit metadata (D3a), delete; **REUPLOAD_REQUIRED** — view reason, resubmit (D4); **SCHEDULED** — cancel drop (I3), reschedule (I4); **REJECTED** — view reason only; **TAKEN_DOWN** — ADMIN only: restore to LIVE (BL-83). | BL-50, BL-83, BL-85, BL-63, BL-65 |
| D3 | Song Analytics | ARTIST (own) / ADMIN (any artist) | `GET /artist/me/analytics` (ARTIST) or `GET /admin/artists/:id/analytics` (ADMIN). Shows: **(1) All-time plays per song** — from `song.listener` counter (BL-09); **(2) Time-bound plays (last 30 days)** — from `SongDailyStats` table, summed per song for the last 30 days; **(3) Top 5 songs by plays in last 30 days** — derived from `SongDailyStats`; **(4) Per-song like counts** — from LikedSongs associations; **(5) Follower count** — from `ArtistProfile.followerCount`. Every `GET /songs/:id` dual-writes: increments `song.listener` AND upserts `SongDailyStats(song_id, date, play_count)` atomically. | BL-51, BL-09 |
| D3a | Edit Song Metadata | ARTIST (own, APPROVED/LIVE only) / ADMIN (any) | `PATCH /songs/:id` — update title, coverArtUrl, genreIds[]. Audio file cannot be replaced on LIVE/APPROVED songs (use D4 for REUPLOAD_REQUIRED flow). Ownership guard enforced for ARTIST (BL-50). | BL-50 |
| D4 | Resubmit Song | ARTIST (own, `REUPLOAD_REQUIRED` only) | Displays admin's `reupload_reason` notes. Artist may update: title, coverArtUrl, genreIds[], replace audio file. Replacing audio re-triggers extraction (new jobId — same polling as D6). `PATCH /songs/:id/resubmit` → `status=PENDING`. Logs to AuditLog. | BL-85 |
| D5 | Song Approval Queue | ADMIN only | List all `PENDING` songs + pending GenreSuggestions. Per-song actions: **Approve** (→ `LIVE`, or `SCHEDULED` if `dropAt` is set) / **Reject** (requires reason string, permanent, notifies uploader via email + in-app `SONG_REJECTED`) / **Request Reupload** (requires notes, notifies uploader via email + in-app `SONG_REUPLOAD_REQUIRED`). Per genre suggestion: **Approve** (creates Genre entity, enqueues retroactive BullMQ bulk-tagging job with `LOWER(TRIM(name))` matching, marks all matched GenreSuggestions as approved) / **Reject**. All actions logged to AuditLog (BL-40). | BL-37, BL-84, BL-49, BL-40 |
| D6 | Audio Extraction Status | ARTIST / ADMIN (inline within D1 / D4) | Polls `GET /songs/upload/:jobId/status` every 3 s. **4 UI states:** (1) Initiation — BPM + Key fields disabled, "Processing…" shown; (2) Processing — polling continues; (3) Success — BPM + Key auto-filled, fields unlocked for artist override (Energy saved silently to DB, never shown); (4) Error / Timeout — fields unlocked, "Auto-extraction failed" message shown for manual entry. | BL-37A |

---

### Area E — Browse & Discovery · 5 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| E1 | Home / Landing | Public + Authenticated | Featured SCHEDULED song teasers (carousel, links to I1), trending LIVE songs (by `listener` count), featured artists, featured playlists. Authenticated + verified users see a personalized recommendations section (BL-35). | BL-35, BL-09, BL-11 |
| E2 | Browse / Discover | Authenticated (verified) | Paginated LIVE songs only. Filter by genre, mood. Per-song actions: play, like/unlike, save to playlist, **report** (`POST /reports` with type `EXPLICIT / COPYRIGHT / INAPPROPRIATE` and `targetType=SONG` — BL-38), download (PREMIUM only). Song `listener` counter increments on every `GET /songs/:id` (BL-09). | BL-09, BL-23, BL-24, BL-35, BL-36A, BL-36B, BL-38 |
| E3 | Search Results | Authenticated (verified) | Search across **4 entity types**: songs (`LIVE` only), albums, artists, playlists. Filter format: `["name~Rock", "listener>1000"]` (operators: `~` LIKE, `>` gt, `<` lt, combined with AND). Paginated. | BL-23, BL-24 |
| E4 | Genre Browsing | Authenticated | `GET /genres` — paginated list of confirmed genres (soft-deleted excluded). Click genre → filtered E2/E3 results by that genre. | BL-71 |
| E5 | Report Content | Authenticated (verified, inline modal) | Triggered from E2, G2, C1, or H4 via a "Report" action. `POST /reports` with fields: `targetType` (SONG / PLAYLIST / ARTIST), `targetId`, `type` (EXPLICIT / COPYRIGHT / INAPPROPRIATE), optional `notes`. Creates `ContentReport` record for admin review (L4). | BL-38 |

---

### Area F — Playback · 2 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| F1 | Now Playing / Player | Authenticated (verified) | Play/pause/seek. Audio quality: 128 kbps (standard) or 320 kbps (PREMIUM) — downgrades on next track if premium expires mid-session. ~~Crossfade removed (BL-37B deprecated)~~ — standard sequential playback only, no audio overlap. **Smart Order toggle** (icon button in player bar, similar to Shuffle): **ON** — backend reorders all upcoming unplayed queue tracks using greedy nearest-neighbor on BPM + Camelot Key + Energy (BL-37A metadata), persisted server-side; icon highlighted; **OFF** — queue reverts to original sequential order; icon muted. Like/save/download (PREMIUM) actions. Resume position from `PlaybackState` via `GET /playback/state` on app load. **SCHEDULED songs return HTTP 423 Locked — no exceptions.** | BL-28, BL-30, BL-31, BL-37C |
| F2 | Play Queue | Authenticated (verified) | Server-side queue per user. Endpoints: add, remove, reorder, clear, toggle shuffle. **Hard-deleted on logout** (not soft delete — queue is permanently gone). New queue auto-created when user next begins playing. | BL-31 |

---

### Area G — Playlists & Albums · 10 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| G1 | Browse Playlists | Authenticated | Paginated list of public playlists. Both `playlist.follower` and `playlist.listener` increment on every `GET /playlists/:id` (BL-12). Actions: save to savedPlaylists (BL-13), view details. | BL-12, BL-13, BL-24 |
| G2 | Playlist Details | Authenticated | Shows name, creator, description, coverArt, follower count, listener count, totalTracks, totalHours. Both `follower` and `listener` counters increment on every `GET /playlists/:id` (BL-12). **TAKEN_DOWN songs:** remain in the playlist (not removed); rendered greyed-out and unplayable — `audio_url` is omitted in the API response. Queue auto-skips TAKEN_DOWN tracks during full-playlist playback. User may manually remove a greyed-out track. **If creator:** add songs, remove songs (including greyed-out TAKEN_DOWN songs), reorder songs, `DELETE /playlists/:id` (BL-17 cascade). **If not creator:** save to savedPlaylists (BL-13), like individual LIVE songs (BL-34), report playlist (E5). | BL-12, BL-13, BL-15, BL-16, BL-17, BL-38 |
| G3 | Create Playlist | Authenticated (verified) | `POST /playlists` — name (required), description (optional), coverArtUrl (optional). Creator auto-assigned from JWT, cannot be changed after creation. Returns PlaylistResponse. | BL-22 |
| G4 | Edit Playlist | Creator only | `PATCH /playlists/:id` — update name, description, coverArtUrl. Ownership guard enforced: ARTIST and USER restricted to own playlists. **ADMIN can edit any playlist.** | BL-50 |
| G5 | Liked Songs | Authenticated (verified) | Special playlist with `isLikedSongs=true` flag. **Created atomically on user's first like action — not at registration.** Unlike removes the song. Shows totalTracks, totalHours. Accessible from B1 (My Profile). Mood playlists are ephemeral (not auto-saved here). | BL-34, BL-15 |
| G6 | Saved Playlists | Authenticated | List all playlists saved by the current user. Saving increments `playlist.listener` by 1 (BL-13). Actions per entry: remove from saved, play all, view details (G2). | BL-13 |
| G7 | Mood Playlist | Authenticated (verified) | `GET /recommendations/mood`. Query params: `mood` (optional: `happy\|sad\|focus\|chill\|workout`), `timezone` (IANA string, e.g. `Asia/Ho_Chi_Minh`) or `local_hour` (0–23 int) — required when mood is omitted to prevent UTC inference error, `limit` (default 20, max 50). Response: `{ mood, inferredMood: boolean, localHourUsed, totalItems, items[] }`. LIVE songs only. Mood playlists are generated on-demand and not auto-saved — user must manually create a playlist (G3) to persist them. | BL-36A, BL-36B |
| G8 | Album Details | Authenticated | title, artist name, description, coverArt, totalTracks, totalHours. `album.listener` increments on every `GET /albums/:id` (BL-10). `album.followerCount` is separate and only incremented by explicit follow action. Displays **LIVE songs only**. **If creator:** add songs, remove songs (BL-16 cascade per removed song), edit metadata (G9), `DELETE /albums/:id` (BL-18 cascade: deletes ALL songs in album, triggers BL-16 for each). **If not creator:** follow/unfollow, report (E5). | BL-10, BL-14, BL-18, BL-38 |
| G9 | Create Album | ARTIST (verified) / ADMIN | `POST /albums` — name (required), description (optional), coverArtUrl (optional). Creator auto-assigned from JWT. Returns AlbumResponse with totalTracks=0, totalHours=0. | BL-14 |
| G10 | Edit Album | ARTIST (own) / ADMIN (any) | `PATCH /albums/:id` — update name, description, coverArtUrl. Ownership guard enforced for ARTIST (BL-50). ADMIN can edit any album. | BL-14, BL-50 |

---

### Area H — Social & Notifications · 4 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| H1 | Activity Feed | Authenticated (verified) | Feed generated from followed users and artists. Event types stored as `FeedEvent`: `NEW_PLAYLIST`, `SONG_LIKED`, `ARTIST_FOLLOWED`, `NEW_RELEASE` (drop fired — BL-62), `UPCOMING_DROP` (24h/1h before drop — BL-61). Paginated, newest first. | BL-33 |
| H2 | Followers / Following | Authenticated (public) | `GET /users/:id/followers` — paginated list of users who follow this user. `GET /users/:id/following` — paginated list of users/artists this user follows. Follow/Unfollow toggle: `POST /users/:id/follow` (BL-32) / `DELETE /users/:id/follow` (BL-72). Following an artist surfaces their LIVE songs, public playlists, and drop announcements in H1. | BL-32, BL-72, BL-73 |
| H3 | Notification Inbox | Authenticated | `GET /notifications` — paginated, ordered by `created_at DESC`. Unread count badge (`GET /notifications/unread-count`). Mark as read (`PATCH /notifications/:id/read` — user can only mark own). **10 notification types:** `SONG_APPROVED`, `SONG_REJECTED`, `SONG_REUPLOAD_REQUIRED`, `SONG_RESTORED`, `PREMIUM_ACTIVATED`, `PREMIUM_REVOKED`, `UPCOMING_DROP`, `NEW_RELEASE`, `DROP_CANCELLED`, `DROP_RESCHEDULED`. | BL-80, BL-81, BL-82 |
| H4 | Other User Profile | Authenticated | View name, avatar, follower count, following count, public playlists. Follow/Unfollow button — `POST /users/:id/follow` / `DELETE /users/:id/follow`. **Self-follow forbidden: throws `FORBIDDEN` if `followeeId === currentUserId`.** Report artist: E5 with `targetType=ARTIST`. | BL-32, BL-72, BL-38 |

---

### Area I — Artist Live Drops · 4 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| I1 | Drop Teaser Page | **Public (no JWT required)** | `GET /songs/:id/teaser`. Displays: title, coverArt, artistName, dropAt datetime, live countdown timer. "Notify Me" button: `POST /songs/:id/notify` (authenticated) — creates `DropNotification` record; opt-out: `DELETE /songs/:id/notify`. At `dropAt`, opted-in users receive in-app `NEW_RELEASE` notification (BL-64). No audio on this page — any stream attempt returns **HTTP 423 Locked**. Returns 404 if status is `PENDING` or `REJECTED`. | BL-60, BL-64 |
| I2 | Drop Management Dashboard | ARTIST / ADMIN | List all own SCHEDULED songs (ARTIST) or all SCHEDULED songs (ADMIN) with live countdown timers and opt-in user count. Actions per drop: view teaser (I1), cancel drop (I3), reschedule drop (I4). | BL-59, BL-63, BL-65 |
| I3 | Cancel Drop | ARTIST (own) / ADMIN (any) | `DELETE /songs/:id/drop` → sets `dropAt=null`, `status=APPROVED` (no re-approval needed). Dequeues all pending 24h/1h BullMQ notification jobs. Sends `DROP_CANCELLED` in-app notification to all opted-in users. Logs to AuditLog. | BL-63 |
| I4 | Reschedule Drop | ARTIST (own) / ADMIN (any) | `PATCH /songs/:id/drop`. **First reschedule:** new `dropAt` must be ≥1h in future AND ≥24h before original `dropAt`. Reschedules notification jobs. Sends `DROP_RESCHEDULED` FeedEvent to opted-in users and followers. **Second reschedule:** `status → PENDING` → admin reviews via D5 and approves/rejects the new release date before the rescheduled drop is executed. | BL-65 |

---

### Area J — Premium & Payments · 3 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| J1 | Pricing & Purchase | USER / ARTIST | Display 4 tier options: 1-month (30,000 VND), 3-month (79,000 VND), 6-month (169,000 VND), 12-month (349,000 VND). Select tier + payment method (VNPay or MoMo) → redirect to J2 or J3. | BL-20, BL-76 |
| J2 | VNPay Payment | USER / ARTIST | `GET /payment/vn-pay?premiumType=`. Server builds VNPay params, sorts alphabetically, signs with HMAC-SHA512. Redirects user to VNPay gateway. **Callback first verifies `vnp_SecureHash` (recomputed HMAC-SHA512) — rejects with 400 on mismatch.** On `responseCode == '00'`: sets `premiumStatus=true`, adds PREMIUM role, calculates `premiumExpiryDate`, creates `payment_records` entry, sends in-app `PREMIUM_ACTIVATED` + email confirmation. | BL-20, BL-21 |
| J3 | MoMo Payment | USER / ARTIST | `GET /payment/momo?premiumType=`. Server signs with HMAC-SHA256. Redirects to MoMo gateway. **Callback first verifies HMAC-SHA256 signature — rejects with 400 on mismatch.** On `resultCode == 0`: same outcome as J2. | BL-76, BL-77 |

---

### Area K — Offline Downloads · 2 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| K1 | Download Song | PREMIUM USER / PREMIUM ARTIST / ADMIN | `POST /songs/:id/download`. Eligibility checks: (1) user has PREMIUM role **or** is ADMIN — ADMIN bypasses PREMIUM check entirely; (2) song `status=LIVE`; (3) `downloadCount < quota` (100 / 200 / unlimited for ADMIN). On pass: retrieves AES-256 song key, wraps with `HMAC(userId+serverSecret)`, issues license JWT (`{ songId, userId, encryptedKey, expiresAt: now+30d, version }`). Creates `DownloadRecord`. Returns one-time signed download URL (5-min TTL) + license JWT. | BL-52, BL-53, BL-54 |
| K2 | Downloaded Songs Library | PREMIUM USER / PREMIUM ARTIST / ADMIN | Lists all downloaded songs with status: valid / expiring / revoked / taken-down. Quota display (e.g. "42 / 100"; ADMIN shows "Unlimited"). **TAKEN_DOWN songs:** rendered greyed-out and unplayable (same as G2); `audio_url` omitted in revalidation response; DownloadRecord is kept but the song cannot be played even with a valid license JWT. User may remove manually. Remove song: `DELETE /songs/downloads/:songId` — sets `revokedAt=now`, decrements `downloadCount`. **Silent revalidation on every app open (online):** `POST /songs/downloads/revalidate` with `{ songIds: string[] }` — server queries only the provided IDs for performance. Active PREMIUM: reissues fresh license JWT (30-day reset). Lapsed PREMIUM: sets `revokedAt=now`, client greys out song. Grace period: revoked records kept 7 days (BL-58 hard-deletes after). | BL-16, BL-55, BL-56, BL-57, BL-58 |

---

### Area L — Admin · 6 screens

| # | Screen | Access | Key Function | BL Codes |
|---|---|---|---|---|
| L1 | Admin Dashboard | ADMIN | Overview stats: total users, artists, songs, playlists, albums. Count of PENDING uploads, REUPLOAD_REQUIRED songs, open ContentReports. Quick-links to all admin areas. | — |
| L2 | Genre Management | ADMIN | `POST /genres` (create — name unique, case-insensitive). `PATCH /genres/:id` (update name — validate unique). `DELETE /genres/:id` (soft delete — existing song/playlist associations kept, genre hidden from browse and suggestions). Genre approval from D5 triggers BullMQ retroactive bulk-tagging: query all `GenreSuggestion` records matching `LOWER(TRIM(name))`, map new Genre to all matched songs, mark matched suggestions approved. All actions logged to AuditLog (BL-40). | BL-68, BL-69, BL-70, BL-71, BL-49 |
| L3 | User Management | ADMIN | List / search users by name or email. Per-user view: roles, PREMIUM status + expiry. Actions: promote/demote roles; **Grant premium** — `POST /admin/users/:id/premium` with `{ premiumType, reason }`, creates `payment_records` entry with `status=ADMIN_GRANTED, amount_vnd=0`, sends `PREMIUM_ACTIVATED` in-app + email; **Revoke premium** — `DELETE /admin/users/:id/premium` with `{ reason }`, triggers BL-56 download revoke cascade, sends `PREMIUM_REVOKED` in-app + email; view + revoke user sessions. All actions logged to AuditLog. | BL-74, BL-75, BL-42 |
| L4 | Content Reports & Moderation | ADMIN | List `ContentReport` records. Filter by `type` (EXPLICIT / COPYRIGHT / INAPPROPRIATE) and `status` (PENDING / RESOLVED / DISMISSED). Per-report actions: **Dismiss** — `status=DISMISSED`, no further action; **Take Down** — song `status=TAKEN_DOWN`, BL-16 cascade applied (removed from search/browse), uploader notified via in-app + email, `status=RESOLVED`. Taken-down songs can be restored via D2 (BL-83). All actions logged to AuditLog (BL-40). | BL-38, BL-40, BL-83 |
| L5 | Audit Log | ADMIN | **Read-only, immutable.** All admin actions logged with: `adminId`, `action`, `targetType`, `targetId`, `timestamp`, `notes`. Filter by date range, action type, admin user. Entries are never deleted. | BL-40 |
| L6 | Payment Records | ADMIN | List all `payment_records` (VNPay, MoMo, ADMIN_GRANTED). Filter by status, date range, payment method, user. Displays: user email, method, amount VND, status, tier, expiry date. | BL-20, BL-21, BL-74, BL-76, BL-77 |

---

## 4. Screen Count Summary

| Area | Screens | Count |
|---|---|---|
| A — Authentication | A1–A7 | 7 |
| B — Account & Settings | B1–B5 | 5 |
| C — Artist Profile | C1–C3 | 3 |
| D — Song Management | D1–D6, D3a | 7 |
| E — Browse & Discovery | E1–E5 | 5 |
| F — Playback | F1–F2 | 2 |
| G — Playlists & Albums | G1–G10 | 10 |
| H — Social & Notifications | H1–H4 | 4 |
| I — Artist Live Drops | I1–I4 | 4 |
| J — Premium & Payments | J1–J3 | 3 |
| K — Offline Downloads | K1–K2 | 2 |
| L — Admin | L1–L6 | 6 |
| **Total** | | **58** |

---

## 5. Role × Screen Access Matrix

| Screen | Public | USER | ARTIST | ADMIN | Requires PREMIUM |
|---|---|---|---|---|---|
| A1 User Registration | ✓ | | | | |
| A2 Artist Registration | ✓ | | | | |
| A3 Email Verification | | ✓ | ✓ | ✓ | |
| A4 Login | ✓ | | | | |
| A5–A7 Password flows | ✓ | | | | |
| B1–B4 Account | | ✓ | ✓ | ✓ | |
| B5 Premium Status | | ✓ | ✓ | ✓ | ✓ (USER/ARTIST) |
| C1 Public Artist Profile | ✓ | ✓ | ✓ | ✓ | |
| C2 My Artist Profile | | | ✓ | ✓ | |
| C3 Edit Artist Profile | | | ✓ | | |
| D1 Upload Song | | | ✓ | ✓ | |
| D2 My Songs | | | ✓ | ✓ | |
| D3 Song Analytics | | | ✓ (own) | ✓ (any) | |
| D3a Edit Song Metadata | | | ✓ (own) | ✓ (any) | |
| D4 Resubmit Song | | | ✓ (own) | | |
| D5 Song Approval Queue | | | | ✓ | |
| D6 Extraction Status | | | ✓ | ✓ | |
| E1 Home / Landing | ✓ | ✓ | ✓ | ✓ | |
| E2 Browse / Discover | | ✓ | ✓ | ✓ | |
| E3 Search Results | | ✓ | ✓ | ✓ | |
| E4 Genre Browsing | | ✓ | ✓ | ✓ | |
| E5 Report Content | | ✓ | ✓ | ✓ | |
| F1 Now Playing | | ✓ | ✓ | ✓ | |
| F2 Play Queue | | ✓ | ✓ | ✓ | |
| G1 Browse Playlists | | ✓ | ✓ | ✓ | |
| G2 Playlist Details | | ✓ | ✓ | ✓ | |
| G3 Create Playlist | | ✓ | ✓ | ✓ | |
| G4 Edit Playlist | | ✓ (own) | ✓ (own) | ✓ **(any)** | |
| G5 Liked Songs | | ✓ | ✓ | ✓ | |
| G6 Saved Playlists | | ✓ | ✓ | ✓ | |
| G7 Mood Playlist | | ✓ | ✓ | ✓ | |
| G8 Album Details | | ✓ | ✓ | ✓ | |
| G9 Create Album | | | ✓ | ✓ | |
| G10 Edit Album | | | ✓ (own) | ✓ **(any)** | |
| H1 Activity Feed | | ✓ | ✓ | ✓ | |
| H2 Followers / Following | ✓ | ✓ | ✓ | ✓ | |
| H3 Notification Inbox | | ✓ | ✓ | ✓ | |
| H4 Other User Profile | | ✓ | ✓ | ✓ | |
| I1 Drop Teaser Page | ✓ | ✓ | ✓ | ✓ | |
| I2 Drop Management Dashboard | | | ✓ | ✓ | |
| I3 Cancel Drop | | | ✓ (own) | ✓ (any) | |
| I4 Reschedule Drop | | | ✓ (own) | ✓ (any) | |
| J1 Pricing & Purchase | | ✓ | ✓ | | |
| J2 VNPay Payment | | ✓ | ✓ | | |
| J3 MoMo Payment | | ✓ | ✓ | | |
| K1 Download Song | | ✓ | ✓ | ✓ | ✓ (USER/ARTIST) |
| K2 Downloaded Songs Library | | ✓ | ✓ | ✓ | ✓ (USER/ARTIST) |
| L1 Admin Dashboard | | | | ✓ | |
| L2 Genre Management | | | | ✓ | |
| L3 User Management | | | | ✓ | |
| L4 Content Moderation | | | | ✓ | |
| L5 Audit Log | | | | ✓ | |
| L6 Payment Records | | | | ✓ | |

> **Notes:**
> - ADMIN bypasses all ownership guards — can edit/delete any user's songs, albums, and playlists (BL-50).
> - "Requires PREMIUM" applies to USER and ARTIST only. ADMIN has unrestricted access to K1/K2 and B5 regardless of PREMIUM status.
> - Screens marked "Authenticated" require `is_email_verified=true`. Unverified users are redirected to A3.
> - `(own)` = ownership guard enforced: resource `creatorId` must match `currentUserId`. ADMIN is exempt.
