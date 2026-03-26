// =============================================================================
// MUSIC STREAMING APP — DTOs & Standard Response Specification
// Version 3.0 · March 2026
// Tech stack: NestJS / TypeORM / class-validator
// =============================================================================

// =============================================================================
// SECTION 1: STANDARD API RESPONSE (Question 4)
// All endpoints — both success and error — return this envelope.
// FE should always unwrap `data`; check `success` before processing.
// =============================================================================

/**
 * Every API error carries a machine-readable code so the FE can handle
 * specific cases (show premium upsell, redirect to login, etc.) without
 * parsing human-readable messages.
 */
export enum ErrorCode {
  // Auth / Identity
  UNAUTHENTICATED           = 'UNAUTHENTICATED',          // wrong credentials (BL-02)
  INVALID_TOKEN             = 'INVALID_TOKEN',            // malformed / blacklisted JWT
  TOKEN_EXPIRED             = 'TOKEN_EXPIRED',            // access token past expiry
  ACCOUNT_LOCKED            = 'ACCOUNT_LOCKED',           // brute-force lock (BL-43)
  EMAIL_ALREADY_EXISTS      = 'EMAIL_ALREADY_EXISTS',     // duplicate email (BL-01)
  VERIFICATION_CODE_INVALID = 'VERIFICATION_CODE_INVALID',// wrong code (BL-07)
  VERIFICATION_CODE_EXPIRED = 'VERIFICATION_CODE_EXPIRED',// expired code (BL-07)
  RESET_TOKEN_INVALID       = 'RESET_TOKEN_INVALID',      // bad reset token (BL-08)

  // Authorization
  FORBIDDEN                 = 'FORBIDDEN',                // wrong role for action
  PREMIUM_REQUIRED          = 'PREMIUM_REQUIRED',         // needs PREMIUM tier (BL-52)

  // Content
  NOT_FOUND                 = 'NOT_FOUND',                // resource not found
  SONG_LOCKED               = 'SONG_LOCKED',              // SCHEDULED song stream attempt (BL-60)
  UPLOAD_LIMIT_EXCEEDED     = 'UPLOAD_LIMIT_EXCEEDED',    // quota breach (BL-39)
  DOWNLOAD_LIMIT_EXCEEDED   = 'DOWNLOAD_LIMIT_EXCEEDED',  // download quota (BL-52)
  INVALID_FILE_TYPE         = 'INVALID_FILE_TYPE',        // magic-byte check failed (BL-44)
  FILE_TOO_LONG             = 'FILE_TOO_LONG',            // > 20 min (BL-44)
  REPORT_ALREADY_OPEN       = 'REPORT_ALREADY_OPEN',      // duplicate report (BL-38)

  // Drops
  DROP_WINDOW_TOO_SHORT     = 'DROP_WINDOW_TOO_SHORT',    // < 1 h from now (BL-59)
  DROP_WINDOW_TOO_LONG      = 'DROP_WINDOW_TOO_LONG',     // > 90 days (BL-59)
  DROP_ALREADY_LIVE         = 'DROP_ALREADY_LIVE',        // song already LIVE
  DROP_RESCHEDULE_LIMIT     = 'DROP_RESCHEDULE_LIMIT',    // artist used their one reschedule (BL-65)
  DROP_TOO_CLOSE_TO_CANCEL  = 'DROP_TOO_CLOSE_TO_CANCEL', // < 24 h before dropAt (BL-65)

  // Rate limiting
  RATE_LIMITED              = 'RATE_LIMITED',             // 429 (BL-41)

  // Generic
  VALIDATION_ERROR          = 'VALIDATION_ERROR',         // class-validator field errors
  INTERNAL_ERROR            = 'INTERNAL_ERROR',           // 500 fallback
}

/** Field-level validation error — one entry per failing field. */
export interface FieldError {
  field   : string;   // e.g. 'email', 'password', 'dropAt'
  messages: string[]; // e.g. ['must be a valid email']
}

