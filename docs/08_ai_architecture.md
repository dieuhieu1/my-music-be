# AI Architecture
**Music Streaming App · AI Layer Design**

---

## 0. Overview

The system contains **four AI subsystems**, ranging from rule-based signal processing to LLM-powered agents:

| # | Subsystem | Type | Status |
|---|---|---|---|
| 1 | Audio Feature Extraction | Python DSP (librosa/essentia) | Existing |
| 2 | Smart Order Algorithm | Greedy nearest-neighbor (server-side) | Existing |
| 3 | Recommendation Engine | Genre-based batch + Redis cache-aside | Existing → upgraded |
| 4 | AI Music Assistant | LLM Agent (Claude API) | New |

---

## 1. AI Layer

### 1.1 Models Used

| Model | Role | Provider | Notes |
|---|---|---|---|
| `claude-sonnet-4-6` | Reasoning, intent parsing, response generation | Anthropic API | Primary LLM for AI Assistant agent |
| `text-embedding-3-small` | Song + user profile embeddings | OpenAI API | Powers semantic similarity in upgraded recommendation engine |
| librosa `beat_track` | BPM detection | Local (Python sidecar) | Runs on raw audio — no external API call |
| librosa `chroma_cqt` | Key detection → Camelot Wheel | Local (Python sidecar) | Deterministic — no model inference |
| librosa RMS + spectral centroid | Energy score (0–100) | Local (Python sidecar) | Saved to DB, not shown to users |

### 1.2 External Services

```
Anthropic API  ──── claude-sonnet-4-6 ──── AI Music Assistant agent reasoning
OpenAI API     ──── text-embedding-3-small ── Song/user embedding generation
SMTP           ──── Nodemailer ─────────── Email delivery (not AI, but async)
MinIO          ──── Object storage ──────── Audio source for DSP extraction
```

### 1.3 High-Level Data Flow

```
User natural language query
        │
        ▼
  [ NestJS /ai/chat endpoint ]
        │  structured message + tool schemas
        ▼
  [ Claude claude-sonnet-4-6 (Anthropic API) ]
        │  tool_use response: select skill(s)
        ▼
  [ Skills Dispatcher (NestJS service) ]
        │  calls internal services / DB
        ├──► SongsService.search()
        ├──► RecommendationsService.getMood()
        ├──► PlaybackService.getSmartOrder()
        └──► PlaylistsService.create()
        │
        ▼
  [ Skill results fed back to Claude ]
        │  final_response
        ▼
  [ Structured JSON response to client ]
```

---

## 2. Subsystem 1 — Audio Feature Extraction Pipeline

**Owner:** Python FastAPI sidecar (`http://dsp:8000`)
**Trigger:** Song upload or resubmit → `AudioExtractionWorker` (BullMQ)

### Data Flow
```
POST /songs/upload
  → multer buffers audio
  → MIME + duration validation (NestJS)
  → Upload raw file to MinIO bucket: audio
  → Song.status = PENDING
  → Enqueue AudioExtractionJob { songId }

AudioExtractionWorker:
  → MinIO.presignedGetObject('audio', songId.mp3, TTL=600s) → audioUrl
  → POST http://dsp:8000/extract { audioUrl }
        Python: requests.get(audioUrl) → load into librosa
        beat_track()   → bpm: 120.4
        chroma_cqt()   → pitch class → Camelot key: "8A"
        RMS + centroid → energy: 67
  → Worker: UPDATE songs SET bpm=120, camelot_key='8A', energy=67
  → Job marked completed

Client: polls GET /songs/upload/:jobId/status every 3s
  → completed: auto-fill BPM + Key in form, unlock for artist override
  → failed:    show "Auto-extraction failed", fields unlocked for manual entry
```

### DSP Sidecar Contract
```
POST http://dsp:8000/extract
Request:  { "audioUrl": "https://minio/.../song.mp3?presigned" }
Response: { "bpm": 120.4, "camelotKey": "8A", "energy": 67 }
Errors:   { "error": "DOWNLOAD_FAILED" | "ANALYSIS_FAILED" }
```

---

## 3. Subsystem 2 — Smart Order Algorithm

**Owner:** `PlaybackService` (NestJS, fully server-side)
**Trigger:** User toggles Smart Order ON via `PATCH /playback/queue/smart-order`

