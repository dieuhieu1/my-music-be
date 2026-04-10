# API Interfaces — Complete Reference
**Music Streaming App · NestJS REST API · v1**

---

## 0. Global Conventions

### Base URL
```
Dev  →  http://localhost:3001/api/v1
Prod →  https://api.mymusic.app/v1   (nginx: /api → NestJS:3001)
```

### Versioning
All routes are prefixed `/v1/`. Future breaking changes bump to `/v2/`.

### Authentication
```http
# Browser (axios withCredentials:true) — cookies are sent automatically
Cookie: access_token=<jwt>; refresh_token=<jwt>

# Server-side (Next.js SSR — read cookie, forward as header)
Authorization: Bearer <access_token>
```
| Cookie | TTL | Notes |
|---|---|---|
| `access_token` | 15 min | httpOnly, SameSite=Lax, Secure (prod) |
| `refresh_token` | 30 days | httpOnly, SameSite=Lax, Secure (prod) |

On 401: axios interceptor → `POST /auth/refresh` → retry original request (CSR only).

### Standard Response Envelope
```jsonc
// ✅ Success
{ "success": true, "data": { ... } }

// ❌ Error
{ "success": false, "data": null, "error": { "code": "ERROR_CODE", "message": "Human readable." } }
```

### Pagination
All list endpoints accept `?page=1&size=20` and return:
```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 142,
    "page": 1,
    "size": 20,
    "totalPages": 8
  }
}
```

### Rate Limits
| Scope | Limit | Window | Header on 429 |
|---|---|---|---|
| Auth routes | 10 req | 1 min | `Retry-After: <seconds>` |
| Upload route | 5 req | 1 min | `Retry-After: <seconds>` |
| All other | 200 req | 1 min | `Retry-After: <seconds>` |

---

## 1. Shared Types

Reused throughout this document.

```typescript
// --- Enums ---

SongStatus = "PENDING" | "APPROVED" | "SCHEDULED" | "LIVE"
           | "REJECTED" | "REUPLOAD_REQUIRED" | "TAKEN_DOWN"

Role       = "USER" | "ARTIST" | "ADMIN"

NotificationType = "SONG_APPROVED" | "SONG_REJECTED" | "SONG_REUPLOAD_REQUIRED"
                 | "SONG_RESTORED" | "PREMIUM_ACTIVATED" | "PREMIUM_REVOKED"
                 | "UPCOMING_DROP" | "NEW_RELEASE" | "DROP_CANCELLED" | "DROP_RESCHEDULED"

PremiumType = "1month" | "3month" | "6month" | "12month"
// 1month=30000 VND | 3month=79000 VND | 6month=169000 VND | 12month=349000 VND

ReportType     = "EXPLICIT" | "COPYRIGHT" | "INAPPROPRIATE"
ReportTarget   = "SONG" | "PLAYLIST" | "ARTIST"

PaymentMethod  = "VNPAY" | "MOMO" | "ADMIN_GRANTED"
PaymentStatus  = "SUCCESS" | "FAILED" | "PENDING" | "ADMIN_GRANTED"

// --- Reusable Object Shapes ---

UserSummary    = { id: string, name: string, avatarUrl: string | null }
ArtistSummary  = { id: string, stageName: string, avatarUrl: string | null }
GenreSummary   = { id: string, name: string }
AlbumSummary   = { id: string, name: string, coverArtUrl: string | null }

SongSummary = {
  id           : string
  title        : string
  coverArtUrl  : string | null
  duration     : number           // seconds
  status       : SongStatus
  bpm          : number | null
  camelotKey   : string | null    // e.g. "8A", "5B"
  totalPlays   : number           // all-time play count (songs.total_plays)
  likeCount    : number
  dropAt       : string | null    // ISO 8601, SCHEDULED songs only
  artist       : ArtistSummary
  album        : AlbumSummary | null
  genres       : GenreSummary[]
  isTakenDown  : boolean          // FE: grey out + unplayable if true
}

PlaylistSummary = {
  id            : string
  name          : string
  coverArtUrl   : string | null
  isPublic      : boolean
  totalTracks   : number
  totalHours    : number          // decimal, e.g. 1.5
  followerCount : number
  listenerCount : number
  creator       : UserSummary
}
```

---

## 2. Authentication

### `POST /auth/register`
> Register a new USER account. Sends a 6-digit email verification code.

**Access:** Public

**Request Body**
```jsonc
{
  "name": "Nguyen Van A",          // string, required, 2–100 chars
  "email": "vana@example.com",     // string, required, valid email
  "password": "Secure@123",        // string, required, min 8 chars
  "confirmPassword": "Secure@123"  // string, required, must match password
}
```

**Response `201`**
```jsonc
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-0000-0000-0000-000000000001",
      "name": "Nguyen Van A",
      "email": "vana@example.com",
      "roles": ["USER"],
      "isPremium": false,
      "isEmailVerified": false,
      "onboardingCompleted": false,  // always false on fresh registration
      "createdAt": "2026-04-05T10:00:00.000Z"
    }
  }
}
// Set-Cookie: access_token=<jwt>; HttpOnly; SameSite=Lax; Secure; Path=/
// Set-Cookie: refresh_token=<jwt>; HttpOnly; SameSite=Lax; Secure; Path=/
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `EMAIL_ALREADY_TAKEN` | 409 | Email already registered |
| `PASSWORDS_DO_NOT_MATCH` | 400 | confirmPassword ≠ password |
| `VALIDATION_ERROR` | 400 | Missing / invalid fields |

---

### `POST /auth/register/artist`
> Register as ARTIST. Creates User + ArtistProfile in a single DB transaction.

**Access:** Public

**Request Body**
```jsonc
{
  "name": "Nguyen Van A",
  "email": "artist@example.com",
  "password": "Secure@123",
  "confirmPassword": "Secure@123",
  "stageName": "Lo-fi Dreams",       // string, required, 2–100 chars
  "bio": "Producer from Hanoi.",     // string, required, max 500 chars
  "genreIds": ["uuid-genre-1"],      // string[], required, min 1 item
  "socialLinks": [                   // optional
    { "platform": "instagram", "url": "https://instagram.com/lofi" }
  ]
}
```

**Response `201`** — same shape as `/auth/register` with `roles: ["ARTIST"]`

**Errors**
| Code | HTTP | When |
|---|---|---|
| `EMAIL_ALREADY_TAKEN` | 409 | — |
| `STAGE_NAME_TAKEN` | 409 | stageName already in use |
| `GENRE_NOT_FOUND` | 404 | One of genreIds is invalid |
| `VALIDATION_ERROR` | 400 | — |

---

### `POST /auth/login`
> Authenticate user and start a device session. Sets httpOnly cookies.

**Access:** Public

**Request Body**
```jsonc
{
  "email": "vana@example.com",  // string, required
  "password": "Secure@123"      // string, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-...",
      "name": "Nguyen Van A",
      "email": "vana@example.com",
      "roles": ["USER"],
      "isPremium": false,
      "premiumExpiryDate": null,
      "isEmailVerified": true,
      "avatarUrl": null,
      "onboardingCompleted": true   // false → client redirects to /onboarding
    },
    "session": {
      "id": "sess_xyz",
      "deviceName": "Chrome / Windows",
      "ip": "203.113.xx.xx",
      "expiresAt": "2026-05-05T10:00:00.000Z"
    }
  }
}
// Set-Cookie: access_token=<jwt>; HttpOnly; SameSite=Lax; Secure; Path=/
// Set-Cookie: refresh_token=<jwt>; HttpOnly; SameSite=Lax; Secure; Path=/
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_LOCKED` | 423 | 5 consecutive failures → locked 15 min |
| `ACCOUNT_NOT_FOUND` | 404 | Email not registered |

---

### `POST /auth/logout`
> Invalidate tokens, revoke session, and hard-delete the user's play queue.

**Access:** Authenticated

**Request Body** — none

**Response `200`**
```json
{ "success": true, "data": { "message": "Logged out successfully." } }
// Set-Cookie: access_token=; Max-Age=0
// Set-Cookie: refresh_token=; Max-Age=0
```

---

### `POST /auth/refresh`
> Rotate both access and refresh tokens. Old refresh token is invalidated immediately.

**Access:** Cookie only (no Authorization header needed)

**Request Body** — none (reads `refresh_token` cookie automatically)

**Response `200`**
```json
{ "success": true, "data": { "message": "Tokens refreshed." } }
// Set-Cookie: access_token=<new_jwt>; HttpOnly; SameSite=Lax; Secure; Path=/
// Set-Cookie: refresh_token=<new_jwt>; HttpOnly; SameSite=Lax; Secure; Path=/
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `REFRESH_TOKEN_INVALID` | 401 | Token expired, not found, or already rotated |

---

### `POST /auth/verify-email`
> Submit 6-digit code to verify email. Unlocks full platform access.

**Access:** Authenticated (unverified allowed — `@SkipEmailVerified`)

**Request Body**
```jsonc
{
  "code": "482019"  // string, required, 6 digits
}
```

