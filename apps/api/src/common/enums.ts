// Single source of truth for all domain enums.
// Must stay in sync with the PostgreSQL enum types in database_schema.sql.

export enum Role {
  USER = 'USER',
  ARTIST = 'ARTIST',
  ADMIN = 'ADMIN',
  PREMIUM = 'PREMIUM',
}

export enum SongStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  REJECTED = 'REJECTED',
  REUPLOAD_REQUIRED = 'REUPLOAD_REQUIRED',
  TAKEN_DOWN = 'TAKEN_DOWN',
}

export enum NotificationType {
  SONG_APPROVED = 'SONG_APPROVED',
  SONG_REJECTED = 'SONG_REJECTED',
  SONG_REUPLOAD_REQUIRED = 'SONG_REUPLOAD_REQUIRED',
  SONG_RESTORED = 'SONG_RESTORED',
  PREMIUM_ACTIVATED = 'PREMIUM_ACTIVATED',
  PREMIUM_REVOKED = 'PREMIUM_REVOKED',
  UPCOMING_DROP = 'UPCOMING_DROP',      // BL-61: 24h / 1h before drop
  NEW_RELEASE = 'NEW_RELEASE',          // BL-64: drop fired
  DROP_CANCELLED = 'DROP_CANCELLED',
  DROP_RESCHEDULED = 'DROP_RESCHEDULED',
  SONG_TAKEN_DOWN = 'SONG_TAKEN_DOWN',   // Phase 9: report takedown cascade
}

export enum PaymentProvider {
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
  ADMIN = 'ADMIN',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  ADMIN_GRANTED = 'ADMIN_GRANTED',
}

export enum PremiumType {
  ONE_MONTH = '1_MONTH',
  THREE_MONTH = '3_MONTH',
  SIX_MONTH = '6_MONTH',
  TWELVE_MONTH = '12_MONTH',
}

export enum DeviceType {
  MOBILE = 'MOBILE',
  DESKTOP = 'DESKTOP',
  TABLET = 'TABLET',
  OTHER = 'OTHER',
}

export enum GenreSuggestionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum FeedEventType {
  NEW_PLAYLIST = 'NEW_PLAYLIST',
  SONG_LIKED = 'SONG_LIKED',
  ARTIST_FOLLOWED = 'ARTIST_FOLLOWED',
  NEW_RELEASE = 'NEW_RELEASE',
  UPCOMING_DROP = 'UPCOMING_DROP',
  DROP_CANCELLED = 'DROP_CANCELLED',
  DROP_RESCHEDULED = 'DROP_RESCHEDULED',
}

export enum ReportReason {
  EXPLICIT = 'EXPLICIT',
  COPYRIGHT = 'COPYRIGHT',
  INAPPROPRIATE = 'INAPPROPRIATE',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  DISMISSED = 'DISMISSED',
  RESOLVED = 'RESOLVED',  // report acted on — song taken down (L4)
}

export enum ContentTargetType {
  SONG = 'SONG',
  PLAYLIST = 'PLAYLIST',
  ARTIST = 'ARTIST',
  USER = 'USER',
}

export enum MoodType {
  HAPPY   = 'HAPPY',
  SAD     = 'SAD',
  FOCUS   = 'FOCUS',
  CHILL   = 'CHILL',
  WORKOUT = 'WORKOUT',
}
