-- ============================================================
-- MUSIC STREAMING APP — PostgreSQL Schema v3.0
-- March 2026
-- Soft delete: deleted_at on ALL tables EXCEPT audit_logs (immutable)
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram indexes for LIKE search (BL-23)


-- ============================================================
-- CUSTOM ENUM TYPES
-- ============================================================

-- Additive user roles stored in user_roles join table (never a single column on users)
CREATE TYPE user_role_enum AS ENUM ('USER', 'ARTIST', 'ADMIN', 'PREMIUM');

-- Song lifecycle state machine
-- PENDING → APPROVED/SCHEDULED/REJECTED/REUPLOAD_REQUIRED → LIVE/TAKEN_DOWN
-- TAKEN_DOWN → LIVE (BL-83 admin restore)
-- REUPLOAD_REQUIRED → PENDING (BL-85 artist resubmit)
CREATE TYPE song_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'SCHEDULED',
    'LIVE',
    'REJECTED',
    'REUPLOAD_REQUIRED',  -- BL-84: admin requests changes with notes
    'TAKEN_DOWN'          -- BL-83: reversible by admin
);

CREATE TYPE report_reason_enum  AS ENUM ('EXPLICIT', 'COPYRIGHT', 'INAPPROPRIATE');
CREATE TYPE report_status_enum  AS ENUM ('PENDING', 'DISMISSED', 'TAKEN_DOWN');
CREATE TYPE content_target_type_enum AS ENUM ('SONG', 'PLAYLIST', 'ARTIST', 'USER');

CREATE TYPE feed_event_type_enum AS ENUM (
    'NEW_PLAYLIST',
    'SONG_LIKED',
    'ARTIST_FOLLOWED',
    'NEW_RELEASE',        -- drop fired (BL-62)
    'UPCOMING_DROP',      -- 24h / 1h pre-drop notification (BL-61)
    'DROP_CANCELLED',     -- BL-63
    'DROP_RESCHEDULED'    -- BL-65
);

CREATE TYPE device_type_enum              AS ENUM ('MOBILE', 'DESKTOP', 'TABLET', 'OTHER');
CREATE TYPE genre_suggestion_status_enum  AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE premium_type_enum             AS ENUM ('1_MONTH', '3_MONTH', '6_MONTH', '12_MONTH');
CREATE TYPE payment_status_enum           AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'ADMIN_GRANTED');
CREATE TYPE payment_provider_enum         AS ENUM ('VNPAY', 'MOMO', 'ADMIN');  -- BL-20/21, BL-76/77, BL-74

-- In-app notification types (BL-64, BL-74, BL-75, BL-80–82, BL-84, BL-83)
CREATE TYPE notification_type_enum AS ENUM (
    'DROP_UPCOMING',          -- BL-61: 24h / 1h before drop
    'DROP_FIRED',             -- BL-64: at drop time
    'DROP_CANCELLED',         -- BL-63
    'DROP_RESCHEDULED',       -- BL-65
    'PREMIUM_ACTIVATED',      -- BL-21, BL-77, BL-74
    'PREMIUM_REVOKED',        -- BL-75
    'SONG_REUPLOAD_REQUIRED', -- BL-84
    'SONG_RESTORED'           -- BL-83
);


-- ============================================================
-- DOMAIN 1: USERS & AUTHENTICATION
-- ============================================================

-- ----------------------------------------------------------------
-- users
-- Core identity. Premium fields live here (BL-21/26).
-- Brute-force lock fields per BL-43.
-- ----------------------------------------------------------------
CREATE TABLE users (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100)    NOT NULL,
    email               VARCHAR(255)    NOT NULL,
    password_hash       VARCHAR(255)    NOT NULL,                    -- bcrypt rounds=10
    avatar_url          VARCHAR(500),
    is_email_verified   BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Premium tier (BL-21, BL-26)
    premium_status      BOOLEAN         NOT NULL DEFAULT FALSE,
    premium_expiry_date TIMESTAMP WITH TIME ZONE,

    -- Brute-force protection (BL-43)
    failed_attempts     SMALLINT        NOT NULL DEFAULT 0,
    lock_until          TIMESTAMP WITH TIME ZONE,

    -- Crossfade preference (BL-37B) — 0–12 sec, default 3
    crossfade_seconds   SMALLINT        NOT NULL DEFAULT 3
        CHECK (crossfade_seconds BETWEEN 0 AND 12),

    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_premium ON users (premium_status, premium_expiry_date)
    WHERE deleted_at IS NULL AND premium_status = TRUE;  -- BL-26 cron