**Response `200`**
```json
{ "success": true, "data": { "isEmailVerified": true } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_VERIFICATION_CODE` | 400 | Wrong code |
| `VERIFICATION_CODE_EXPIRED` | 400 | Code older than 10 min |

---

### `POST /auth/verify-email/resend`
> Resend the 6-digit verification email.

**Access:** Authenticated (unverified allowed)

**Request Body** — none

**Response `200`**
```json
{ "success": true, "data": { "message": "Verification email sent." } }
```

---

### `POST /auth/forgot-password`
> Trigger async email with 6-digit reset code (10-min expiry). Always returns 200 to prevent email enumeration.

**Access:** Public

**Request Body**
```jsonc
{
  "email": "vana@example.com"  // string, required
}
```

**Response `200`**
```json
{ "success": true, "data": { "message": "If that email exists, a reset code was sent." } }
```

---

### `POST /auth/verify-reset-code`
> Exchange 6-digit reset code for a short-lived reset JWT (15-min TTL).

**Access:** Public

**Request Body**
```jsonc
{
  "email": "vana@example.com",
  "code": "719304"             // string, required, 6 digits
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "resetToken": "eyJhbGc..."  // JWT valid for 15 min, required by next step
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_RESET_CODE` | 400 | Wrong code |
| `RESET_CODE_EXPIRED` | 400 | Code older than 10 min |

---

### `POST /auth/reset-password`
> Set new password using the reset JWT. Invalidates all verification codes.

**Access:** Public (resetToken in body)

**Request Body**
```jsonc
{
  "resetToken": "eyJhbGc...",       // string, required, from previous step
  "password": "NewSecure@456",      // string, required, min 8 chars
  "confirmPassword": "NewSecure@456"
}
```

**Response `200`**
```json
{ "success": true, "data": { "message": "Password updated. Please log in." } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `RESET_TOKEN_INVALID` | 400 | Expired or malformed token |
| `PASSWORDS_DO_NOT_MATCH` | 400 | — |

---

### `GET /auth/sessions`
> List all active device sessions for the current user.

**Access:** Authenticated

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "sess_abc",
        "deviceName": "Chrome / Windows",
        "ip": "203.113.xx.xx",
        "lastSeen": "2026-04-05T09:00:00.000Z",
        "loginDate": "2026-04-01T08:30:00.000Z",
        "isCurrent": true   // the session used to make this request
      }
    ]
  }
}
```

---

### `DELETE /auth/sessions/:sessionId`
> Revoke a specific session. Use `current` to revoke the active one (same as logout).

**Access:** Authenticated

**Path Params:** `sessionId` — session id or `"current"`

**Response `200`**
```json
{ "success": true, "data": { "message": "Session revoked." } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | sessionId not owned by caller |

---

## 3. Users

### `GET /users/me`
> Get the current authenticated user's full profile.

**Access:** Authenticated

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Nguyen Van A",
    "email": "vana@example.com",
    "avatarUrl": "https://images.mymusic.app/avatar/uuid.jpg",
    "roles": ["USER"],
    "isPremium": true,
    "premiumExpiryDate": "2026-05-05T00:00:00.000Z",
    "isEmailVerified": true,
    "followerCount": 12,
    "followingCount": 34,
    "downloadQuota": {          // null if not PREMIUM and not ADMIN
      "used": 42,
      "limit": 100              // 100 USER | 200 ARTIST | null ADMIN (unlimited)
    },
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### `PATCH /users/me`
> Update name and/or avatar URL (URL paste path — BL-66).

**Access:** Authenticated

**Request Body** — all fields optional; at least one required
```jsonc
{
  "name": "Nguyen Van B",                           // string, 2–100 chars
  "avatarUrl": "https://images.example.com/me.jpg"  // string, https:// only
}
```

**Avatar URL validation (two steps, only when `avatarUrl` provided):**
1. Regex: must match `^https://` — rejects `http://` and non-URLs
2. HEAD check: server calls `HEAD {avatarUrl}` with 3s timeout; `Content-Type` must start with `image/`

**Response `200`** — returns updated `UserResponse`

**Errors**
| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | name is empty |
| `INVALID_AVATAR_URL` | 422 | HEAD check timed out, returned non-2xx, or `Content-Type` is not `image/*` |

---

### `POST /users/me/avatar`
> Upload a profile picture file (file upload path — BL-88). Overwrites any existing avatar.

**Access:** Authenticated

**Request Body** — `multipart/form-data`
| Field | Type | Rules |
|---|---|---|
| `file` | File | Magic-byte MIME ∈ `image/jpeg`, `image/png`, `image/webp`. `Content-Length` ≤ 5 MB (rejected before body is read). |

**Processing:** center-crop → resize to 400×400 px (`sharp`) → stored at `images/avatar/users/{userId}.{ext}` in MinIO (overwrites previous).

**Response `200`** — returns updated `UserResponse` with new `avatarUrl` set to the MinIO public path.

**Errors**
| Code | HTTP | When |
|---|---|---|
| `FILE_TOO_LARGE` | 413 | `Content-Length` > 5 MB |
| `INVALID_FILE_TYPE` | 422 | Magic bytes not jpeg / png / webp |

---

### `POST /users/me/onboarding`
> Submit or skip genre preferences after registration. Sets `onboardingCompleted=true`. Idempotent — calling again overwrites previous selection.

**Access:** Authenticated