### Algorithm
```
Input: queue of N unplayed tracks, each with { bpm, camelotKey, energy }

Score function (lower = better match):
  normBpm     = |bpm_a - bpm_b| / 140        (assumes max diff of 140 BPM)
  camelotDist = 0 if keys are adjacent/same on Camelot Wheel, else 1
  normEnergy  = |energy_a - energy_b| / 100
  score       = 0.4 * normBpm + 0.4 * camelotDist + 0.2 * normEnergy

Greedy pass:
  Start at currentTrack
  For each remaining track: compute score vs. previous track
  Pick track with lowest score → append to ordered list
  Repeat until all tracks placed

Persist: UPDATE queue_items SET position = <new>, original_position = <old>
Toggle OFF: restore original_position values
```

---

## 4. Subsystem 3 — Recommendation Engine (Librosa-Based)

> **Full implementation guide:** see `09_recommendation_engine.md`

The recommendation engine uses the audio features already extracted by the Python DSP sidecar (librosa) and stored in the `songs` table. **No external model, no training, no embedding API required.**

### 4.1 Existing Genre-Based Batch (Daily, for /recommendations)
```
Daily cron → RecommendationBatchWorker:
  For each user:
    liked_genres = genres from LikedSongs + followed artist genres
    songs = SELECT LIVE songs WHERE genre IN liked_genres
            ORDER BY listener DESC LIMIT 50
    UPSERT recommendation_cache(userId, songIds jsonb, computedAt=now)

GET /recommendations:
  1. Redis GET rec:{userId}          → hit → return (24h TTL)
  2. Miss → SELECT recommendation_cache WHERE userId=X
  3. Redis SET rec:{userId} TTL=86400 → return
```

### 4.2 Next-Song Recommendation (Real-Time, for /songs/:id/next)

Uses librosa features (`bpm`, `camelotKey`, `energy`) already stored in the `songs` table to compute musical distance between songs. No batch job needed — runs on every auto-play request.

```
GET /songs/:songId/next
  │
  ├─ Build exclusion set (4 layers):
  │    Layer 1 → song_daily_stats    (DB:  played in last 7 days)
  │    Layer 2 → session:{uid}:played (Redis: played this session, TTL 2h)
  │    Layer 3 → session:{uid}:recs   (Redis: last 20 recommended, TTL 2h)
  │    Layer 4 → decay:{uid}:{songId} (Redis: penalise repeat recommends, TTL 7d)
  │
  ├─ Pull all LIVE songs WHERE bpm IS NOT NULL (librosa data exists)
  │    Exclude the full exclusion set
  │
  ├─ Score each candidate:
  │    bpm_dist    = |candidate.bpm - current.bpm| / 140          (0–1)
  │    key_dist    = camelotAdjacent ? 0 : 1                      (0 or 1)
  │    energy_dist = |candidate.energy - current.energy| / 100    (0–1)
  │    genre_bonus = candidate in user.topGenres ? -0.15 : 0
  │    decay_pen   = min(recommendCount * 0.05, 0.30)
  │    pop_bonus   = log10(listener + 1) / 100
  │    score = (0.4 × bpm_dist) + (0.4 × key_dist) + (0.2 × energy_dist)
  │           + genre_bonus + decay_pen - pop_bonus
  │
  ├─ Sort ascending (lower score = better match)
  ├─ Pick randomly from top 5  (prevents ping-pong between top 2)
  │
  ├─ Update Redis:
  │    LPUSH session:{uid}:recs songId  → LTRIM to 20
  │    INCR  decay:{uid}:{songId}
  │
  └─ Return SongSummary

Fallback (catalog exhaustion — pool < 5):
  1st → drop Layer 1 (DB cooldown), keep session exclusion
  2nd → drop Layers 1+3+4, keep session only
  last → any LIVE song except current song
```

### 4.3 Data Sources (all in existing DB — no new tables needed for Tier 1)

| Data | Table | Used for |
|---|---|---|
| `bpm`, `camelotKey`, `energy` | `songs` | Audio distance calculation |
| `genres[]` | `song_genres` | Genre preference matching |
| Liked songs | `liked_songs` | Build user top-genre profile |
| Play history | `song_daily_stats` | Layer 1 deduplication (7-day cooldown) |
| Session state | Redis (TTL 2h) | Layers 2 & 3 deduplication |
| Decay counters | Redis (TTL 7d) | Layer 4 penalty |

---

## 5. Subsystem 4 — AI Music Assistant Agent

The flagship AI feature. Users send natural language queries; the agent reasons and calls internal skills to fulfil the request.

### 5.1 Architecture

