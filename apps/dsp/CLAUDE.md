## Project Overview

**Purpose**: Stateless HTTP sidecar — receives a presigned MinIO URL, downloads the audio, and returns BPM, Camelot key, energy score, and duration. Called exclusively by the NestJS `AudioExtractionWorker` (BullMQ job `extract-metadata`). Never called by the frontend.

**Domain**: Audio signal processing (music metadata extraction).

**Tech stack**: Python 3.11 · FastAPI 0.111 · librosa 0.10.2 · soundfile 0.12 · NumPy 1.26 · uvicorn.

---

## Folder Structure

```
apps/dsp/
  main.py          — FastAPI app, request/response models, two endpoints
  extract.py       — All DSP logic (download → load → BPM/key/energy/duration)
  requirements.txt — Pinned Python deps
  Dockerfile       — python:3.11-slim + libsndfile1 + ffmpeg; exposes :5000
```

---

## Processing Pipeline

```
Presigned MinIO URL (HTTP GET, 60s timeout, stream=True)
        │
        ▼
  io.BytesIO buffer          ← no temp file, all in memory
        │
        ▼
  librosa.load(sr=None, mono=True)
   ├── y_full, sr  ─────────────────► duration = get_duration(y_full, sr)
   └── y = y_full[:120s]             (slice for BPM + key analysis)
        │
        ├──► BPM          beat_track(y, sr)  → round to 1 decimal
        ├──► Camelot Key  chroma_cqt → argmax → major/minor heuristic → CAMELOT dict
        └──► Energy       rms + spectral_centroid → composite score
        │
        ▼
  { bpm, camelotKey, energy, duration }   (JSON response)
```

---

## Core Algorithms

### BPM (`extract.py:44-45`)
- **Input**: mono waveform slice (≤120 s, native sr)
- **Method**: `librosa.beat.beat_track` — onset envelope + dynamic programming tempo estimation
- **Output**: `float` rounded to 1 decimal; in newer librosa `tempo` is an array → `float(tempo)` unwraps it

### Camelot Key (`extract.py:48-54`)
- **Input**: same 120 s slice
- **Method**: Constant-Q chroma (`chroma_cqt`) → mean across time → dominant pitch class = `argmax(chroma_mean)`.
  Major/minor heuristic: if `chroma_mean[key_idx] > chroma_mean[(key_idx+9)%12]` → major, else minor (relative minor is 9 semitones up).
- **Lookup**: `CAMELOT: dict[tuple[int, bool], str]` — 24-entry table, key `(pitch_class_0-11, is_major)` → e.g. `(0, True)→"8B"`, `(8, False)→"1A"`. Falls back to `"1A"` on miss.
- **Output**: Camelot Wheel code string (e.g. `"8B"`, `"5A"`)

### Energy score (`extract.py:57-60`)
- **Input**: 120 s slice
- **Method**: `energy = rms * 1000 + spectral_centroid / 10_000` — composite; roughly 0–10+ range (unbounded)
- **NOT** a 0–100 scale (the old CLAUDE.md was wrong)
- **Access**: stored in DB, never returned to artist/user (BL-37A); used by mood recommendation engine (BL-36B)

### Duration (`extract.py:37-38`)
- **Input**: full audio (no 120 s cap)
- **Method**: `librosa.get_duration(y=y_full, sr=sr)` — frame-accurate
- **Output**: `float` seconds, rounded to 2 decimals

---

## Data Formats

| Field | Type | Notes |
|-------|------|-------|
| Input `audioUrl` | `str` (presigned HTTPS) | MinIO presigned URL, ≥15 min TTL required |
| Audio load | `sr=None` mono | Preserves native sample rate (NOT forced 22050 Hz) |
| Analysis window | First 120 s | `y_full[:int(120*sr)]` — avoids memory OOM on long files |
| `bpm` | `float` | e.g. `128.0` |
| `camelotKey` | `str` | `"NNL"` format e.g. `"8B"` / `"5A"` |
| `energy` | `float` | 4 decimal places; unbounded but typically 0.5–8 |
| `duration` | `float` | Seconds, 2 decimal places |

---

## Key Files

| File | Role |
|------|------|
| `extract.py` | All DSP: download, load, BPM, key, energy, duration |
| `extract.py:20-27` | `CAMELOT` dict — single source of truth for key mapping |
| `extract.py:30` | `extract_audio_features(audio_url)` — main entry point |
| `extract.py:37-41` | Full-load for duration + 120s slice strategy |
| `extract.py:53` | Major/minor heuristic (relative minor = +9 semitones) |
| `main.py` | FastAPI app — two endpoints, Pydantic models |
| `main.py:12-20` | `ExtractRequest` / `ExtractResponse` schemas |
| `main.py:28-34` | `/extract` POST — wraps all exceptions as HTTP 422 |
| `requirements.txt` | Pinned deps — must stay in sync with Dockerfile |
| `Dockerfile` | port **5000** (not 8000 — NestJS `DSP_URL` must match) |