**Request Body**
```jsonc
{
  "genreIds": ["uuid-genre-1", "uuid-genre-2"],  // 1–10 confirmed genre IDs; ignored if skipped=true
  "skipped": false                                // true → skip, genreIds ignored
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "onboardingCompleted": true,
    "preferredGenres": [
      { "id": "uuid-genre-1", "name": "Lo-fi" },
      { "id": "uuid-genre-2", "name": "Jazz" }
    ]
    // ... rest of UserResponse
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `GENRE_NOT_FOUND` | 404 | One or more genreIds not in confirmed genre list |
| `VALIDATION_ERROR` | 400 | `skipped=false` and `genreIds` is empty or has >10 items |

---

### `PATCH /users/me/genres`
> Update genre preferences from profile settings. Same write as onboarding but accessible any time after.

**Access:** Authenticated

**Request Body**
```jsonc
{
  "genreIds": ["uuid-genre-1", "uuid-genre-3"]  // 1–10 confirmed genre IDs, replaces existing
}
```

**Response `200`** — same shape as `POST /users/me/onboarding`

**Errors**
| Code | HTTP | When |
|---|---|---|
| `GENRE_NOT_FOUND` | 404 | One or more genreIds not in confirmed genre list |
| `VALIDATION_ERROR` | 400 | genreIds empty or has >10 items |

---

### `PATCH /users/me/password`
> Change password. Requires current password verification.

**Access:** Authenticated

**Request Body**
```jsonc
{
  "currentPassword": "Secure@123",
  "newPassword": "NewSecure@456",       // min 8 chars
  "confirmPassword": "NewSecure@456"
}
```

**Response `200`**
```json
{ "success": true, "data": { "message": "Password changed." } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | currentPassword is wrong |
| `PASSWORDS_DO_NOT_MATCH` | 400 | — |

---

### `GET /users/:userId`
> Public profile of another user.

**Access:** Authenticated

**Path Params:** `userId`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Tran Thi B",
    "avatarUrl": null,
    "followerCount": 7,
    "followingCount": 22,
    "publicPlaylists": [ /* PlaylistSummary[] */ ],
    "isFollowedByMe": false     // whether current user follows this user
  }
}
```

---

### `GET /users/:userId/followers`
> Paginated list of users who follow `:userId`.

**Access:** Authenticated

**Query Params:** `page`, `limit`

**Response `200`** — paginated `UserSummary[]`

---

### `GET /users/:userId/following`
> Paginated list of users/artists that `:userId` follows.

**Access:** Authenticated

**Query Params:** `page`, `limit`

**Response `200`** — paginated `UserSummary[]`

---

### `POST /users/:userId/follow`
> Follow a user or artist.

**Access:** Authenticated (email verified)

**Path Params:** `userId`

**Request Body** — none

**Response `200`**
```json
{ "success": true, "data": { "following": true, "followerCount": 8 } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SELF_FOLLOW_FORBIDDEN` | 403 | userId === current user's id |
| `ALREADY_FOLLOWING` | 409 | Already following |

---

### `DELETE /users/:userId/follow`
> Unfollow a user or artist.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "following": false, "followerCount": 7 } }
```

---

## 4. Artist Profiles

### `GET /artists/:artistId`
> Public artist profile. Increments `listenerCount` on every call.

**Access:** Public

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "stageName": "Lo-fi Dreams",
    "bio": "Producer from Hanoi.",
    "avatarUrl": "https://images.mymusic.app/avatar/uuid.jpg",
    "followerCount": 1204,
    "listenerCount": 58300,
    "socialLinks": [
      { "platform": "instagram", "url": "https://instagram.com/lofi" }
    ],
    "genres": [ /* GenreSummary[] */ ],
    "songs": [ /* SongSummary[] — LIVE only */ ],
    "isFollowedByMe": false    // null if Public (unauthenticated)
  }
}
```

---

### `GET /artists/me/profile`
> Own artist dashboard view (C2). Includes pending genre suggestions.

**Access:** ARTIST / ADMIN

**Response `200`** — same as `GET /artists/:artistId` plus:
```jsonc
{
  "success": true,
  "data": {
    // ...all public fields...
    "pendingGenreSuggestions": [
      {
        "id": "uuid",
        "name": "Bedroom Pop",
        "status": "PENDING",   // "PENDING" | "APPROVED" | "REJECTED"
        "submittedAt": "2026-04-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### `PATCH /artists/me/profile`
> Edit own artist profile. Includes URL paste path for avatar (BL-67).

**Access:** ARTIST only

**Request Body** — all fields optional
```jsonc
{
  "stageName": "Lo-fi Dreams 2",    // string, 2–100 chars, non-empty if provided
  "bio": "Updated bio.",            // string, max 500 chars
  "avatarUrl": "https://...",       // string, https:// only — same two-step validation as PATCH /users/me
  "socialLinks": [
    { "platform": "youtube", "url": "https://youtube.com/@lofi" }
  ]
}
```

**Avatar URL validation:** same two-step as `PATCH /users/me` — regex `^https://`, then HEAD check (3s timeout, `Content-Type: image/*`).

**Response `200`** — returns updated `ArtistProfileResponse`

**Errors**
| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | stageName is empty |
| `INVALID_AVATAR_URL` | 422 | HEAD check failed or non-image Content-Type |

---

### `POST /artists/me/avatar`
> Upload a profile picture file for artist (file upload path — BL-89). Overwrites any existing avatar.

**Access:** ARTIST only

**Request Body** — `multipart/form-data`
| Field | Type | Rules |
|---|---|---|
| `file` | File | Magic-byte MIME ∈ `image/jpeg`, `image/png`, `image/webp`. `Content-Length` ≤ 5 MB. |

**Processing:** center-crop → 400×400 px (`sharp`) → stored at `images/avatar/artists/{artistId}.{ext}` in MinIO (overwrites previous).

**Response `200`** — returns updated `ArtistProfileResponse`

**Errors**
| Code | HTTP | When |
|---|---|---|
| `FILE_TOO_LARGE` | 413 | `Content-Length` > 5 MB |
| `INVALID_FILE_TYPE` | 422 | Magic bytes not jpeg / png / webp |

---

### `GET /artists/me/analytics`
> Song analytics for own profile (D3).

**Access:** ARTIST

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "followerCount": 1204,
    "totalAllTimePlays": 89400,
    "last30DayPlays": 12300,
    "topSongsLast30Days": [
      { "songId": "uuid", "title": "Midnight Rain", "plays": 4200 }
    ],
    "perSong": [
      {
        "songId": "uuid",
        "title": "Midnight Rain",
        "allTimePlays": 45200,
        "last30DayPlays": 4200,
        "likeCount": 980
      }
    ]
  }
}
```

---

### `GET /admin/artists/:artistId/analytics`
> Same analytics for any artist. Admin only.

**Access:** ADMIN

**Path Params:** `artistId`

**Response `200`** — same shape as `GET /artists/me/analytics`

---

## 5. Songs

### `POST /songs/upload`
> Upload an audio file. Returns a jobId for extraction polling.

**Access:** ARTIST (email verified) / ADMIN

**Request** — `Content-Type: multipart/form-data`
```
Field         Type        Required  Notes
───────────────────────────────────────────────────────────────
file          File        yes       mp3/flac, magic-byte validated, max 200 MB, max 20 min
title         string      yes       2–200 chars
coverArtUrl   string      no        valid URL (upload image separately first)
albumId       string      no        UUID of an existing album owned by this artist
genreIds      string[]    yes       min 1, array of genre UUIDs
dropAt        string      no        ISO 8601, min +1h from now, max +90 days from now
suggestedGenres string[]  no        new genre names to suggest (for admin approval)
```

**Response `201`**
```jsonc
{
  "success": true,
  "data": {
    "songId": "song_abc123",
    "status": "PENDING",
    "jobId": "job_def456",
    "message": "Upload successful. Audio extraction queued."
  }
}
```

> **FE:** Poll `GET /songs/upload/:jobId/status` every 3 s to track BPM/Key extraction.

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_MIME_TYPE` | 422 | Magic-byte check failed |
| `DURATION_EXCEEDED` | 422 | Audio > 20 min |
| `FILE_TOO_LARGE` | 422 | File > 200 MB |
| `UPLOAD_SLOT_FULL` | 429 | PENDING + APPROVED + SCHEDULED + LIVE count at limit |
| `ARTIST_ONLY` | 403 | Caller does not have ARTIST role |
| `GENRE_NOT_FOUND` | 404 | One of genreIds is invalid |

---

### `GET /songs/upload/:jobId/status`
> Poll BPM/Camelot Key extraction progress.

**Access:** ARTIST / ADMIN

**Path Params:** `jobId`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    // status values and FE behavior:
    // "pending"    → show spinner, keep polling
    // "processing" → show spinner, keep polling
    // "completed"  → auto-fill BPM + Key, unlock fields for artist override
    // "failed"     → show "Auto-extraction failed", unlock fields for manual entry
    "status": "completed",
    "bpm": 120,                // number | null — present only on "completed"
    "camelotKey": "8A",        // string | null — present only on "completed"
    "songId": "song_abc123"
  }
}
```

---

### `GET /songs`
> Browse LIVE songs. Supports filtering and sorting.

**Access:** Authenticated (email verified)

**Query Params**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | — |
| `limit` | number | 20 | Max 50 |
| `genreId` | string | — | Filter by genre UUID |
| `mood` | string | — | `happy\|sad\|focus\|chill\|workout` |
| `sort` | string | `totalPlays` | `totalPlays\|createdAt\|likeCount` |
| `order` | string | `DESC` | `ASC\|DESC` |

**Response `200`** — paginated `SongSummary[]`

---

### `GET /songs/search`
> Search across songs, albums, artists, and playlists.

**Access:** Authenticated (email verified)

**Query Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Search keyword |
| `type` | string | no | `song\|album\|artist\|playlist` (default: all four) |
| `filters` | string[] | no | e.g. `["totalPlays>1000","name~Rock"]` — operators: `~` LIKE, `>` gt, `<` lt |
| `page` | number | no | — |
| `limit` | number | no | Max 50 |

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "songs": { "items": [ /* SongSummary[] */ ], "total": 12 },
    "albums": { "items": [ /* AlbumSummary[] */ ], "total": 3 },
    "artists": { "items": [ /* ArtistSummary[] */ ], "total": 5 },
    "playlists": { "items": [ /* PlaylistSummary[] */ ], "total": 2 }
  }
}
```

---

### `GET /songs/:songId`
> Song detail. Read-only — does **not** increment `total_plays`. Use `POST /songs/:id/play` for play counting.

**Access:** Authenticated (email verified)

**Path Params:** `songId`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Midnight Rain",
    "coverArtUrl": "https://images.mymusic.app/song/uuid.jpg",
    "duration": 213,
    "status": "LIVE",
    "bpm": 85,
    "camelotKey": "9A",
    "totalPlays": 45201,
    "likeCount": 980,
    "dropAt": null,
    "isLikedByMe": true,
    "artist": { "id": "...", "stageName": "Lo-fi Dreams", "avatarUrl": "..." },
    "album": { "id": "...", "name": "Chill Collection" },
    "genres": [{ "id": "...", "name": "Lo-fi" }],
    "isTakenDown": false,
    // Only for ARTIST (owner) or ADMIN:
    "reuploadReason": null,     // string — set when status = REUPLOAD_REQUIRED
    "rejectionReason": null     // string — set when status = REJECTED
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_NOT_FOUND` | 404 | Song does not exist or is not accessible to caller |

---

### `POST /songs/:songId/play`
> Report a completed play event. The single source of truth for `total_plays` and `playback_history` writes (BL-09, BL-29). Client fires this once per track on transition away (skip, natural end, or app close).

**Access:** Authenticated (email verified)

**Request Body**
```jsonc
{
  "secondsPlayed": 47,   // number, required — seconds the user listened before leaving
  "skipped": false       // boolean, required — true if user actively skipped
}
```

**Server transaction (atomic):**
- If `secondsPlayed >= 30`: `UPDATE songs SET total_plays = total_plays + 1` + `INSERT playback_history (skipped=false)`
- Else: `INSERT playback_history (skipped=true)` only — `total_plays` unchanged
- FIFO eviction: if user already has 500 rows in `playback_history`, delete oldest before insert

**Response `204`** — No Content

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_NOT_FOUND` | 404 | Song does not exist |
| `VALIDATION_ERROR` | 400 | Missing or invalid body fields |

---

### `PATCH /songs/:songId`
> Edit song metadata. Audio file cannot be replaced here.

**Access:** ARTIST (own, APPROVED/LIVE only) / ADMIN (any)