```
User Input (natural language)
        │
        ▼
POST /api/v1/ai/chat
{
  "message": "Create a playlist for a late-night study session",
  "conversationId": "conv_xyz"   // optional, for multi-turn
}
        │
        ▼
  AiChatService (NestJS)
    - Load conversation history (Redis, TTL 1h)
    - Build system prompt (user roles, premium status, current context)
    - Send to Claude claude-sonnet-4-6 with tools schema
        │
        ▼
  Claude reasons: which skills to call, in what order
        │  tool_use blocks
        ▼
  SkillsDispatcher.execute(toolName, toolInput)
        │  skill results
        ▼
  Claude composes final response (natural language + structured data)
        │
        ▼
  Return to client:
  {
    "success": true,
    "data": {
      "reply": "I've created 'Late Night Focus' with 15 songs...",
      "actions": [
        { "type": "PLAYLIST_CREATED", "playlistId": "pl_abc" },
        { "type": "QUEUE_UPDATED" }
      ],
      "conversationId": "conv_xyz"
    }
  }
```

### 5.2 System Prompt Template
```
You are a music assistant for MyMusic, a streaming platform.
Current user: {{ user.name }} | Roles: {{ user.roles }} | Premium: {{ user.isPremium }}
Current time: {{ localTime }} ({{ timezone }})

You help users discover music, create playlists, and control playback.
Always use the provided tools to fetch real data. Never fabricate song names or IDs.
When creating playlists, confirm the action with the user before persisting if >20 songs.
Respond concisely. Prefer bullet lists for song recommendations.
```

### 5.3 Agent Endpoint

```
POST /api/v1/ai/chat
Auth: Required (verified)
Rate limit: 20 req/min per user

Request:
{
  "message": string,            // user query (max 500 chars)
  "conversationId": string?     // continue a conversation
}

Response:
{
  "success": true,
  "data": {
    "reply": string,            // natural language response
    "actions": Action[],        // side effects (playlist created, queue updated, etc.)
    "conversationId": string,
    "tokensUsed": number        // for monitoring
  }
}
```

---

## 6. Skills Registry

Skills are NestJS services exposed to Claude as tools. Each skill maps 1:1 to an existing internal service method.

---

### Skill 1: `search_songs`

**Description:** Search for songs by title, artist, genre, mood, or audio features.
**When used:** User asks for songs matching a description ("upbeat 90s rock", "songs by Sơn Tùng").

**Input Schema**
```json
{
  "query": "string",
  "filters": {
    "genreName": "string?",
    "mood": "happy|sad|focus|chill|workout?",
    "minBpm": "number?",
    "maxBpm": "number?",
    "camelotKey": "string?",
    "artistName": "string?"
  },
  "limit": "number (1-20, default 10)"
}
```

**Output Schema**
```json
{
  "songs": [
    {
      "id": "string",
      "title": "string",
      "artistName": "string",
      "genre": "string",
      "bpm": "number",
      "camelotKey": "string",
      "duration": "number",
      "listener": "number"
    }
  ],
  "total": "number"
}
```

---

### Skill 2: `get_recommendations`

**Description:** Fetch personalized song recommendations for the current user.
**When used:** User asks "what should I listen to?" or "recommend something new."

**Input Schema**
```json
{
  "limit": "number (1-50, default 20)"
}
```

**Output Schema**
```json
{
  "songs": "SongSummary[]",
  "source": "CACHE | FRESH",
  "computedAt": "ISO datetime"
}
```

---

### Skill 3: `get_mood_playlist`

**Description:** Generate an on-demand playlist tuned to a mood or inferred from time of day.
**When used:** User mentions a mood, activity, or time context ("studying", "gym", "it's midnight").

**Input Schema**
```json
{
  "mood": "happy|sad|focus|chill|workout?",
  "localHour": "number (0-23)?",
  "timezone": "string (IANA)?",
  "limit": "number (1-50, default 20)"
}
```

**Output Schema**
```json
{
  "mood": "string",
  "inferredMood": "boolean",
  "songs": "SongSummary[]"
}
```

---

### Skill 4: `create_playlist`

**Description:** Create a new playlist and optionally add songs to it.
**When used:** User explicitly wants to save a collection ("make a playlist called...", "save these songs").

**Input Schema**
```json
{
  "name": "string",
  "description": "string?",
  "songIds": "string[]?"
}
```

**Output Schema**
```json
{
  "playlistId": "string",
  "name": "string",
  "totalTracks": "number",
  "url": "/playlists/:playlistId"
}
```

---

### Skill 5: `add_to_queue`

**Description:** Add one or more songs to the user's playback queue.
**When used:** User wants to play something now or next ("play this", "queue up some lo-fi").

**Input Schema**
```json
{
  "songIds": "string[]",
  "playNext": "boolean (default false)"
}
```