---

## Configuration & Parameters

All tuning lives in `extract.py` as inline constants/magic numbers:

| Parameter | Location | Current Value | Effect |
|-----------|----------|---------------|--------|
| Analysis window | `extract.py:41` | `120 * sr` seconds | Trade-off accuracy vs CPU |
| HTTP download timeout | `extract.py:32` | `60` s | Raise if MinIO is slow |
| Energy RMS weight | `extract.py:60` | `× 1000` | Relative loudness contribution |
| Energy centroid weight | `extract.py:60` | `÷ 10_000` | Relative brightness contribution |
| CAMELOT fallback | `extract.py:54` | `"1A"` | Returned when dict miss (shouldn't happen) |

No external config file — all params are hardcoded.

---

## Dependencies & Hardware

| Package | Why |
|---------|-----|
| `librosa 0.10.2` | BPM, chroma, RMS, spectral centroid, duration |
| `soundfile 0.12` | Audio I/O backend for librosa (WAV/FLAC/OGG) |
| `ffmpeg` (system) | Decodes MP3/AAC/M4A before soundfile |
| `libsndfile1` (system) | Required by soundfile at runtime |
| `requests 2.32` | HTTP download of presigned URL |
| `numpy 1.26` | Array ops on chroma/rms/centroid |

**Hardware**: CPU-only. No GPU needed. A typical 3-min MP3 takes ~1–3 s on a single core. Memory: ~100 MB peak for a 5-min 44.1 kHz file.

---

## Testing & Validation

No test suite currently. Manual validation steps:
1. Start service: `uvicorn main:app --port 5000 --reload`
2. Upload a song via NestJS, get a presigned URL, call `POST /extract` with `{"audioUrl":"<url>"}`
3. Verify BPM against known track (e.g. 128 BPM house track ±2 BPM tolerance)
4. Verify Camelot key against manual key detection tool (e.g. Mixed In Key)
5. `GET /health` → `{"status": "ok"}` is the Docker health check

---

## Common Commands

```bash
# Run locally (from apps/dsp/)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload

# Build & run Docker image
docker build -t my-music-dsp .
docker run -p 5000:5000 my-music-dsp

# Quick smoke test
curl http://localhost:5000/health
curl -X POST http://localhost:5000/extract \
  -H "Content-Type: application/json" \
  -d '{"audioUrl":"<presigned-url>"}'
```

---

## Known Gotchas

1. **Port mismatch**: Dockerfile exposes/runs on **5000**, not 8000. The existing CLAUDE.md said 8000 — that was wrong. Ensure `DSP_URL=http://dsp:5000` in NestJS `.env`.
2. **`sr=None` not 22050**: Audio is loaded at native sample rate. The old CLAUDE.md forced 22050 Hz — the actual code does not. Beat tracking accuracy depends on the native sr being reasonable (8k–96k).
3. **librosa 0.10+ `beat_track` return**: Returns a scalar in some builds, 1-D array in others. `float(tempo)` handles both; do not use `np.atleast_1d(tempo)[0]` (that was the old workaround — current code uses plain `float()`).
4. **Energy is NOT 0–100**: The formula produces an unbounded float (~0.5–8 typical). The old CLAUDE.md claimed `min(100.0, ...)` — that formula no longer exists.
5. **Major/minor heuristic**: Uses chroma relative-minor shift (+9 semitones), NOT tonnetz. Tonnetz approach shown in old CLAUDE.md was replaced.
6. **120 s slice only for BPM/key**: Duration uses the full waveform. Don't pass `y` (sliced) to `get_duration` — use `y_full`.
7. **Memory spike on long files**: A 10-min 320 kbps MP3 decoded to float32 can reach 500 MB. Consider adding a max-duration guard if very long files are expected.
8. **Presigned URL TTL**: NestJS worker generates a 15-min presigned URL. Total pipeline budget: 60 s download + analysis. Keep buffer; do not reduce below 5 min TTL.

---

## Reference Docs

Read this file first. Only open a doc when it answers something this CLAUDE.md can't.

| Doc | Read when… |
|-----|-----------|
| `../../docs/10_implementation_plan.md` | You're implementing a change to DSP — read **only the `### DSP` sub-section** of the relevant phase |
| `../../docs/03_tech_stack.md` | You need to verify the approved library versions or understand why a tech choice was made |
| `../../docs/09_recommendation_engine.md` | You need to understand how `bpm`, `camelotKey`, `energy` fields are consumed by the recommendation engine |
| `../../docs/08_ai_architecture.md` | You need to understand the full AI subsystem context (DSP is Subsystem 1) |
| `../../CLAUDE.md` | You need project-level context: env vars, BullMQ queue names, MinIO bucket names |

**Rule**: open one doc, extract what you need, close it. The `extract.py` implementation is fully described in this file — read the doc only when you hit a gap.
