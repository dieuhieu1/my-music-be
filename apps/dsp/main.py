from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from extract import extract_audio_features

app = FastAPI(
    title="My Music — DSP Sidecar",
    description="Audio feature extraction: BPM, Camelot Key, Energy (hidden)",
    version="1.0.0",
)


class ExtractRequest(BaseModel):
    audioUrl: str  # Presigned MinIO URL


class ExtractResponse(BaseModel):
    bpm: float
    camelotKey: str
    energy: float  # Hidden from artist — stored in DB only


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractResponse)
def extract(body: ExtractRequest):
    try:
        result = extract_audio_features(body.audioUrl)
        return result
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