**Output Schema**
```json
{
  "queueLength": "number",
  "addedCount": "number"
}
```

---

### Skill 6: `get_artist_info`

**Description:** Retrieve artist profile, top songs, and follower count.
**When used:** User asks about an artist ("tell me about Sơn Tùng", "show me IU's songs").

**Input Schema**
```json
{
  "artistName": "string"
}
```

**Output Schema**
```json
{
  "id": "string",
  "stageName": "string",
  "bio": "string",
  "followerCount": "number",
  "listenerCount": "number",
  "topSongs": "SongSummary[]"
}
```

---

### Skill 7: `analyze_listening_history`

**Description:** Summarize the user's listening patterns (top genres, peak hours, avg BPM preference).
**When used:** User asks for a summary ("what do I usually listen to?", "what's my music taste?").

**Input Schema**
```json
{
  "timeRange": "7d | 30d | 90d (default 30d)"
}
```

**Output Schema**
```json
{
  "topGenres": [{ "name": "string", "playCount": "number" }],
  "topArtists": [{ "stageName": "string", "playCount": "number" }],
  "avgBpm": "number",
  "peakListeningHour": "number (0-23)",
  "totalMinutesListened": "number"
}
```

---

## 7. Agent Reasoning Flow

The agent follows a **ReAct loop** (Reason → Act → Observe → Repeat):

```
1. RECEIVE user message
2. THINK: parse intent, identify required skills, plan execution order
3. for each required skill:
     ACT:     call skill with validated inputs
     OBSERVE: receive skill output, check for errors
     THINK:   update plan if output changes next step
4. SYNTHESIZE: compose natural language reply + action list
5. RETURN: { reply, actions, conversationId }
```

### Planning Rules (baked into system prompt)
- **Search before create:** always call `search_songs` before `create_playlist` to get real IDs.
- **Mood before queue:** call `get_mood_playlist` before `add_to_queue` for mood-based requests.
- **Max 3 tool calls per turn** to prevent runaway loops (configurable).
- **Confirm destructive actions:** if creating >20-song playlist, ask user for confirmation first.
- **Degrade gracefully:** if a skill returns empty results, acknowledge and suggest alternatives.

---

## 8. Example Scenario

### User Input
> *"I have a 2-hour study session coming up. Create a playlist with focus music and add the first 5 songs to my queue."*

### Agent Execution Trace

```
TURN 1

User: "I have a 2-hour study session..."

Claude THINKS:
  Intent: create focus playlist + queue first 5 songs
  Plan:
    Step 1 → get_mood_playlist(mood="focus", limit=20)
    Step 2 → create_playlist(name="Study Session", songIds=[top 15 from step 1])
    Step 3 → add_to_queue(songIds=[first 5 from step 1])

─────────────────────────────────────────────

Step 1: CALL get_mood_playlist
  Input:  { "mood": "focus", "limit": 20 }
  Output: {
    "mood": "focus",
    "inferredMood": false,
    "songs": [
      { "id": "song_01", "title": "Deep Flow", "bpm": 85, "camelotKey": "9A" },
      { "id": "song_02", "title": "Alpha Waves", "bpm": 72, "camelotKey": "6A" },
      { "id": "song_03", "title": "Clarity", "bpm": 90, "camelotKey": "10B" },
      ... (17 more)
    ]
  }

─────────────────────────────────────────────

Step 2: CALL create_playlist
  Input:  {
    "name": "Study Session — Focus",
    "description": "2-hour focus session playlist",
    "songIds": ["song_01","song_02",...,"song_15"]
  }
  Output: {
    "playlistId": "pl_study_001",
    "name": "Study Session — Focus",
    "totalTracks": 15
  }

─────────────────────────────────────────────

Step 3: CALL add_to_queue
  Input:  { "songIds": ["song_01","song_02","song_03","song_04","song_05"], "playNext": true }
  Output: { "queueLength": 5, "addedCount": 5 }

─────────────────────────────────────────────

Claude SYNTHESIZES final reply:
  "Done! I've created **'Study Session — Focus'** with 15 tracks (~1h 52min of low-BPM
  instrumental music). The first 5 songs have been added to your queue and will start
  playing next:

  1. Deep Flow — 85 BPM
  2. Alpha Waves — 72 BPM
  3. Clarity — 90 BPM
  4. Stillwater — 78 BPM
  5. Morning Fog — 82 BPM

  The full playlist is saved to your library. Good luck with your session!"
```