**Request Body** — all optional; at least one required
```jsonc
{
  "title": "Midnight Rain (Remastered)",   // string, 2–200 chars
  "coverArtUrl": "https://...",            // string, valid URL
  "genreIds": ["uuid-genre-1", "uuid-2"]  // string[], replaces existing genres
}
```

**Response `200`** — returns updated `SongSummary`

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_NOT_FOUND` | 404 | — |
| `FORBIDDEN` | 403 | ARTIST trying to edit another artist's song |
| `INVALID_STATUS_FOR_EDIT` | 422 | Song is not APPROVED or LIVE |

---

### `PATCH /songs/:songId/resubmit`
> Resubmit a song flagged as REUPLOAD_REQUIRED. Sets status back to PENDING.

**Access:** ARTIST (own, `REUPLOAD_REQUIRED` only)

**Request** — `Content-Type: multipart/form-data`
```
Field        Type    Required  Notes
──────────────────────────────────────────────
file         File    no        New audio (re-triggers extraction if provided)
title        string  no
coverArtUrl  string  no
genreIds     string[]  no
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "songId": "uuid",
    "status": "PENDING",
    "jobId": "job_new456"   // present only when a new audio file was uploaded
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_STATUS_FOR_RESUBMIT` | 422 | Status is not REUPLOAD_REQUIRED |

---

### `DELETE /songs/:songId`
> Permanently delete a song. Cascades: removed from all playlists, albums, and queue.

**Access:** ARTIST (own, APPROVED/LIVE only) / ADMIN

**Response `200`**
```json
{ "success": true, "data": { "message": "Song deleted." } }
```

---

### `GET /songs/:songId/stream`
> Get a presigned MinIO stream URL. NestJS never proxies audio bytes.

**Access:** Authenticated (email verified)

**Path Params:** `songId`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "streamUrl": "https://minio.internal/audio/song_abc-hq.mp3?X-Amz-Expires=3600&...",
    "quality": "HQ_320",      // "HQ_320" (PREMIUM) | "STD_128" (standard)
    "expiresAt": "2026-04-05T11:00:00.000Z"
  }
}
// FE: store expiresAt → set setTimeout to re-fetch 5 min before expiry → call howler.load(newUrl)
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_SCHEDULED` | 423 | Drop hasn't fired yet — no exceptions, even ADMIN |
| `SONG_NOT_LIVE` | 403 | Song is PENDING / REJECTED / TAKEN_DOWN |
| `SONG_NOT_FOUND` | 404 | — |

---

### `GET /songs/:songId/next`
> Get the next recommended song based on the current song's audio features (BPM, Camelot Key, Energy) and the current user's taste profile. Uses librosa-extracted data stored at upload time — no external API call.

**Access:** Authenticated (email verified)

**Path Params:** `songId` — the song currently playing

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "song": {
      // SongSummary shape (see Section 1 — Shared Types)
      "id": "song_xyz",
      "title": "Deep Flow",
      "coverArtUrl": "https://images.mymusic.app/song/xyz.jpg",
      "duration": 198,
      "status": "LIVE",
      "bpm": 83,
      "camelotKey": "9A",
      "energy": 60,
      "totalPlays": 12400,
      "likeCount": 340,
      "artist": { "id": "...", "stageName": "Lo-fi Dreams", "avatarUrl": "..." },
      "album": null,
      "genres": [{ "id": "...", "name": "Lo-fi" }],
      "isTakenDown": false
    },
    "score": 0.08,           // 0–1, lower = more similar (dev/debug only, omit in prod)
    "matchedOn": {           // which features drove the match (dev/debug only)
      "bpm": true,           // BPM within compatible range
      "camelotKey": true,    // harmonically adjacent on Camelot Wheel
      "energy": true,        // energy within compatible range
      "genre": true          // matches user's top genre preference
    }
  }
}
```

> **FE behaviour:**
> - Call this when the current song ends (auto-play) OR when user skips.
> - On receive: add returned song to queue, begin playback, call `POST /playback/state`.
> - Also call `POST /songs/:songId/played` immediately when a new song starts so the deduplication system tracks it.

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_NOT_FOUND` | 404 | currentSongId does not exist |
| `NO_AUDIO_FEATURES` | 422 | Current song has no librosa data (extraction failed) — FE should fall back to genre browse |
| `NO_CANDIDATES` | 404 | Catalog has no LIVE songs (edge case) |

---

### `POST /songs/:songId/played`
> Record that the user started playing this song. Updates session deduplication state in Redis so the same song is not recommended again this session.

**Access:** Authenticated (email verified)

**Path Params:** `songId` — the song that just started playing

**Request Body** — none

**Response `200`**
```json
{ "success": true, "data": { "recorded": true } }
```

> **FE:** Call this immediately when a song starts playing (including manual queue plays, not only auto-play). This is separate from `POST /playback/state` which persists position — this one only updates the deduplication registry.

---

### `GET /songs/:songId/teaser`
> Public teaser for a SCHEDULED drop. No audio — any stream attempt returns 423.

**Access:** Public

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Neon Lights",
    "coverArtUrl": "https://...",
    "dropAt": "2026-04-20T20:00:00.000Z",
    "artist": { "id": "...", "stageName": "Lo-fi Dreams" },
    "isNotifySubscribed": false   // null if unauthenticated
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_NOT_FOUND` | 404 | songId not found, or status is PENDING / REJECTED |

---

### `POST /songs/:songId/like`
> Like a song. Auto-creates Liked Songs playlist on first ever like.

**Access:** Authenticated (email verified)

**Response `200`**
```json
{ "success": true, "data": { "liked": true, "likeCount": 981 } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `ALREADY_LIKED` | 409 | — |
| `SONG_NOT_LIVE` | 422 | Song must be LIVE to like |

---

### `DELETE /songs/:songId/like`
> Unlike a song.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "liked": false, "likeCount": 980 } }
```

---

### `POST /songs/:songId/notify`
> Subscribe to drop notification for a SCHEDULED song.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "subscribed": true } }
```

---

