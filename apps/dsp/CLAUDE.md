# apps/dsp — Python DSP Sidecar CLAUDE.md

FastAPI + librosa audio feature extraction sidecar. Port 8000.

Read `../../CLAUDE.md` first for project-level context.

---

## What This Service Does

Single responsibility: **receive a presigned MinIO audio URL → return BPM, Camelot Key, Energy**.

Called exclusively by the NestJS `AudioExtractionWorker` after song upload. Never called by the frontend directly.

---

## File Structure

```
apps/dsp/
  main.py           — FastAPI app, endpoints
  extract.py        — Core librosa extraction logic
  requirements.txt  — Python dependencies
  Dockerfile        — python:3.11-slim image
```

---

## Endpoints

### `GET /health`
```
Response: 200 { "status": "ok" }
Purpose: Docker health check, NestJS startup check
```

### `POST /extract`
```
Request:  { "audioUrl": "<presigned MinIO URL>" }
Response: { "bpm": 128.0, "camelotKey": "8B", "energy": 72.4 }
Errors:   422 { "detail": "<reason>" }  — NestJS treats as soft failure (leaves bpm=null)
Timeout:  caller sets 120s max; internal requests.get timeout=60s
```

---

## Implementation (`extract.py`)

### CAMELOT_MAP

```python
# Maps pitch class (0=C, 1=C#, ..., 11=B) to Camelot Wheel notation
CAMELOT_MAJOR = {
    0: "8B",  1: "3B",  2: "10B", 3: "5B",
    4: "12B", 5: "7B",  6: "2B",  7: "9B",
    8: "4B",  9: "11B", 10: "6B", 11: "1B",
}
CAMELOT_MINOR = {k: v.replace("B", "A") for k, v in CAMELOT_MAJOR.items()}
```

### Full extract() function

```python
import io
import requests
import librosa
import numpy as np

def extract(audio_url: str) -> dict:
    # 1. Download audio from presigned MinIO URL
    r = requests.get(audio_url, timeout=60)
    r.raise_for_status()

    # 2. Load into librosa (mono, 22050 Hz, max 300s to avoid memory OOM)
    y, sr = librosa.load(io.BytesIO(r.content), sr=22050, mono=True, duration=300)

    # 3. BPM — beat_track returns array in newer librosa; use atleast_1d
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = round(float(np.atleast_1d(tempo)[0]), 1)

    # 4. Camelot Key
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    pitch_class = int(chroma.mean(axis=1).argmax())
    y_harm, _ = librosa.effects.hpss(y)           # separate harmonic component
    tonnetz = librosa.feature.tonnetz(y=y_harm, sr=sr)
    is_minor = float(tonnetz[1].mean()) < 0        # negative 5th axis = minor tendency
    camelot_key = CAMELOT_MINOR[pitch_class] if is_minor else CAMELOT_MAJOR[pitch_class]

    # 5. Energy (0–100 scale)
    rms = float(librosa.feature.rms(y=y).mean())
    centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    energy = round(min(100.0, (rms * 200) + (centroid / 200)), 1)

    return {"bpm": bpm, "camelotKey": camelot_key, "energy": energy}
```

### main.py

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from extract import extract

app = FastAPI(title="MyMusic DSP Sidecar")

class ExtractRequest(BaseModel):
    audioUrl: str

class ExtractResponse(BaseModel):
    bpm: Optional[float]
    camelotKey: Optional[str]
    energy: Optional[float]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract", response_model=ExtractResponse)
def extract_endpoint(body: ExtractRequest):
    try:
        return extract(body.audioUrl)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
```

---

## Requirements

```
# requirements.txt
fastapi==0.111.0
uvicorn==0.29.0
librosa==0.10.1
requests==2.31.0
soundfile==0.12.1
numpy==1.26.4
pydantic==2.7.0
```

---

## Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
# Install system audio libs needed by soundfile/librosa
RUN apt-get update && apt-get install -y libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Integration with NestJS

### How AudioExtractionWorker calls DSP

```ts
// apps/api/src/modules/queue/workers/audio-extraction.worker.ts
@Processor(QUEUE_NAMES.AUDIO)
export class AudioExtractionWorker {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Song) private readonly songRepo: Repository<Song>,
    private readonly storageService: StorageService,
  ) {}

  @Process('extract-metadata')
  async handle(job: Job<{ songId: string }>) {
    const song = await this.songRepo.findOneOrFail({ where: { id: job.data.songId } });
    const audioUrl = await this.storageService.presignedGetObject('audio', song.fileKey, 900); // 15 min

    try {
      const result = await firstValueFrom(
        this.httpService.post<{ bpm: number; camelotKey: string; energy: number }>(
          `${process.env.DSP_URL}/extract`,
          { audioUrl },
          { timeout: 120_000 }
        )
      );
      await this.songRepo.update(song.id, {
        bpm: result.data.bpm,
        camelotKey: result.data.camelotKey,
        energy: result.data.energy,  // stored but NEVER exposed in artist API responses
      });
      // Update job status for polling
      await job.updateProgress(100);
    } catch (err) {
      // 422 or timeout → soft failure: leave bpm/camelotKey null
      // Song still usable; artist can enter values manually
      this.logger.warn(`DSP extraction failed for song ${song.id}: ${err.message}`);
    }
  }
}
```

### Extraction Status Polling (client-side)

```ts
// GET /songs/upload/:jobId/status
// Returns: { status: 'pending'|'done'|'failed', bpm: number|null, camelotKey: string|null }
// Client polls every 3 seconds until status !== 'pending'
```

---

## Energy Field — Access Rules

| Role | Can see energy? |
|------|----------------|
| Artist | ❌ Never (BL-37A) |
| Admin | ✅ Yes (admin APIs) |
| User | ❌ Never |
| DSP next-song algorithm | ✅ Used internally |

`energy` is stored in the DB but must be excluded from all `GET /songs/:id` and `GET /songs` response DTOs when the caller is ARTIST or USER.

---

## Camelot Wheel Reference

```
      1A  2A  3A  4A  5A  6A  7A  8A  9A  10A  11A  12A
key:  Am  Em  Bm  F#m C#m G#m D#m A#m Fm  Cm   Gm   Dm

      1B  2B  3B  4B  5B  6B  7B  8B  9B  10B  11B  12B
key:  C   G   D   A   E   B   F#  Ab  Eb  Bb   F    Db
```

Adjacent keys (distance 0.5): same number different letter (e.g. 8B ↔ 8A), or ±1 same letter (e.g. 8B ↔ 7B, 8B ↔ 9B).

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `soundfile.LibsndfileError` | Missing `libsndfile1` system lib | Add `apt-get install libsndfile1` to Dockerfile |
| `librosa.util.exceptions.ParameterError` | Audio too short | Wrap in try/except, return 422 |
| `tempo` is array in librosa 0.10+ | API change | Use `np.atleast_1d(tempo)[0]` |
| `requests.exceptions.Timeout` | MinIO presigned URL expired | Presigned URLs must be ≥15 min TTL; worker generates fresh URL per job |
| 422 from DSP | Unreadable audio | NestJS worker logs warning, leaves `bpm=null`; artist can enter manually |
