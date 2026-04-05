FROM python:3.11-slim

WORKDIR /app

# libsndfile1 → soundfile (audio I/O backend for librosa)
# ffmpeg       → decode MP3 / AAC / other formats
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