### `DELETE /songs/:songId/notify`
> Unsubscribe from drop notification.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "subscribed": false } }
```

---

### `DELETE /songs/:songId/drop`
> Cancel a scheduled drop. Sets `status=APPROVED`, `dropAt=null`. Sends `DROP_CANCELLED` notifications.

**Access:** ARTIST (own) / ADMIN

**Response `200`**
```json
{ "success": true, "data": { "status": "APPROVED", "dropAt": null } }
```

---

### `PATCH /songs/:songId/drop`
> Reschedule a drop.
> - **1st reschedule:** new `dropAt` must be ≥1h from now AND ≥24h before original `dropAt`.
> - **2nd reschedule:** `status → PENDING` — admin must re-approve.

**Access:** ARTIST (own) / ADMIN

**Request Body**
```jsonc
{
  "dropAt": "2026-04-25T20:00:00.000Z"  // ISO 8601, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "songId": "uuid",
    "status": "SCHEDULED",      // or "PENDING" on 2nd reschedule
    "dropAt": "2026-04-25T20:00:00.000Z",
    "requiresReApproval": false  // true on 2nd reschedule
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_DROP_TIME` | 422 | dropAt is in the past or < 1h from now |
| `DROP_TOO_CLOSE_TO_ORIGINAL` | 422 | Not ≥24h before original dropAt (1st reschedule) |

---

## 6. Albums

### `POST /albums`
> Create a new album.

**Access:** ARTIST (email verified) / ADMIN

**Request Body**
```jsonc
{
  "name": "Chill Collection",    // string, required, 2–200 chars
  "description": "...",          // string, optional, max 500 chars
  "coverArtUrl": "https://..."   // string, optional, valid URL
}
```

**Response `201`**
```jsonc
{
  "success": true,
  "data": {
    "id": "album_uuid",
    "name": "Chill Collection",
    "description": "...",
    "coverArtUrl": null,
    "totalTracks": 0,
    "totalHours": 0,
    "artist": { /* ArtistSummary */ },
    "createdAt": "2026-04-05T10:00:00.000Z"
  }
}
```

---

### `GET /albums/:albumId`
> Album details with LIVE songs only. Increments `album.listener`.

**Access:** Authenticated

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Chill Collection",
    "description": "...",
    "coverArtUrl": "https://...",
    "totalTracks": 8,
    "totalHours": 0.5,
    "listener": 2300,
    "followerCount": 45,
    "isFollowedByMe": false,
    "artist": { /* ArtistSummary */ },
    "songs": [ /* SongSummary[] — LIVE only */ ],
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

---

### `PATCH /albums/:albumId`
> Edit album metadata.

**Access:** ARTIST (own) / ADMIN

**Request Body** — all optional
```jsonc
{
  "name": "Chill Vol. 1",
  "description": "Updated.",
  "coverArtUrl": "https://..."
}
```

**Response `200`** — returns updated album object

---

### `DELETE /albums/:albumId`
> Delete album. Cascades: deletes ALL songs in album (triggers cascade for each song).

**Access:** ARTIST (own) / ADMIN

**Response `200`**
```json
{ "success": true, "data": { "message": "Album and all its songs deleted." } }
```

---

### `POST /albums/:albumId/songs`
> Add an existing song to the album.

**Access:** ARTIST (own album + own song) / ADMIN

**Request Body**
```jsonc
{
  "songId": "song_uuid"   // string, required
}
```

**Response `200`** — returns updated album with new `totalTracks`

---

### `DELETE /albums/:albumId/songs/:songId`
> Remove a song from the album (does not delete the song).

**Access:** ARTIST (own) / ADMIN

**Response `200`** — returns updated album

---

## 7. Playlists

### `GET /playlists`
> Browse public playlists. Paginated.

**Access:** Authenticated

**Query Params:** `page`, `limit`, `sort` (`followerCount|listenerCount|createdAt`, default `listenerCount`)

**Response `200`** — paginated `PlaylistSummary[]`

---

### `POST /playlists`
> Create a new playlist.

**Access:** Authenticated (email verified)

**Request Body**
```jsonc
{
  "name": "Late Night Vibes",              // string, required, 2–100 chars
  "description": "Smooth lo-fi for 2 AM", // string, optional, max 300 chars
  "coverArtUrl": "https://..."             // string, optional
}
```

**Response `201`**
```jsonc
{
  "success": true,
  "data": {
    "id": "pl_uuid",
    "name": "Late Night Vibes",
    "description": "Smooth lo-fi for 2 AM",
    "coverArtUrl": null,
    "isPublic": true,
    "totalTracks": 0,
    "totalHours": 0,
    "followerCount": 0,
    "listenerCount": 0,
    "creator": { /* UserSummary */ },
    "createdAt": "2026-04-05T10:00:00.000Z"
  }
}
```

---

### `GET /playlists/:playlistId`
> Playlist details with tracks. Increments both `follower` and `listener` counters.

**Access:** Authenticated

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Late Night Vibes",
    "description": "...",
    "coverArtUrl": "https://...",
    "isPublic": true,
    "totalTracks": 15,
    "totalHours": 0.9,
    "followerCount": 102,
    "listenerCount": 530,
    "isSavedByMe": true,
    "isOwnedByMe": false,
    "creator": { /* UserSummary */ },
    "tracks": [
      {
        "itemId": "pli_uuid",          // playlist_song join id (for reorder/remove)
        "position": 1,
        "song": {
          // SongSummary shape
          // NOTE: if song.isTakenDown === true:
          //   - audioUrl is omitted
          //   - FE must render this track greyed-out and unplayable
          //   - Queue must auto-skip this track during full-playlist playback
          //   - Creator can still manually remove it
        }
      }
    ],
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

---

### `PATCH /playlists/:playlistId`
> Edit playlist metadata.

**Access:** Creator / ADMIN

**Request Body** — all optional
```jsonc
{
  "name": "Late Night Vol. 2",
  "description": "Updated.",
  "coverArtUrl": "https://..."
}
```

**Response `200`** — returns updated playlist object (without tracks)

---

### `DELETE /playlists/:playlistId`
> Delete playlist. Cascades: removes all `playlist_songs` entries.

**Access:** Creator / ADMIN

**Response `200`**
```json
{ "success": true, "data": { "message": "Playlist deleted." } }
```

---

### `POST /playlists/:playlistId/songs`
> Add a song to the playlist.

**Access:** Creator / ADMIN

**Request Body**
```jsonc
{
  "songId": "song_uuid",   // string, required
  "position": 3            // number, optional — inserts at position, default: append
}
```

**Response `200`**
```json
{ "success": true, "data": { "totalTracks": 16, "position": 3 } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `SONG_ALREADY_IN_PLAYLIST` | 409 | — |
| `SONG_NOT_LIVE` | 422 | Song must be LIVE to add |

---

### `DELETE /playlists/:playlistId/songs/:songId`
> Remove a song from the playlist (also works for TAKEN_DOWN tracks).

**Access:** Creator / ADMIN

**Response `200`**
```json
{ "success": true, "data": { "totalTracks": 15 } }
```

---

### `PATCH /playlists/:playlistId/songs/reorder`
> Move a track to a new position.

**Access:** Creator / ADMIN

**Request Body**
```jsonc
{
  "itemId": "pli_uuid",    // string, required — the playlist_song join id
  "newPosition": 2         // number, required, 1-based
}
```

**Response `200`** — returns full updated `tracks[]` array with new positions

---

### `POST /playlists/:playlistId/save`
> Save playlist to current user's library. Increments `playlist.listener` by 1.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "saved": true, "listenerCount": 531 } }
```

---

### `DELETE /playlists/:playlistId/save`
> Remove playlist from library.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "saved": false } }
```

---

### `GET /playlists/liked`
> The current user's Liked Songs playlist. Created on first like — not at registration.

**Access:** Authenticated (email verified)

**Response `200`** — same shape as `GET /playlists/:playlistId`

---

## 8. Playback & Queue

### `GET /playback/state`
> Get current playback state. Call on app load to resume where user left off.

**Access:** Authenticated (email verified)

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "currentSong": { /* SongSummary | null */ },
    "positionSeconds": 87.4,
    "isPlaying": false,
    "isShuffled": false,
    "isSmartOrder": false,
    "volume": 0.8
  }
}
```

---

### `POST /playback/state`
> Persist playback state (periodic client-side save, e.g. every 10 s).

**Access:** Authenticated (email verified)

**Request Body**
```jsonc
{
  "songId": "song_uuid",      // string | null
  "positionSeconds": 87.4,    // number, required
  "isPlaying": false,         // boolean
  "volume": 0.8               // number 0–1
}
```

**Response `200`**
```json
{ "success": true, "data": { "saved": true } }
```

---

### `GET /playback/queue`
> Get the current user's ordered play queue.

**Access:** Authenticated (email verified)

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "isShuffled": false,
    "isSmartOrder": false,
    "items": [
      {
        "itemId": "qi_uuid",
        "position": 1,
        "originalPosition": 1,   // position before smart order reorder
        "song": { /* SongSummary */ }
      }
    ]
  }
}
```

---

### `POST /playback/queue`
> Add a song to the queue. Auto-creates queue if none exists for this user.

**Access:** Authenticated (email verified)

**Request Body**
```jsonc
{
  "songId": "song_uuid",   // string, required
  "position": 2            // number, optional — insert at position, default: append
}
```

**Response `200`**
```json
{ "success": true, "data": { "queueLength": 5, "itemId": "qi_uuid" } }
```

---

### `DELETE /playback/queue/:itemId`
> Remove a specific item from the queue.

**Access:** Authenticated

**Path Params:** `itemId`

**Response `200`**
```json
{ "success": true, "data": { "queueLength": 4 } }
```

---