/** Structured error payload — always present when success = false. */
export interface ApiError {
  code       : ErrorCode;
  message    : string;        // human-readable, safe to surface in UI
  fieldErrors: FieldError[];  // populated for VALIDATION_ERROR; empty otherwise
}

/**
 * Standard API envelope — wraps EVERY response (success and error).
 *
 * Success:  { success: true,  data: T,    error: null }
 * Error:    { success: false, data: null, error: ApiError }
 */
export interface ApiResponse<T> {
  success  : boolean;
  data     : T | null;
  error    : ApiError | null;
  timestamp: string;   // ISO 8601 — e.g. "2026-03-26T10:00:00.000Z"
  path     : string;   // request path — e.g. "/songs/123"
}

/**
 * Paginated data payload — used as T in ApiResponse<PaginatedData<Item>>.
 * Matches BL-24: page, size, totalPages, totalItems, items[].
 *
 * Example full response:
 * ApiResponse<PaginatedData<SongResponse>>
 */
export interface PaginatedData<T> {
  page      : number;
  size      : number;
  totalPages: number;
  totalItems: number;
  items     : T[];
}

// =============================================================================
// SECTION 2: SHARED / COMMON DTOs
// =============================================================================

/** BL-24 — query params for all paginated list endpoints. */
export class PaginationQueryDto {
  page  : number = 1;    // default 1
  size  : number = 10;   // default 10
  sortBy: string = 'id'; // default 'id'
  order : 'ASC' | 'DESC' = 'DESC';
}

/**
 * BL-23 — search query format.
 * filters: array of strings like ["name~Rock", "listener>1000"]
 * Operators: ~ (LIKE), > (gt), < (lt)
 */
export class SearchQueryDto extends PaginationQueryDto {
  filters: string[] = []; // e.g. ["title~Rock", "listener>500"]
}

// =============================================================================
// SECTION 3: AUTH DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** BL-01 — POST /auth/register (role = USER) */
export class RegisterUserDto {
  name           : string; // required
  email          : string; // required, valid email, unique
  password       : string; // required, min 8 chars
  confirmPassword: string; // must match password
}

/** BL-46 — POST /auth/register (role = ARTIST) */
export class RegisterArtistDto {
  name           : string;   // required
  email          : string;   // required, valid email, unique
  password       : string;   // required, min 8 chars
  confirmPassword: string;
  stageName      : string;   // required
  bio            : string;   // required
  genres         : string[]; // required, min 1 confirmed genre name
  socialLinks    : SocialLinkDto[]; // optional
}

export class SocialLinkDto {
  label: string; // e.g. "Instagram"
  url  : string; // valid URL
}

/** BL-02 — POST /auth/login */
export class LoginDto {
  email   : string;
  password: string;
}

/** BL-04 — POST /auth/refresh */
export class RefreshTokenDto {
  refreshToken: string;
}

/** BL-05 — PATCH /auth/password */
export class ChangePasswordDto {
  oldPassword    : string;
  newPassword    : string; // min 8 chars
  confirmPassword: string; // must match newPassword
}

/** BL-06 — POST /auth/forgot-password */
export class ForgotPasswordDto {
  email: string;
}

/** BL-07 — POST /auth/verify-code */
export class VerifyCodeDto {
  email: string;
  code : string; // 6-digit numeric
}