-- ----------------------------------------------------------------
-- user_roles  (many-to-many additive roles — Section 2)
-- ----------------------------------------------------------------
CREATE TABLE user_roles (
    user_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        user_role_enum  NOT NULL,
    granted_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,

    PRIMARY KEY (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);


-- ----------------------------------------------------------------
-- user_preferences
-- Cold-start genre seeds (BL-35A), mood, device context (BL-38A).
-- ----------------------------------------------------------------
CREATE TABLE user_preferences (
    id                      UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    onboarding_genre_ids    UUID[]  DEFAULT '{}',   -- BL-35A cold-start seeds
    last_mood               VARCHAR(20),            -- HAPPY/SAD/FOCUS/CHILL/WORKOUT (BL-36A/B)
    preferred_device_context device_type_enum,      -- BL-38A
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);


-- ----------------------------------------------------------------
-- refresh_tokens  (BL-04, BL-25 cron cleanup)
-- ----------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,   -- stored as hash, not raw token
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expiry  ON refresh_tokens (expiry_date) WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- sessions  (BL-42 device session management, BL-45 cleanup cron)
-- ----------------------------------------------------------------
CREATE TABLE sessions (
    id                  UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_id    UUID             REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    device_name         VARCHAR(200),
    device_type         device_type_enum,
    ip_address          INET,
    last_seen_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_sessions_user_id   ON sessions (user_id)      WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_last_seen ON sessions (last_seen_at) WHERE deleted_at IS NULL;  -- BL-45


-- ----------------------------------------------------------------
-- verification_codes  (BL-06/07, BL-27 cron cleanup)
-- ----------------------------------------------------------------
CREATE TABLE verification_codes (
    id              UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL,
    code            CHAR(6)  NOT NULL,   -- 6-digit numeric (BL-06)
    expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,   -- now + 10 min
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_verification_codes_email      ON verification_codes (email);
CREATE INDEX idx_verification_codes_expiration ON verification_codes (expiration_time)
    WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- forgot_password_tokens  (BL-07/08)
-- ----------------------------------------------------------------
CREATE TABLE forgot_password_tokens (
    id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT  NOT NULL UNIQUE,   -- signed reset JWT (15 min expiry)
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_forgot_password_tokens_user_id ON forgot_password_tokens (user_id);


-- ----------------------------------------------------------------
-- invalidated_tokens  (BL-03 JWT blacklist / jti store)
-- ----------------------------------------------------------------
CREATE TABLE invalidated_tokens (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    jti         VARCHAR(255) NOT NULL UNIQUE,   -- JWT ID claim
    user_id     UUID         REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_invalidated_tokens_jti        ON invalidated_tokens (jti);
CREATE INDEX idx_invalidated_tokens_expires_at ON invalidated_tokens (expires_at);


-- ============================================================
-- DOMAIN 2: ARTIST PROFILES
-- ============================================================

-- ----------------------------------------------------------------
-- artist_profiles  (BL-46/47)
-- Created atomically with User on artist registration.
-- One-to-one with users (user_id UNIQUE).
-- ----------------------------------------------------------------
CREATE TABLE artist_profiles (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stage_name      VARCHAR(150) NOT NULL,
    bio             TEXT         NOT NULL,
    follower_count  INTEGER      NOT NULL DEFAULT 0,
    avatar_url      VARCHAR(500),
    social_links    JSONB        NOT NULL DEFAULT '[]',  -- [{url, label}]
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_artist_profiles_user_id    ON artist_profiles (user_id);
CREATE INDEX idx_artist_profiles_stage_name ON artist_profiles USING gin (stage_name gin_trgm_ops);


-- ============================================================
-- DOMAIN 3: GENRES
-- ============================================================

-- ----------------------------------------------------------------
-- genres  (BL-36, BL-49)
-- Admin-confirmed genre list.
-- ----------------------------------------------------------------
CREATE TABLE genres (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE UNIQUE INDEX idx_genres_name ON genres (LOWER(name)) WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- genre_suggestions  (BL-49)
-- Artists propose new genres during upload.
-- song_id FK added after songs table is created below.
-- ----------------------------------------------------------------
CREATE TABLE genre_suggestions (
    id              UUID                         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100)                 NOT NULL,
    suggested_by    UUID                         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id         UUID,                        -- FK constraint added below after songs exists
    status          genre_suggestion_status_enum NOT NULL DEFAULT 'PENDING',
    admin_note      TEXT,
    reviewed_by     UUID                         REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_genre_suggestions_status      ON genre_suggestions (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_genre_suggestions_suggested_by ON genre_suggestions (suggested_by);


-- ============================================================
-- DOMAIN 4: CONTENT — ALBUMS, SONGS, PLAYLISTS
-- ============================================================

-- ----------------------------------------------------------------
-- albums  (BL-10, BL-14, BL-18)
-- totalTracks / totalHours are denormalized counters, maintained
-- by the application on each song add/remove.
-- ----------------------------------------------------------------
CREATE TABLE albums (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255)  NOT NULL,
    cover_art_url   VARCHAR(500),
    artist_id       UUID          NOT NULL REFERENCES artist_profiles(id) ON DELETE RESTRICT,
    -- RESTRICT: BL-19 — deleting an artist must not cascade-delete albums
    description     TEXT,
    release_year    SMALLINT,
    follower_count  INTEGER       NOT NULL DEFAULT 0,      -- BL-10
    total_tracks    SMALLINT      NOT NULL DEFAULT 0,      -- BL-14 denormalized
    total_hours     NUMERIC(6,2)  NOT NULL DEFAULT 0.00,   -- BL-14 in hours
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_albums_artist_id ON albums (artist_id) WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- songs  (Section 4, BL-37A, BL-44, BL-59–65)
-- bpm / energy / camelot_key support AI compatibility scoring (BL-37A).
-- enc_file_url: AES-256 .enc variant generated at upload (BL-44).
-- drop_reschedule_count: enforces BL-65 max-1 artist reschedule rule.
-- ----------------------------------------------------------------
CREATE TABLE songs (
    id                      UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    title                   VARCHAR(255)      NOT NULL,
    file_url                VARCHAR(500)      NOT NULL,   -- streaming audio
    enc_file_url            VARCHAR(500),                 -- AES-256 offline variant (BL-44/53)
    cover_art_url           VARCHAR(500),
    duration_seconds        INTEGER           NOT NULL    -- BL-44: max 20 min
        CHECK (duration_seconds > 0 AND duration_seconds <= 1200),

    -- AI metadata (BL-37A mood mapping)
    bpm                     SMALLINT          CHECK (bpm IS NULL OR bpm BETWEEN 20 AND 300),
    energy                  NUMERIC(3,2)      CHECK (energy IS NULL OR energy BETWEEN 0.00 AND 1.00),
    camelot_key             VARCHAR(4),       -- e.g. '8A', '11B'

    -- State machine (Section 4.1)
    status                  song_status_enum  NOT NULL DEFAULT 'PENDING',
    rejection_reason        TEXT,                         -- populated on REJECTED
    reupload_reason         TEXT,                         -- BL-84: admin notes on REUPLOAD_REQUIRED
    drop_at                 TIMESTAMP WITH TIME ZONE,     -- NULL unless SCHEDULED (BL-59)
    drop_reschedule_count   SMALLINT          NOT NULL DEFAULT 0,  -- BL-65: >=2 requires admin

    -- Counters
    listener_count          INTEGER           NOT NULL DEFAULT 0,   -- BL-09

    -- Ownership
    uploader_id             UUID              NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    artist_profile_id       UUID              REFERENCES artist_profiles(id) ON DELETE SET NULL,
    album_id                UUID              REFERENCES albums(id) ON DELETE SET NULL,

    -- Approval tracking
    approved_by             UUID              REFERENCES users(id) ON DELETE SET NULL,
    approved_at             TIMESTAMP WITH TIME ZONE,
    validated_at            TIMESTAMP WITH TIME ZONE,   -- set after magic-byte check (BL-44)

    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

-- NFR required: drop cron performance (BL-62)
CREATE INDEX idx_songs_status_drop_at ON songs (status, drop_at)
    WHERE status = 'SCHEDULED' AND drop_at IS NOT NULL;

CREATE INDEX idx_songs_status      ON songs (status)      WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_uploader_id ON songs (uploader_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_album_id    ON songs (album_id)    WHERE deleted_at IS NULL AND album_id IS NOT NULL;
CREATE INDEX idx_songs_title_trgm  ON songs USING gin (title gin_trgm_ops);  -- BL-23


-- ----------------------------------------------------------------
-- Back-fill FK: genre_suggestions → songs (deferred to here)
-- ----------------------------------------------------------------
ALTER TABLE genre_suggestions
    ADD CONSTRAINT fk_genre_suggestions_song_id
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE SET NULL;

CREATE INDEX idx_genre_suggestions_song_id ON genre_suggestions (song_id);


-- ----------------------------------------------------------------
-- song_genres  (many-to-many, BL-36)
-- ----------------------------------------------------------------
CREATE TABLE song_genres (
    song_id     UUID NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    genre_id    UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (song_id, genre_id)
);

CREATE INDEX idx_song_genres_genre_id ON song_genres (genre_id);


-- ----------------------------------------------------------------
-- playlists  (BL-13, BL-15, BL-17, BL-22, BL-34)
-- is_liked_songs = TRUE → special auto-created per user (BL-34).
-- Partial unique index enforces exactly one per user.
-- ----------------------------------------------------------------
CREATE TABLE playlists (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255)  NOT NULL,
    description     TEXT,
    cover_art_url   VARCHAR(500),
    is_public       BOOLEAN       NOT NULL DEFAULT TRUE,
    is_liked_songs  BOOLEAN       NOT NULL DEFAULT FALSE,  -- BL-34
    creator_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    follower_count  INTEGER       NOT NULL DEFAULT 0,      -- BL-12
    listener_count  INTEGER       NOT NULL DEFAULT 0,      -- BL-12
    total_tracks    SMALLINT      NOT NULL DEFAULT 0,      -- BL-15 denormalized
    total_hours     NUMERIC(6,2)  NOT NULL DEFAULT 0.00,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

-- Exactly one LikedSongs playlist per user (BL-34)
CREATE UNIQUE INDEX idx_playlists_liked_songs_per_user ON playlists (creator_id)
    WHERE is_liked_songs = TRUE AND deleted_at IS NULL;

CREATE INDEX idx_playlists_creator_id  ON playlists (creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_playlists_title_trgm  ON playlists USING gin (title gin_trgm_ops);


-- ----------------------------------------------------------------
-- playlist_songs  (many-to-many, ordered)
-- ----------------------------------------------------------------
CREATE TABLE playlist_songs (
    playlist_id UUID     NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     UUID     NOT NULL REFERENCES songs(id)     ON DELETE CASCADE,
    position    INTEGER  NOT NULL,   -- 1-based ordering
    added_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (playlist_id, song_id)
);

CREATE UNIQUE INDEX idx_playlist_songs_position ON playlist_songs (playlist_id, position)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_playlist_songs_song_id ON playlist_songs (song_id);


-- ----------------------------------------------------------------
-- playlist_genres  (many-to-many, BL-36)
-- ----------------------------------------------------------------
CREATE TABLE playlist_genres (
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    genre_id    UUID NOT NULL REFERENCES genres(id)    ON DELETE CASCADE,
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (playlist_id, genre_id)
);

CREATE INDEX idx_playlist_genres_genre_id ON playlist_genres (genre_id);


-- ----------------------------------------------------------------
-- saved_playlists  (BL-13 — users saving / following playlists)
-- ----------------------------------------------------------------
CREATE TABLE saved_playlists (
    user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    saved_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (user_id, playlist_id)
);

CREATE INDEX idx_saved_playlists_playlist_id ON saved_playlists (playlist_id);


-- ============================================================
-- DOMAIN 5: SOCIAL
-- ============================================================

-- ----------------------------------------------------------------
-- user_follows  (BL-32 self-referential follow graph)
-- follower_id follows followee_id.
-- ----------------------------------------------------------------
CREATE TABLE user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id <> followee_id)
);

CREATE INDEX idx_user_follows_followee_id ON user_follows (followee_id) WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- song_likes  (BL-34)
-- Source of truth for likes. Application also syncs to LikedSongs playlist.
-- ----------------------------------------------------------------
CREATE TABLE song_likes (
    user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    song_id    UUID NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    liked_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (user_id, song_id)
);

CREATE INDEX idx_song_likes_song_id ON song_likes (song_id) WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- feed_events  (BL-33, BL-61, BL-62, BL-63, BL-65)
-- ----------------------------------------------------------------
CREATE TABLE feed_events (
    id          UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id    UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type  feed_event_type_enum  NOT NULL,
    target_id   UUID,                -- polymorphic; NULL for actor-only events
    target_type content_target_type_enum,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_feed_events_actor_id  ON feed_events (actor_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_feed_events_created_at ON feed_events (created_at DESC)           WHERE deleted_at IS NULL;


-- ============================================================
-- DOMAIN 6: PLAYBACK
-- ============================================================

-- ----------------------------------------------------------------
-- playback_history  (BL-29, BL-35B skip feedback loop)
-- Cap 200 entries per user enforced at application layer.
-- skipped = TRUE when play < 10 seconds.
-- ----------------------------------------------------------------
CREATE TABLE playback_history (
    id        UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id   UUID    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    song_id   UUID    NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    skipped   BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_playback_history_user_played  ON playback_history (user_id, played_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_playback_history_played_at    ON playback_history (played_at DESC)           WHERE deleted_at IS NULL;
CREATE INDEX idx_playback_history_song_skipped ON playback_history (song_id, skipped)         WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- playback_states  (BL-30 resume playback)
-- One row per user per song — upserted on each play event.
-- ----------------------------------------------------------------
CREATE TABLE playback_states (
    user_id          UUID    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    song_id          UUID    NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    position_seconds INTEGER NOT NULL DEFAULT 0,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (user_id, song_id)
);

CREATE INDEX idx_playback_states_user_updated ON playback_states (user_id, updated_at DESC)
    WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- queues  (BL-31 transient server-side queue, cleared on logout)
-- ----------------------------------------------------------------
CREATE TABLE queues (
    id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    song_id    UUID    NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    position   INTEGER NOT NULL,   -- 1-based; randomised by app for shuffle mode
    added_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE UNIQUE INDEX idx_queues_user_position ON queues (user_id, position) WHERE deleted_at IS NULL;
CREATE INDEX idx_queues_user_id             ON queues (user_id)            WHERE deleted_at IS NULL;


-- ============================================================
-- DOMAIN 7: PREMIUM & PAYMENTS
-- ============================================================

-- ----------------------------------------------------------------
-- payment_records  (BL-20/21 VNPay)
-- ----------------------------------------------------------------
CREATE TABLE payment_records (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    premium_type        premium_type_enum   NOT NULL,
    amount_vnd          INTEGER             NOT NULL,    -- Vietnamese Dong
    provider            payment_provider_enum NOT NULL DEFAULT 'VNPAY',  -- VNPAY | MOMO | ADMIN
    status              payment_status_enum   NOT NULL DEFAULT 'PENDING',
    vnpay_txn_ref       VARCHAR(100)          UNIQUE,   -- vnp_TxnRef for reconciliation
    vnpay_response_code VARCHAR(10),                    -- '00' = success (VNPay)
    momo_order_id       VARCHAR(100)          UNIQUE,   -- orderId for reconciliation (MoMo)
    premium_expiry_date TIMESTAMP WITH TIME ZONE,        -- calculated on success callback
    initiated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at        TIMESTAMP WITH TIME ZONE,
    deleted_at          TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_payment_records_user_id ON payment_records (user_id);
CREATE INDEX idx_payment_records_status  ON payment_records (status) WHERE deleted_at IS NULL;


-- ============================================================
-- DOMAIN 8: OFFLINE DOWNLOADS
-- ============================================================

-- ----------------------------------------------------------------
-- download_records  (BL-52–57, BL-58 cleanup cron)
-- revoked_at IS NULL  = active license
-- revoked_at IS NOT NULL = revoked (lapsed premium or manual removal)
-- BL-54 quota = COUNT WHERE user_id=X AND revoked_at IS NULL
-- BL-58 hard-deletes rows where revoked_at < now - 7 days
-- ----------------------------------------------------------------
CREATE TABLE download_records (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    song_id    UUID NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    issued_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,   -- issued_at + 30 days (BL-53)
    revoked_at TIMESTAMP WITH TIME ZONE,             -- NULL = active; set by BL-56 or BL-57
    deleted_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

-- NFR required: quota check (BL-54) and premium-lapse cascade (BL-56)
CREATE INDEX idx_download_records_user_revoked ON download_records (user_id, revoked_at)
    WHERE deleted_at IS NULL;

-- BL-58 cleanup cron
CREATE INDEX idx_download_records_revoked_at ON download_records (revoked_at)
    WHERE revoked_at IS NOT NULL;

-- Prevent duplicate active license for same user+song (BL-52/53)
CREATE UNIQUE INDEX idx_download_records_active_per_user_song
    ON download_records (user_id, song_id)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;


-- ============================================================
-- DOMAIN 9: ARTIST LIVE DROPS
-- ============================================================

-- ----------------------------------------------------------------
-- drop_notifications  (BL-64 opt-in beyond just following)
-- ----------------------------------------------------------------
CREATE TABLE drop_notifications (
    user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    song_id     UUID NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    opted_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL,
    PRIMARY KEY (user_id, song_id)
);

-- Drop-firing cron looks up opted-in users per song (BL-62/64)
CREATE INDEX idx_drop_notifications_song_id ON drop_notifications (song_id) WHERE deleted_at IS NULL;


-- ============================================================
-- DOMAIN 10: IN-APP NOTIFICATIONS
-- ============================================================

-- ----------------------------------------------------------------
-- notifications  (BL-64, BL-74, BL-75, BL-80–82, BL-83, BL-84)
-- Written by server events (drops, premium changes, song status).
-- Read by user via BL-80/81/82.
-- ----------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type_enum  NOT NULL,
    title       VARCHAR(255)            NOT NULL,
    body        TEXT                    NOT NULL,
    target_id   UUID,                              -- polymorphic (song, payment, etc.)
    target_type content_target_type_enum,
    is_read     BOOLEAN                 NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, is_read, created_at DESC)
    WHERE deleted_at IS NULL;                      -- BL-82 unread count + BL-80 list

CREATE INDEX idx_notifications_user_id
    ON notifications (user_id, created_at DESC)
    WHERE deleted_at IS NULL;


-- ============================================================
-- DOMAIN 11: MODERATION
-- ============================================================

-- ----------------------------------------------------------------
-- content_reports  (BL-38)
-- Polymorphic: target_type + target_id → SONG / PLAYLIST / ARTIST / USER
-- ----------------------------------------------------------------
CREATE TABLE content_reports (
    id              UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id     UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type     content_target_type_enum NOT NULL,
    target_id       UUID                     NOT NULL,   -- polymorphic — no FK enforced
    reason          report_reason_enum       NOT NULL,
    description     TEXT,
    status          report_status_enum       NOT NULL DEFAULT 'PENDING',
    resolved_by     UUID                     REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMP WITH TIME ZONE,
    resolution_note TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL
);

CREATE INDEX idx_content_reports_status ON content_reports (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_reports_target ON content_reports (target_type, target_id) WHERE deleted_at IS NULL;

-- Prevent duplicate open reports per reporter per target
CREATE UNIQUE INDEX idx_content_reports_unique_open
    ON content_reports (reporter_id, target_type, target_id)
    WHERE status = 'PENDING' AND deleted_at IS NULL;


-- ============================================================
-- DOMAIN 11: AUDIT LOG (IMMUTABLE — NO soft delete)
-- ============================================================

-- ----------------------------------------------------------------
-- audit_logs  (BL-40)
-- IMMUTABLE: no deleted_at, no UPDATE, no DELETE.
-- Production hardening: REVOKE UPDATE, DELETE ON audit_logs FROM app_role;
-- ----------------------------------------------------------------
CREATE TABLE audit_logs (
    id          UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    UUID                     NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- RESTRICT: cannot delete an admin who has audit history
    action      VARCHAR(100)             NOT NULL,   -- e.g. 'SONG_APPROVED', 'DROP_FIRED'
    target_type content_target_type_enum,
    target_id   UUID,                               -- polymorphic
    notes       TEXT,
    timestamp   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    -- intentionally NO deleted_at — audit_logs are immutable (BL-40)
);

CREATE INDEX idx_audit_logs_admin_id  ON audit_logs (admin_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX idx_audit_logs_target    ON audit_logs (target_type, target_id);
CREATE INDEX idx_audit_logs_action    ON audit_logs (action);