### `DELETE /playback/queue`
> Clear the entire queue. Note: queue is also hard-deleted on logout.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "message": "Queue cleared." } }
```

---

### `PATCH /playback/queue/reorder`
> Manually move a queue item to a new position.

**Access:** Authenticated

**Request Body**
```jsonc
{
  "itemId": "qi_uuid",    // string, required
  "newPosition": 1        // number, required, 1-based
}
```

**Response `200`** — returns updated `items[]` array

---

### `PATCH /playback/queue/smart-order`
> Toggle Smart Order. ON: backend reorders unplayed tracks by BPM + Camelot Key + Energy (greedy nearest-neighbor). OFF: restores original position order.

**Access:** Authenticated (email verified)

**Request Body**
```jsonc
{
  "enabled": true    // boolean, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "isSmartOrder": true,
    "items": [ /* reordered queue items[] */ ]
  }
}
```

---

### `PATCH /playback/queue/shuffle`
> Toggle queue shuffle.

**Access:** Authenticated

**Request Body**
```jsonc
{
  "enabled": true    // boolean, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "isShuffled": true,
    "items": [ /* reshuffled queue items[] */ ]
  }
}
```

---

## 9. Genres

### `GET /genres`
> Paginated list of active (non-soft-deleted) genres.

**Access:** Authenticated

**Query Params:** `page`, `limit`, `q` (name search)

**Response `200`** — paginated `GenreSummary[]`
```jsonc
{
  "success": true,
  "data": {
    "items": [
      { "id": "uuid", "name": "Lo-fi" },
      { "id": "uuid", "name": "K-Pop" }
    ],
    "total": 38, "page": 1, "size": 20, "totalPages": 2
  }
}
```

---

### `POST /genres`
> Create a new genre. Case-insensitive unique name.

**Access:** ADMIN

**Request Body**
```jsonc
{
  "name": "Bedroom Pop"    // string, required, 2–50 chars
}
```

**Response `201`**
```json
{ "success": true, "data": { "id": "uuid", "name": "Bedroom Pop" } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `GENRE_NAME_DUPLICATE` | 409 | Name already exists (case-insensitive) |

---

### `PATCH /genres/:genreId`
> Rename a genre.

**Access:** ADMIN

**Request Body**
```jsonc
{ "name": "Bedroom Pop (Updated)" }
```

**Response `200`** — returns updated genre

---

### `DELETE /genres/:genreId`
> Soft-delete a genre. Existing song/playlist associations are kept; genre hidden from browse.

**Access:** ADMIN

**Response `200`**
```json
{ "success": true, "data": { "message": "Genre hidden from browse." } }
```

---

## 10. Recommendations

### `GET /recommendations`
> Personalized song feed. Cache-aside: Redis `rec:{userId}` (24h TTL) → `recommendation_cache` table.

**Access:** Authenticated (email verified)

**Query Params:** `limit` (default 20, max 50)

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [ /* SongSummary[] */ ],
    "total": 50,
    "computedAt": "2026-04-05T00:00:00.000Z",
    "source": "CACHE"    // "CACHE" | "FRESH"
  }
}
```

---

### `GET /recommendations/mood`
> On-demand mood playlist. Generated live, not auto-saved.

**Access:** Authenticated (email verified)

**Query Params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `mood` | string | Conditional | `happy\|sad\|focus\|chill\|workout` — if omitted, inferred from `localHour` |
| `timezone` | string | Conditional | IANA tz string, e.g. `Asia/Ho_Chi_Minh`. Required when `mood` is omitted |
| `localHour` | number | Conditional | 0–23 integer. Alternative to `timezone` when `mood` is omitted |
| `limit` | number | No | 1–50, default 20 |

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "mood": "chill",
    "inferredMood": true,          // true = mood was inferred from time of day
    "localHourUsed": 23,           // the hour value used for inference
    "totalItems": 20,
    "items": [ /* SongSummary[] */ ]
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `MOOD_OR_TIME_REQUIRED` | 400 | mood is omitted AND neither timezone nor localHour provided |

---

## 11. Feed

### `GET /feed`
> Paginated activity feed from followed users and artists. Newest first.

**Access:** Authenticated (email verified)

**Query Params:** `page`, `limit`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "event_uuid",
        "type": "NEW_RELEASE",         // FeedEvent type
        // type values:
        // "NEW_PLAYLIST"   → actor created a playlist
        // "SONG_LIKED"     → actor liked a song
        // "ARTIST_FOLLOWED"→ actor followed an artist
        // "NEW_RELEASE"    → drop fired (song went LIVE)
        // "UPCOMING_DROP"  → 24h or 1h before a drop
        "actor": { /* UserSummary | ArtistSummary */ },
        "song": { /* SongSummary | null */ },
        "playlist": { /* PlaylistSummary | null */ },
        "createdAt": "2026-04-05T09:00:00.000Z"
      }
    ],
    "total": 48, "page": 1, "size": 20, "totalPages": 3
  }
}
```

---

## 12. Notifications

### `GET /notifications`
> Paginated notification inbox. Ordered by `created_at DESC`.

**Access:** Authenticated

**Query Params:** `page`, `limit`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "notif_uuid",
        "type": "SONG_APPROVED",
        // type values: see NotificationType in Section 1 Shared Types
        "isRead": false,
        "payload": {
          // varies by type, examples:
          // SONG_APPROVED:         { "songId": "...", "songTitle": "..." }
          // SONG_REJECTED:         { "songId": "...", "reason": "..." }
          // PREMIUM_ACTIVATED:     { "expiryDate": "...", "tier": "1month" }
          // UPCOMING_DROP:         { "songId": "...", "dropAt": "..." }
        },
        "createdAt": "2026-04-05T08:00:00.000Z"
      }
    ],
    "total": 10, "page": 1, "size": 20, "totalPages": 1
  }
}
```

---

### `GET /notifications/unread-count`
> Unread notification count for the bell badge. FE polls this periodically.

**Access:** Authenticated

**Response `200`**
```json
{ "success": true, "data": { "count": 3 } }
```

---

### `PATCH /notifications/:notificationId/read`
> Mark a notification as read. User can only mark their own.

**Access:** Authenticated

**Path Params:** `notificationId`

**Response `200`**
```json
{ "success": true, "data": { "isRead": true } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | notificationId not owned by caller |

---

## 13. Reports

### `POST /reports`
> Submit a content report. Creates a `ContentReport` for admin review.

**Access:** Authenticated (email verified)

**Request Body**
```jsonc
{
  "targetType": "SONG",         // "SONG" | "PLAYLIST" | "ARTIST" — required
  "targetId": "uuid",           // UUID of the target — required
  "type": "COPYRIGHT",          // "EXPLICIT" | "COPYRIGHT" | "INAPPROPRIATE" — required
  "notes": "Uses unlicensed samples from..."   // string, optional, max 500 chars
}
```

**Response `201`**
```json
{ "success": true, "data": { "reportId": "report_uuid", "status": "PENDING" } }
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `TARGET_NOT_FOUND` | 404 | targetId does not exist |
| `ALREADY_REPORTED` | 409 | Caller already reported this target |

---

## 14. Payments

### `GET /payment/vn-pay`
> Initiate VNPay payment. Returns a redirect URL signed with HMAC-SHA512.

**Access:** USER / ARTIST

**Query Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `premiumType` | string | yes | `1month\|3month\|6month\|12month` |

**Response `200`**
```json
{ "success": true, "data": { "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..." } }
```

> **FE:** Redirect `window.location.href = paymentUrl`. On return, user lands on `/payment/vnpay` page which reads query params.

---

### `GET /payment/vn-pay/callback`
> VNPay calls this after payment. Verifies HMAC-SHA512, activates PREMIUM on success.

**Access:** Public (called by VNPay gateway — no JWT)

**Query Params** — sent by VNPay (do not construct manually)

**Response `200`** — redirect or JSON confirmation
```jsonc
{
  "success": true,
  "data": {
    "status": "ACTIVATED",
    "premiumType": "1month",
    "premiumExpiryDate": "2026-05-05T00:00:00.000Z"
  }
}
// Side effects:
// - user.isPremium = true, add PREMIUM role, set premiumExpiryDate
// - INSERT payment_records
// - Enqueue: PREMIUM_ACTIVATED in-app notification + email
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `PAYMENT_HASH_MISMATCH` | 400 | HMAC-SHA512 verification failed |
| `PAYMENT_FAILED` | 422 | VNPay responseCode ≠ '00' |

---

### `GET /payment/momo`
> Initiate MoMo payment. Returns a redirect URL signed with HMAC-SHA256.

**Access:** USER / ARTIST

**Query Params:** `premiumType` — same as VNPay

**Response `200`**
```json
{ "success": true, "data": { "paymentUrl": "https://test-payment.momo.vn/pay/..." } }
```

---

### `GET /payment/momo/callback`
> MoMo calls this after payment. Verifies HMAC-SHA256, activates PREMIUM on `resultCode=0`.

**Access:** Public (called by MoMo gateway)

**Response `200`** — same shape as VNPay callback

**Errors**
| Code | HTTP | When |
|---|---|---|
| `PAYMENT_HASH_MISMATCH` | 400 | HMAC-SHA256 verification failed |
| `PAYMENT_FAILED` | 422 | MoMo resultCode ≠ 0 |

---

## 15. Downloads

### `POST /songs/:songId/download`
> Issue a download license + one-time encrypted download URL (5-min TTL).

**Access:** PREMIUM USER / PREMIUM ARTIST / ADMIN (bypasses PREMIUM check entirely)

**Request Body** — none

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "downloadUrl": "https://minio.internal/audio-enc/song_abc.enc?X-Amz-Expires=300&...",
    // ↑ One-time presigned URL to download the AES-256 encrypted file. TTL = 5 min.
    "licenseJwt": "eyJhbGc...",
    // ↑ License JWT: { songId, userId, wrappedKey, expiresAt: now+30d }
    //   Client stores this locally. Required to decrypt the .enc file for offline playback.
    "expiresAt": "2026-05-05T10:00:00.000Z",
    "quota": {
      "used": 43,
      "limit": 100    // 100 USER | 200 ARTIST | null ADMIN
    }
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `PREMIUM_REQUIRED` | 403 | User is not PREMIUM and not ADMIN |
| `SONG_NOT_LIVE` | 422 | Song must be LIVE to download |
| `DOWNLOAD_QUOTA_EXCEEDED` | 422 | User at quota limit |
| `ALREADY_DOWNLOADED` | 409 | Active download record already exists for this song |

---

### `GET /songs/downloads`
> List current user's downloaded songs with revocation status.

**Access:** PREMIUM / ADMIN

**Query Params:** `page`, `limit`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "quota": { "used": 43, "limit": 100 },
    "items": [
      {
        "songId": "uuid",
        "song": { /* SongSummary */ },
        "downloadStatus": "VALID",
        // downloadStatus values (FE rendering guide):
        // "VALID"      → playable, license active
        // "EXPIRING"   → license expires within 7 days, show warning
        // "REVOKED"    → premium lapsed; grey out + show "Renew Premium to play"
        // "TAKEN_DOWN" → song removed; grey out + unplayable regardless of license
        "licenseExpiresAt": "2026-05-05T10:00:00.000Z",
        "revokedAt": null,
        "downloadedAt": "2026-04-05T08:00:00.000Z"
      }
    ],
    "total": 43, "page": 1, "size": 20, "totalPages": 3
  }
}
```

---

### `DELETE /songs/downloads/:songId`
> Revoke (remove) a downloaded song. Sets `revokedAt=now`, decrements `downloadCount`.

**Access:** Authenticated

**Path Params:** `songId`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "quota": { "used": 42, "limit": 100 }
  }
}
```