### Final Response to Client
```json
{
  "success": true,
  "data": {
    "reply": "Done! I've created **'Study Session — Focus'** with 15 tracks...",
    "actions": [
      { "type": "PLAYLIST_CREATED", "playlistId": "pl_study_001", "name": "Study Session — Focus" },
      { "type": "QUEUE_UPDATED", "addedCount": 5, "queueLength": 5 }
    ],
    "conversationId": "conv_abc123",
    "tokensUsed": 847
  }
}
```

---

## 9. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                 │
│                        Next.js (Port 3000)                              │
│   useAiChat() hook → POST /ai/chat → renders reply + triggers actions   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP REST
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             API LAYER                                   │
│                         NestJS (Port 3001)                              │
│                                                                         │
│   ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐   │
│   │  AiChatCtrl  │   │  Songs / Players │   │  Admin / Payments   │   │
│   │  /ai/chat    │   │  /songs  /play   │   │  /admin  /payment   │   │
│   └──────┬───────┘   └──────────────────┘   └─────────────────────┘   │
│          │                                                              │
│   ┌──────▼───────────────────────────────────────┐                     │
│   │            AiChatService                     │                     │
│   │  - Conversation history (Redis, 1h TTL)      │                     │
│   │  - Build system prompt                        │                     │
│   │  - Anthropic SDK: messages.create()          │                     │
│   │  - SkillsDispatcher: execute tool calls      │                     │
│   └──────┬───────────────────────────────────────┘                     │
└──────────┼──────────────────────────────────────────────────────────────┘
           │
     ┌─────┴──────────────────────────────────────────────────┐
     │                   AI LAYER                             │
     │                                                        │
     │  ┌──────────────────────┐  ┌───────────────────────┐  │
     │  │   Anthropic API      │  │   OpenAI API          │  │
     │  │   claude-sonnet-4-6  │  │   text-embedding-3    │  │
     │  │   Reasoning + tools  │  │   Song/user vectors   │  │
     │  └──────────────────────┘  └───────────────────────┘  │
     │                                                        │
     │  ┌──────────────────────┐                             │
     │  │  Python DSP Sidecar  │                             │
     │  │  FastAPI (Port 8000) │                             │
     │  │  librosa · essentia  │                             │
     │  └──────────────────────┘                             │
     └────────────────────────────────────────────────────────┘
           │
     ┌─────┴──────────────────────────────────────────────────┐
     │                  DATA LAYER                            │
     │                                                        │
     │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
     │  │ PostgreSQL  │  │   Redis     │  │    MinIO     │  │
     │  │ songs       │  │ rec:{uid}   │  │ audio/       │  │
     │  │ song_embed  │  │ conv:{id}   │  │ audio-enc/   │  │
     │  │ user_embed  │  │ jti:{jti}   │  │ images/      │  │
     │  │ rec_cache   │  │ throttle:   │  │              │  │
     │  └─────────────┘  └─────────────┘  └──────────────┘  │
     └────────────────────────────────────────────────────────┘
```

---

## 10. FE ↔ BE ↔ AI ↔ DB Interaction Map

```
FE Action                  BE Handler           AI Component          DB / Cache
─────────────────────────────────────────────────────────────────────────────────
User types AI query   →  POST /ai/chat        AiChatService          Redis: load conv history
                                              Anthropic API          (LLM reasoning)
                                              SkillsDispatcher  →    PostgreSQL: song queries
                                              add_to_queue       →   PostgreSQL: queue_items INSERT
                         Return JSON reply   ←                       Redis: save conv history

Song upload           →  POST /songs/upload                          MinIO: upload audio
                         Return jobId        BullMQ enqueue          PostgreSQL: song INSERT
                                             AudioExtractionWorker
                                             → DSP sidecar POST /extract
                                             ← { bpm, key, energy }
                                                                      PostgreSQL: UPDATE song
FE polls job status   →  GET /songs/upload/:jobId/status             Redis: BullMQ job state

App load (rec)        →  GET /recommendations                         Redis: rec:{userId} HIT?
                                                                      → YES: return cached
                                                                      → NO: query rec_cache table
                                                                             SET Redis TTL=24h

Daily cron            →  RecommendationBatchWorker                   OpenAI: embed songs + users
                                                                      PostgreSQL: UPSERT embeddings
                                                                      PostgreSQL: UPSERT rec_cache
```

---

## 11. Environment Variables (AI-specific)

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
AI_MAX_TOOLS_PER_TURN=3
AI_CONVERSATION_TTL_SECONDS=3600

# OpenAI (embeddings)
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# DSP Sidecar
DSP_SIDECAR_URL=http://dsp:8000
DSP_REQUEST_TIMEOUT_MS=30000
```