/** BL-08 — POST /auth/reset-password */
export class ResetPasswordDto {
  token          : string; // reset JWT from BL-07
  newPassword    : string; // min 8 chars
  confirmPassword: string;
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** Returned by BL-01, BL-02, BL-04 */
export interface TokenResponse {
  accessToken : string;
  refreshToken: string;
  expiresIn   : number; // access token TTL in seconds
  user        : UserResponse;
}

/** Returned by BL-05 and any endpoint returning user info */
export interface UserResponse {
  id                : string;
  name              : string;
  email             : string;
  avatarUrl         : string | null;
  roles             : string[];        // e.g. ['USER', 'PREMIUM']
  premiumStatus     : boolean;
  premiumExpiryDate : string | null;   // ISO 8601
  isEmailVerified   : boolean;
  crossfadeSeconds  : number;
  artistProfile     : ArtistProfileResponse | null; // populated if ARTIST role
  createdAt         : string;
}

/** Returned by BL-06 — exposes only non-sensitive fields */
export interface VerificationCodeResponse {
  email          : string;
  expirationTime : string; // ISO 8601
}

/** Returned by BL-07 */
export interface ForgotPasswordTokenResponse {
  token    : string; // reset JWT — FE passes this to BL-08
  expiresAt: string; // ISO 8601
}

/** BL-42 — GET /auth/sessions */
export interface SessionResponse {
  id          : string;
  deviceName  : string | null;
  deviceType  : string | null;
  ipAddress   : string | null;
  lastSeenAt  : string; // ISO 8601
  isCurrent   : boolean; // true if this session matches current JWT
  createdAt   : string;
}

// =============================================================================
// SECTION 4: ARTIST PROFILE DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** PATCH /artists/me/profile */
export class UpdateArtistProfileDto {
  stageName  ?: string;
  bio        ?: string;
  avatarUrl  ?: string;
  socialLinks?: SocialLinkDto[];
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** BL-47 — embedded in UserResponse and song/album responses */
export interface ArtistProfileResponse {
  id           : string;
  userId       : string;
  stageName    : string;
  bio          : string;
  avatarUrl    : string | null;
  followerCount: number;
  socialLinks  : SocialLinkDto[];
}

/** BL-51 — GET /artist/me/analytics or GET /admin/artists/:id/analytics */
export interface ArtistAnalyticsResponse {
  artistId     : string;
  stageName    : string;
  followerCount: number;
  totalSongs   : number;
  totalPlays   : number;
  totalLikes   : number;
  top5Songs    : SongAnalyticsItem[]; // top 5 by plays in last 30 days
}

export interface SongAnalyticsItem {
  songId   : string;
  title    : string;
  playCount: number;
  likeCount: number;
}

// =============================================================================
// SECTION 5: GENRE DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** POST /genres — admin only */
export class CreateGenreDto {
  name: string; // must be unique (case-insensitive)
}

/** PATCH /genres/suggestions/:id — admin reviews a suggestion (BL-49) */
export class ReviewGenreSuggestionDto {
  action   : 'APPROVE' | 'REJECT';
  adminNote?: string; // required if action = REJECT
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface GenreResponse {
  id       : string;
  name     : string;
  createdAt: string;
}

export interface GenreSuggestionResponse {
  id         : string;
  name       : string;
  suggestedBy: UserResponse;
  songId     : string;
  status     : 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote  : string | null;
  createdAt  : string;
}

// =============================================================================
// SECTION 6: SONG DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/**
 * BL-48, BL-44, BL-49, BL-59
 * POST /songs/upload — multipart/form-data
 * File field: 'audio' (validated via magic bytes)
 */
export class UploadSongDto {
  title          : string;
  coverArtUrl   ?: string;
  albumId       ?: string;             // optional album association
  genreIds       : string[];           // min 1 confirmed genre ID
  suggestedGenres: string[];           // BL-49: new genre names not in confirmed list
  dropAt        ?: string;             // BL-59: ISO 8601 datetime; min 1h, max 90 days from now
  // AI metadata (optional — enriched by admin or external tool)
  bpm           ?: number;
  energy        ?: number;             // 0.0–1.0
  camelotKey    ?: string;             // e.g. '8A'
}

/** BL-37 — POST /admin/songs/:id/approve */
export class ApproveSongDto {
  dropAt?: string; // ISO 8601 — if set, song becomes SCHEDULED instead of LIVE
}

/** BL-37 — POST /admin/songs/:id/reject */
export class RejectSongDto {
  reason: string; // required
}

/** PATCH /songs/:id — artist edits own song metadata (not status) */
export class UpdateSongDto {
  title        ?: string;
  coverArtUrl  ?: string;
  albumId      ?: string | null;
  genreIds     ?: string[];
  bpm          ?: number;
  energy       ?: number;
  camelotKey   ?: string;
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** Returned on any song fetch — isLiked requires authenticated user context (BL-34) */
export interface SongResponse {
  id            : string;
  title         : string;
  fileUrl       : string;
  coverArtUrl   : string | null;
  durationSeconds: number;
  status        : 'PENDING' | 'APPROVED' | 'SCHEDULED' | 'LIVE' | 'REJECTED' | 'TAKEN_DOWN';
  dropAt        : string | null;        // ISO 8601; present if SCHEDULED
  listenerCount : number;
  isLiked       : boolean;             // false for unauthenticated requests
  genres        : GenreResponse[];
  uploader      : UserResponse;
  artist        : ArtistProfileResponse | null;
  album         : AlbumSummaryResponse | null;
  bpm           : number | null;
  energy        : number | null;
  camelotKey    : string | null;
  createdAt     : string;
}

/** Minimal album info embedded in SongResponse */
export interface AlbumSummaryResponse {
  id         : string;
  title      : string;
  coverArtUrl: string | null;
}

// =============================================================================
// SECTION 7: ALBUM DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** POST /albums */
export class CreateAlbumDto {
  title      : string;
  coverArtUrl?: string;
  description?: string;
  releaseYear?: number;
}

/** PATCH /albums/:id */
export class UpdateAlbumDto {
  title      ?: string;
  coverArtUrl?: string;
  description?: string;
  releaseYear?: number;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface AlbumResponse {
  id          : string;
  title       : string;
  coverArtUrl : string | null;
  description : string | null;
  releaseYear : number | null;
  artist      : ArtistProfileResponse;
  totalTracks : number;
  totalHours  : number;
  followerCount: number;
  songs       : SongResponse[];         // omitted in list views, populated in detail view
  createdAt   : string;
}

// =============================================================================
// SECTION 8: PLAYLIST DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** POST /playlists */
export class CreatePlaylistDto {
  title      : string;
  description?: string;
  coverArtUrl?: string;
  isPublic   : boolean;
  genreIds  ?: string[];
}

/** PATCH /playlists/:id */
export class UpdatePlaylistDto {
  title      ?: string;
  description?: string;
  coverArtUrl?: string;
  isPublic   ?: boolean;
  genreIds   ?: string[];
}

/** POST /playlists/:id/songs */
export class AddSongToPlaylistDto {
  songId  : string;
  position: number; // 1-based position in playlist
}

/** PATCH /playlists/:id/songs/reorder */
export class ReorderPlaylistDto {
  orderedSongIds: string[]; // full ordered list of song IDs
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface PlaylistResponse {
  id           : string;
  title        : string;
  description  : string | null;
  coverArtUrl  : string | null;
  isPublic     : boolean;
  isLikedSongs : boolean;
  creator      : UserResponse;
  genres       : GenreResponse[];
  totalTracks  : number;
  totalHours   : number;
  followerCount: number;
  listenerCount: number;
  songs        : SongResponse[]; // omitted in list views, populated in detail view
  createdAt    : string;
}

// =============================================================================
// SECTION 9: SOCIAL DTOs
// =============================================================================

// ── Responses ─────────────────────────────────────────────────────────────────

/** BL-33 — single item in the activity feed */
export interface FeedEventResponse {
  id        : string;
  actor     : UserResponse;
  eventType : 'NEW_PLAYLIST' | 'SONG_LIKED' | 'ARTIST_FOLLOWED' | 'NEW_RELEASE'
            | 'UPCOMING_DROP' | 'DROP_CANCELLED' | 'DROP_RESCHEDULED';
  targetId  : string | null;
  targetType: 'SONG' | 'PLAYLIST' | 'ARTIST' | 'USER' | null;
  // Resolved target — one of these will be populated based on targetType
  song      : SongResponse | null;
  playlist  : PlaylistResponse | null;
  artist    : ArtistProfileResponse | null;
  createdAt : string;
}

/** BL-32 — returned on follow/unfollow or profile responses */
export interface FollowStatsResponse {
  followerCount : number;
  followingCount: number;
  isFollowing   : boolean; // whether current user follows this profile
}

// =============================================================================
// SECTION 10: PLAYBACK DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** POST /queue/songs */
export class AddToQueueDto {
  songId  : string;
  position: number; // 1-based; inserts at this position, shifting others down
}

/** PATCH /queue/reorder */
export class ReorderQueueDto {
  orderedSongIds: string[];
}

/** PATCH /users/me/crossfade */
export class UpdateCrossfadeDto {
  crossfadeSeconds: number; // 0–12
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** BL-29 — single history entry */
export interface PlaybackHistoryResponse {
  id      : string;
  song    : SongResponse;
  playedAt: string;  // ISO 8601
  skipped : boolean;
}

/** BL-30 — returned on app load for "Continue listening" */
export interface ResumePlaybackResponse {
  song            : SongResponse | null; // null if no history
  positionSeconds : number;
}

/**
 * BL-37B — embedded in playback stream response.
 * Server signals crossfade config to client; client handles audio fade.
 */
export interface NowPlayingResponse {
  song            : SongResponse;
  positionSeconds : number;
  crossfadeSeconds: number;  // current user's crossfade setting
  queue           : SongResponse[]; // next N songs in queue
}

export interface QueueResponse {
  items      : QueueItemResponse[];
  totalItems : number;
}

export interface QueueItemResponse {
  position: number;
  song    : SongResponse;
}

// =============================================================================
// SECTION 11: PREMIUM & PAYMENTS DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** BL-20 — GET /payment/vn-pay?premiumType= */
export class InitiatePaymentDto {
  premiumType: '1_MONTH' | '3_MONTH' | '6_MONTH' | '12_MONTH';
}

/**
 * BL-21 — GET /payment/vn-pay/callback (VNPay redirects here)
 * Query params sent by VNPay; validated via HMAC-SHA512 checksum.
 */
export class VNPayCallbackDto {
  vnp_TxnRef      : string;
  vnp_ResponseCode: string; // '00' = success
  vnp_Amount      : string;
  vnp_SecureHash  : string; // for server-side verification
  [key: string]   : string; // VNPay sends additional params
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** BL-20 */
export interface PaymentUrlResponse {
  paymentUrl: string;
  txnRef    : string;  // vnp_TxnRef — FE can use for status polling
  amount    : number;  // in VND
}

/** BL-21 */
export interface PremiumResponse {
  premiumStatus    : boolean;
  premiumExpiryDate: string; // ISO 8601
  roles            : string[];
}

// =============================================================================
// SECTION 12: OFFLINE DOWNLOADS DTOs
// =============================================================================

// ── Responses ─────────────────────────────────────────────────────────────────

/** BL-53 — POST /songs/:id/download */
export interface DownloadResponse {
  downloadUrl : string;  // signed one-time URL (5-min TTL)
  licenseJwt  : string;  // client stores this; contains encrypted AES key
  expiresAt   : string;  // ISO 8601 — license expires after 30 days
  downloadCount: number; // updated quota after this download
}

/**
 * BL-55 — POST /songs/downloads/revalidate
 * Returns status for each active download record.
 */
export interface RevalidationResponse {
  results: RevalidationItem[];
}

export interface RevalidationItem {
  songId    : string;
  revoked   : boolean;  // true = PREMIUM lapsed; client should grey out the song
  licenseJwt: string | null; // fresh JWT if still active; null if revoked
  expiresAt : string | null;
}

/** BL-57 — DELETE /songs/downloads/:songId */
export interface DownloadCountResponse {
  downloadCount: number; // remaining active downloads after removal
}

// =============================================================================
// SECTION 13: ARTIST LIVE DROPS DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/**
 * BL-59 — dropAt is set during upload (UploadSongDto) or approval (ApproveSongDto).
 * These are separate dedicated endpoints for drop management post-approval.
 */

/** BL-65 — PATCH /songs/:id/drop */
export class RescheduleDropDto {
  dropAt: string; // ISO 8601; min 1h in future; at least 24h before original dropAt
}

// ── Responses ─────────────────────────────────────────────────────────────────

/** BL-60 — GET /songs/:id/teaser (public, no JWT required) */
export interface TeaserResponse {
  songId         : string;
  title          : string;
  coverArtUrl    : string | null;
  artistName     : string;
  dropAt         : string; // ISO 8601
  countdownSeconds: number; // seconds remaining until dropAt
}

// =============================================================================
// SECTION 14: MODERATION DTOs
// =============================================================================

// ── Requests ─────────────────────────────────────────────────────────────────

/** BL-38 — POST /reports */
export class CreateReportDto {
  targetType : 'SONG' | 'PLAYLIST' | 'ARTIST';
  targetId   : string;
  reason     : 'EXPLICIT' | 'COPYRIGHT' | 'INAPPROPRIATE';
  description?: string; // optional freetext
}

/** POST /admin/reports/:id/resolve */
export class ResolveReportDto {
  action        : 'DISMISS' | 'TAKE_DOWN';
  resolutionNote?: string;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface ContentReportResponse {
  id            : string;
  reporter      : UserResponse;
  targetType    : 'SONG' | 'PLAYLIST' | 'ARTIST';
  targetId      : string;
  reason        : 'EXPLICIT' | 'COPYRIGHT' | 'INAPPROPRIATE';
  description   : string | null;
  status        : 'PENDING' | 'DISMISSED' | 'TAKEN_DOWN';
  resolvedBy    : UserResponse | null;
  resolvedAt    : string | null;
  resolutionNote: string | null;
  createdAt     : string;
}

// =============================================================================
// SECTION 15: UPLOAD LIMITS RESPONSE
// =============================================================================

/** BL-39 — included in UPLOAD_LIMIT_EXCEEDED error's ApiError.message or data */
export interface UploadLimitStatsResponse {
  currentSongCount : number;
  maxSongCount     : number;
  currentStorageMb : number;
  maxFileSizeMb    : number;
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
── Success (single item) ────────────────────────────────────────────────────
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,
    "user": { "id": "...", "name": "Hieu", "roles": ["USER"], ... }
  },
  "error": null,
  "timestamp": "2026-03-26T10:00:00.000Z",
  "path": "/auth/login"
}

── Success (paginated list) ─────────────────────────────────────────────────
{
  "success": true,
  "data": {
    "page": 1,
    "size": 10,
    "totalPages": 5,
    "totalItems": 47,
    "items": [ { "id": "...", "title": "Song A", ... } ]
  },
  "error": null,
  "timestamp": "2026-03-26T10:00:01.000Z",
  "path": "/songs"
}

── Validation error ─────────────────────────────────────────────────────────
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fieldErrors": [
      { "field": "email",    "messages": ["must be a valid email address"] },
      { "field": "password", "messages": ["must be at least 8 characters"] }
    ]
  },
  "timestamp": "2026-03-26T10:00:02.000Z",
  "path": "/auth/register"
}

── Business logic error ─────────────────────────────────────────────────────
{
  "success": false,
  "data": null,
  "error": {
    "code": "PREMIUM_REQUIRED",
    "message": "This action requires an active Premium subscription.",
    "fieldErrors": []
  },
  "timestamp": "2026-03-26T10:00:03.000Z",
  "path": "/songs/abc123/download"
}

── Rate limited (HTTP 429) ──────────────────────────────────────────────────
HTTP Header: Retry-After: 45
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry after 45 seconds.",
    "fieldErrors": []
  },
  "timestamp": "2026-03-26T10:00:04.000Z",
  "path": "/auth/login"
}
*/