---

### `POST /songs/downloads/revalidate`
> Batch revalidate download records on app open (online check). Reissues license JWTs for active PREMIUM, revokes for lapsed PREMIUM.

**Access:** Authenticated

**Request Body**
```jsonc
{
  "songIds": ["song_uuid_1", "song_uuid_2"]   // string[], required — only IDs currently stored locally
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "results": [
      {
        "songId": "song_uuid_1",
        "downloadStatus": "VALID",
        "licenseJwt": "eyJhbGc..."    // fresh JWT (30-day reset) if VALID
      },
      {
        "songId": "song_uuid_2",
        "downloadStatus": "REVOKED",
        "licenseJwt": null
      }
    ]
  }
}
```

---

## 16. Drops (Artist Live Drops)

### `GET /drops`
> List all SCHEDULED songs (Drop Management Dashboard). ARTISTs see own; ADMIN sees all.

**Access:** ARTIST / ADMIN

**Query Params:** `page`, `limit`

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "songId": "uuid",
        "title": "Neon Lights",
        "coverArtUrl": "https://...",
        "dropAt": "2026-04-20T20:00:00.000Z",
        "notifySubscriberCount": 234,
        "artist": { /* ArtistSummary */ }
      }
    ],
    "total": 3, "page": 1, "size": 20, "totalPages": 1
  }
}
```

> See also: `DELETE /songs/:songId/drop` (cancel) and `PATCH /songs/:songId/drop` (reschedule) in Section 5.

---

## 17. Admin — Song Moderation

### `GET /admin/stats`
> Dashboard overview counts.

**Access:** ADMIN

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "totalUsers": 1842,
    "totalArtists": 213,
    "totalSongs": 3401,
    "totalPlaylists": 872,
    "totalAlbums": 304,
    "pendingUploads": 12,
    "reuploadRequired": 3,
    "openReports": 7
  }
}
```

---

### `GET /admin/songs`
> List all PENDING songs and pending genre suggestions for moderation.

**Access:** ADMIN

**Query Params:** `page`, `limit`, `tab` (`songs|suggestions`, default `songs`)

**Response `200` (tab=songs)**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "song_uuid",
        "title": "Midnight Rain",
        "status": "PENDING",
        "hasDropAt": true,           // whether artist set a scheduled drop time
        "dropAt": "2026-04-20T20:00:00.000Z",
        "uploadedAt": "2026-04-03T10:00:00.000Z",
        "artist": { /* ArtistSummary */ },
        "genres": [ /* GenreSummary[] */ ],
        "duration": 213,
        "bpm": 85,
        "camelotKey": "9A"
      }
    ],
    "total": 12, "page": 1, "size": 20, "totalPages": 1
  }
}
```

---

### `PATCH /admin/songs/:songId/approve`
> Approve a PENDING song. Sets `status=LIVE` (or `SCHEDULED` if `dropAt` is set).

**Access:** ADMIN

**Request Body** — none

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "songId": "uuid",
    "status": "LIVE",           // or "SCHEDULED" if dropAt was set
    "dropAt": null
  }
}
// Side effects: INSERT AuditLog, send SONG_APPROVED in-app notification to artist
// If SCHEDULED: enqueue BullMQ delayed jobs for 24h/1h drop notifications
```

---

### `PATCH /admin/songs/:songId/reject`
> Permanently reject a PENDING song. Requires a reason. Artist is notified.

**Access:** ADMIN

**Request Body**
```jsonc
{
  "reason": "Song contains explicit content without appropriate tagging."   // string, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": { "songId": "uuid", "status": "REJECTED" }
}
// Side effects: INSERT AuditLog, send SONG_REJECTED in-app notification + email to artist
```

---

### `PATCH /admin/songs/:songId/reupload-required`
> Flag song for reupload with change notes. Artist can edit and resubmit.

**Access:** ADMIN

**Request Body**
```jsonc
{
  "notes": "Please improve audio quality. Current bitrate is below 128 kbps."   // string, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": { "songId": "uuid", "status": "REUPLOAD_REQUIRED" }
}
// Side effects: INSERT AuditLog, send SONG_REUPLOAD_REQUIRED in-app notification + email
```

---

### `PATCH /admin/songs/:songId/restore`
> Restore a TAKEN_DOWN song back to LIVE.

**Access:** ADMIN

**Response `200`**
```jsonc
{
  "success": true,
  "data": { "songId": "uuid", "status": "LIVE" }
}
// Side effects: INSERT AuditLog, send SONG_RESTORED in-app notification to artist
```

---

### `GET /admin/genres/suggestions`
> List pending genre suggestions submitted by artists during song upload.

**Access:** ADMIN

**Query Params:** `page`, `limit`, `status` (`PENDING|APPROVED|REJECTED`, default `PENDING`)

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Bedroom Pop",
        "status": "PENDING",
        "submittedBy": { /* ArtistSummary */ },
        "submittedAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "total": 4, "page": 1, "size": 20, "totalPages": 1
  }
}
```

---

### `PATCH /admin/genres/suggestions/:suggestionId/approve`
> Approve a genre suggestion. Creates Genre entity and enqueues retroactive bulk-tagging job.

**Access:** ADMIN

**Request Body** — none

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "genre": { "id": "new_uuid", "name": "Bedroom Pop" },
    "bulkTagJobId": "job_uuid"    // BullMQ job tagging all matched songs retroactively
  }
}
// Side effects: INSERT AuditLog
```

---

### `PATCH /admin/genres/suggestions/:suggestionId/reject`
> Reject a genre suggestion.

**Access:** ADMIN

**Request Body** — none

**Response `200`**
```json
{ "success": true, "data": { "status": "REJECTED" } }
```

---

## 18. Admin — User Management

### `GET /admin/users`
> Search and list all users.

**Access:** ADMIN

**Query Params**
| Param | Type | Description |
|---|---|---|
| `q` | string | Search by name or email |
| `role` | string | Filter by `USER\|ARTIST\|ADMIN` |
| `isPremium` | boolean | Filter by premium status |
| `page`, `limit` | — | Pagination |

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Nguyen Van A",
        "email": "vana@example.com",
        "roles": ["USER"],
        "isPremium": false,
        "premiumExpiryDate": null,
        "isEmailVerified": true,
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 1842, "page": 1, "size": 20, "totalPages": 93
  }
}
```

---

### `GET /admin/users/:userId`
> Full user detail including sessions.

**Access:** ADMIN

**Response `200`** — same as `GET /users/me` shape plus:
```jsonc
{
  "success": true,
  "data": {
    // ...all user fields...
    "sessions": [
      {
        "id": "sess_xyz",
        "deviceName": "Chrome / Windows",
        "ip": "203.113.xx.xx",
        "lastSeen": "2026-04-05T09:00:00.000Z"
      }
    ]
  }
}
```

---

### `PATCH /admin/users/:userId/roles`
> Promote or demote user roles.

**Access:** ADMIN

**Request Body**
```jsonc
{
  "roles": ["USER", "ARTIST"]    // string[], replaces all current roles
}
```

**Response `200`** — returns updated user

**Errors**
| Code | HTTP | When |
|---|---|---|
| `CANNOT_DEMOTE_SELF` | 403 | Admin cannot remove their own ADMIN role |

---

### `POST /admin/users/:userId/premium`
> Manually grant PREMIUM. Creates a `payment_records` entry with `amount_vnd=0`.

**Access:** ADMIN

**Request Body**
```jsonc
{
  "premiumType": "1month",         // "1month" | "3month" | "6month" | "12month"
  "reason": "Granted as compensation for service outage."   // string, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "userId": "uuid",
    "isPremium": true,
    "premiumExpiryDate": "2026-05-05T00:00:00.000Z",
    "paymentRecordId": "uuid"
  }
}
// Side effects: INSERT AuditLog, send PREMIUM_ACTIVATED in-app notification + email
```

---

### `DELETE /admin/users/:userId/premium`
> Revoke PREMIUM. Triggers download revoke cascade for all active downloads.

**Access:** ADMIN

**Request Body**
```jsonc
{
  "reason": "Terms of service violation."   // string, required
}
```

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "userId": "uuid",
    "isPremium": false,
    "revokedDownloads": 12    // number of download records revoked
  }
}
// Side effects: INSERT AuditLog, send PREMIUM_REVOKED in-app notification + email
```

---

### `GET /admin/users/:userId/sessions`
> List all active sessions for a specific user.

**Access:** ADMIN

**Response `200`** — same shape as `GET /auth/sessions` but for any user

---

### `DELETE /admin/users/:userId/sessions/:sessionId`
> Force-revoke a specific user session.

**Access:** ADMIN

