"""
Audio feature extraction using librosa.
Called by the NestJS audio-extraction BullMQ worker (BL-37A).

Contract: extract_audio_features(audioUrl: str) -> { bpm, camelotKey, energy, duration }

- bpm        → tempo in BPM (artist-editable, pre-filled in upload form)
- camelotKey → Camelot Wheel notation e.g. "8B", "5A" (artist-editable)
- energy     → composite energy score — stored to DB, NEVER shown to artist
               (used internally by the mood recommendation engine BL-36B)
- duration   → total audio duration in seconds (stored on Song; not exposed directly)
"""

import io
import requests
import librosa
import numpy as np

# Camelot Wheel: (chroma_key_index, is_major) → camelot code
CAMELOT: dict[tuple[int, bool], str] = {
    (0,  True): "8B",  (1,  True): "3B",  (2,  True): "10B", (3,  True): "5B",
    (4,  True): "12B", (5,  True): "7B",  (6,  True): "2B",  (7,  True): "9B",
    (8,  True): "4B",  (9,  True): "11B", (10, True): "6B",  (11, True): "1B",
    (0,  False): "5A", (1,  False): "12A", (2,  False): "7A", (3,  False): "2A",
    (4,  False): "9A", (5,  False): "4A",  (6,  False): "11A",(7,  False): "6A",
    (8,  False): "1A", (9,  False): "8A",  (10, False): "3A", (11, False): "10A",
}


def extract_audio_features(audio_url: str) -> dict:
    # Stream audio from the presigned MinIO URL — no MinIO SDK needed
    response = requests.get(audio_url, stream=True, timeout=60)
    response.raise_for_status()
    audio_bytes = io.BytesIO(response.content)

    # Load the full file to get accurate duration; cap BPM/key analysis at 120s
    y_full, sr = librosa.load(audio_bytes, sr=None, mono=True)
    duration = round(float(librosa.get_duration(y=y_full, sr=sr)), 2)

    # Slice to first 120s for BPM + key (much faster, still accurate)
    y = y_full[: int(120 * sr)]

    # ── BPM ──────────────────────────────────────────────────────────────
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.round(float(tempo), 1))

    # ── Camelot Key ──────────────────────────────────────────────────────
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)  # shape (12,)
    key_idx = int(np.argmax(chroma_mean))

    # Heuristic: compare key vs its relative minor (shifted by 9 semitones)
    is_major = float(chroma_mean[key_idx]) > float(chroma_mean[(key_idx + 9) % 12])
    camelot_key = CAMELOT.get((key_idx, is_major), "1A")

    # ── Energy (hidden) ──────────────────────────────────────────────────
    rms = float(np.mean(librosa.feature.rms(y=y)))
    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    # Composite score: scaled to a roughly 0–10 range
    energy = round(rms * 1000 + spectral_centroid / 10_000, 4)

    return {"bpm": bpm, "camelotKey": camelot_key, "energy": energy, "duration": duration}