**Response `200`**
```json
{ "success": true, "data": { "message": "Session revoked." } }
// Side effects: INSERT AuditLog
```

---

## 19. Admin — Content Reports

### `GET /admin/reports`
> List content reports with filters.

**Access:** ADMIN

**Query Params**
| Param | Type | Description |
|---|---|---|
| `type` | string | `EXPLICIT\|COPYRIGHT\|INAPPROPRIATE` |
| `status` | string | `PENDING\|RESOLVED\|DISMISSED` (default `PENDING`) |
| `targetType` | string | `SONG\|PLAYLIST\|ARTIST` |
| `page`, `limit` | — | — |

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "report_uuid",
        "targetType": "SONG",
        "targetId": "song_uuid",
        "targetTitle": "Midnight Rain",      // resolved from target
        "type": "COPYRIGHT",
        "status": "PENDING",
        "notes": "Uses unlicensed samples.",
        "reporter": { /* UserSummary */ },
        "createdAt": "2026-04-04T10:00:00.000Z"
      }
    ],
    "total": 7, "page": 1, "size": 20, "totalPages": 1
  }
}
```

---

### `PATCH /admin/reports/:reportId/dismiss`
> Dismiss a report with no action taken.

**Access:** ADMIN

**Response `200`**
```json
{ "success": true, "data": { "status": "DISMISSED" } }
// Side effects: INSERT AuditLog
```

---

### `PATCH /admin/reports/:reportId/takedown`
> Take down the reported content. Sets song `status=TAKEN_DOWN`. Notifies uploader.

**Access:** ADMIN

**Request Body** — none

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "reportStatus": "RESOLVED",
    "songId": "song_uuid",
    "songStatus": "TAKEN_DOWN"
  }
}
// Side effects:
// - Song removed from browse, search, playlists (greyed-out, not deleted)
// - INSERT AuditLog
// - Send in-app notification + email to song uploader
```

---

## 20. Admin — Audit Log & Payments

### `GET /admin/audit`
> Immutable audit log. Read-only. Entries are never deleted.

**Access:** ADMIN

**Query Params**
| Param | Type | Description |
|---|---|---|
| `dateFrom` | string | ISO 8601 date |
| `dateTo` | string | ISO 8601 date |
| `action` | string | Filter by action type (e.g. `SONG_APPROVED`) |
| `adminId` | string | Filter by which admin performed the action |
| `page`, `limit` | — | — |

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "audit_uuid",
        "adminId": "uuid",
        "adminName": "Super Admin",
        "action": "SONG_APPROVED",
        "targetType": "SONG",
        "targetId": "song_uuid",
        "notes": null,
        "timestamp": "2026-04-05T10:00:00.000Z"
      }
    ],
    "total": 340, "page": 1, "size": 20, "totalPages": 17
  }
}
```

---

### `GET /admin/payments`
> All payment records across VNPay, MoMo, and admin grants.

**Access:** ADMIN

**Query Params**
| Param | Type | Description |
|---|---|---|
| `method` | string | `VNPAY\|MOMO\|ADMIN_GRANTED` |
| `status` | string | `SUCCESS\|FAILED\|PENDING\|ADMIN_GRANTED` |
| `userId` | string | Filter by user UUID |
| `dateFrom` | string | ISO 8601 |
| `dateTo` | string | ISO 8601 |
| `page`, `limit` | — | — |

**Response `200`**
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "payment_uuid",
        "userId": "uuid",
        "userEmail": "vana@example.com",
        "method": "VNPAY",
        "status": "SUCCESS",
        "amountVnd": 30000,
        "premiumType": "1month",
        "premiumExpiryDate": "2026-05-05T00:00:00.000Z",
        "createdAt": "2026-04-05T10:00:00.000Z"
      }
    ],
    "total": 523, "page": 1, "size": 20, "totalPages": 27
  }
}
```

---

## 21. Utility

### `POST /upload/image`
> Upload an image and receive a public URL. Use this before submitting `coverArtUrl` or `avatarUrl` fields.

**Access:** Authenticated

**Request** — `Content-Type: multipart/form-data`
```
Field    Type    Required  Notes
────────────────────────────────────────────────────────
file     File    yes       jpg/png/webp, magic-byte validated, max 5 MB
type     string  yes       "avatar" | "song" | "playlist" | "album"
entityId string  yes       UUID of the entity this image belongs to
```

**Response `201`**
```jsonc
{
  "success": true,
  "data": {
    "url": "https://images.mymusic.app/song/song_uuid.jpg"
    // Store this URL and pass it to the next API call (e.g. POST /songs/upload as coverArtUrl)
  }
}
```

**Errors**
| Code | HTTP | When |
|---|---|---|
| `INVALID_IMAGE_TYPE` | 422 | Not jpg/png/webp |
| `FILE_TOO_LARGE` | 422 | > 5 MB |

---

## 22. Error Code Reference

| Code | HTTP | Trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing or invalid request fields (class-validator) |
| `PASSWORDS_DO_NOT_MATCH` | 400 | confirmPassword ≠ password |
| `INVALID_VERIFICATION_CODE` | 400 | Wrong or already-used 6-digit code |
| `VERIFICATION_CODE_EXPIRED` | 400 | Code older than 10 min |
| `INVALID_RESET_CODE` | 400 | Wrong reset code |
| `RESET_CODE_EXPIRED` | 400 | Reset code older than 10 min |
| `RESET_TOKEN_INVALID` | 400 | Expired or malformed reset JWT |
| `PAYMENT_HASH_MISMATCH` | 400 | VNPay/MoMo HMAC signature verification failed |
| `UNAUTHORIZED` | 401 | Missing, expired, or denylisted access token |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token expired, not found, or already rotated |
| `FORBIDDEN` | 403 | Insufficient role |
| `OWNERSHIP_VIOLATION` | 403 | ARTIST trying to modify another user's resource |
| `SELF_FOLLOW_FORBIDDEN` | 403 | User tries to follow themselves |
| `EMAIL_NOT_VERIFIED` | 403 | Action requires `isEmailVerified=true` |
| `PREMIUM_REQUIRED` | 403 | Action requires PREMIUM role |
| `ARTIST_ONLY` | 403 | Route requires ARTIST role |
| `ADMIN_ONLY` | 403 | Route requires ADMIN role |
| `CANNOT_DEMOTE_SELF` | 403 | Admin cannot remove their own ADMIN role |
| `SONG_NOT_FOUND` | 404 | Song does not exist or is not accessible |
| `RESOURCE_NOT_FOUND` | 404 | Generic not found |
| `ACCOUNT_NOT_FOUND` | 404 | Email not registered |
| `GENRE_NOT_FOUND` | 404 | Genre UUID does not exist |
| `SESSION_NOT_FOUND` | 404 | Session ID not owned by caller |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification not owned by caller |
| `TARGET_NOT_FOUND` | 404 | Report target does not exist |
| `EMAIL_ALREADY_TAKEN` | 409 | Email already registered |
| `STAGE_NAME_TAKEN` | 409 | Stage name already in use |
| `GENRE_NAME_DUPLICATE` | 409 | Genre name exists (case-insensitive) |
| `ALREADY_FOLLOWING` | 409 | Already following this user |
| `ALREADY_LIKED` | 409 | Song already in liked list |
| `ALREADY_REPORTED` | 409 | Already reported this target |
| `SONG_ALREADY_IN_PLAYLIST` | 409 | Song already in this playlist |
| `ALREADY_DOWNLOADED` | 409 | Active download record exists |
| `SONG_SCHEDULED` | 423 | Stream attempt on a SCHEDULED song — no exceptions |
| `ACCOUNT_LOCKED` | 423 | Brute-force lockout (5 failures → 15-min lock) |
| `UPLOAD_SLOT_FULL` | 429 | Artist at upload slot limit |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests (`Retry-After` header included) |
| `INVALID_MIME_TYPE` | 422 | File fails magic-byte MIME check |
| `DURATION_EXCEEDED` | 422 | Audio > 20 min |
| `FILE_TOO_LARGE` | 422 | File exceeds size limit |
| `DOWNLOAD_QUOTA_EXCEEDED` | 422 | User at download quota (100 / 200) |
| `SONG_NOT_LIVE` | 422 | Action requires song to be LIVE |
| `INVALID_STATUS_FOR_EDIT` | 422 | Song is not in editable status |
| `INVALID_STATUS_FOR_RESUBMIT` | 422 | Song is not REUPLOAD_REQUIRED |
| `INVALID_DROP_TIME` | 422 | dropAt is in the past or < 1h from now |
| `DROP_TOO_CLOSE_TO_ORIGINAL` | 422 | 1st reschedule not ≥24h before original |
| `MOOD_OR_TIME_REQUIRED` | 400 | mood omitted without timezone/localHour |
| `PAYMENT_FAILED` | 422 | Payment gateway returned failure code |
| `INVALID_IMAGE_TYPE` | 422 | Image is not jpg/png/webp |
| `INTERNAL_ERROR` | 500 | Unhandled server exception |
