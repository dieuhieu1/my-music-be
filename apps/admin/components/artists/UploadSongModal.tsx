'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X, Upload, Music2, AlertCircle, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import apiClient from '@/lib/api/axios';
import { useToast } from '@/components/ui/toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: { id: string; stageName: string };
  onSuccess: () => void;
}

export default function UploadSongModal({ open, onOpenChange, artist, onSuccess }: Props) {
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [dropAt, setDropAt] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDragging, setAudioDragging] = useState(false);
  const [coverDragging, setCoverDragging] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: genres, isLoading: genresLoading } = useQuery({
    queryKey: ['genres'],
    queryFn: () => adminApi.getGenres(),
    select: (r) => r.data,
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  const reset = () => {
    setTitle('');
    setAudioFile(null);
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverArtFile(null);
    setCoverPreviewUrl(null);
    setSelectedGenreIds([]);
    setDropAt('');
    setScheduleEnabled(false);
    setProgress(0);
    setError(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && !uploading) { reset(); onOpenChange(false); }
    else if (o) onOpenChange(true);
  };

  const handleAudioFile = (file: File) => {
    if (file.size > 200 * 1024 * 1024) {
      setError('Audio file must be under 200 MB');
      return;
    }
    setError(null);
    setAudioFile(file);
  };

  const handleCoverFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Cover art must be under 5 MB');
      return;
    }
    setError(null);
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setCoverArtFile(file);
  };

  const removeCoverArt = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl(null);
    setCoverArtFile(null);
  };

  const toggleGenre = (id: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const handleUpload = async () => {
    if (!audioFile || !title.trim() || selectedGenreIds.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('title', title.trim());
    if (artist.id) formData.append('artistProfileId', artist.id);
    selectedGenreIds.forEach((id) => formData.append('genreIds[]', id));
    formData.append('audio', audioFile);
    if (coverArtFile) formData.append('coverArt', coverArtFile);
    if (scheduleEnabled && dropAt) formData.append('dropAt', dropAt);

    try {
      await apiClient.post('/admin/songs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast('Song uploaded successfully', 'success');
      onSuccess();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const minDropAt = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
  const maxDropAt = new Date(Date.now() + 90 * 24 * 3_600_000).toISOString().slice(0, 16);
  const canSubmit = !!(title.trim() && audioFile && selectedGenreIds.length > 0 && !uploading);

  const formatBytes = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
        />
        <RadixDialog.Content
          className="anim-fade-up"
          style={{
            position: 'fixed', left: '50%', top: '50%', zIndex: 51,
            transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 520,
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 12, outline: 'none',
            display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px 16px', flexShrink: 0,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <RadixDialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Upload Song
              </RadixDialog.Title>
              <RadixDialog.Description style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
                for {artist.stageName}
              </RadixDialog.Description>
            </div>
            <RadixDialog.Close
              disabled={uploading}
              style={{
                background: 'none', border: 'none', color: 'var(--text-faint)',
                cursor: uploading ? 'not-allowed' : 'pointer', padding: 4,
                borderRadius: 4, transition: 'color 150ms', flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
            >
              <X size={15} />
            </RadixDialog.Close>
          </div>

          {/* Body */}
          <div style={{
            padding: 24, overflowY: 'auto', flex: 1,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>

            {/* Song Title */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
                Song Title <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Enter song title…"
                style={{
                  width: '100%', height: 40, padding: '0 12px', fontSize: 14,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Audio File */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
                Audio File <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div
                onClick={() => !uploading && audioInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setAudioDragging(true); }}
                onDragLeave={() => setAudioDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setAudioDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleAudioFile(file);
                }}
                style={{
                  border: `2px dashed ${audioDragging ? 'var(--accent)' : 'var(--border-2)'}`,
                  borderRadius: 'var(--radius)', padding: '28px 20px', textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: audioDragging ? 'var(--accent-light)' : 'transparent',
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => {
                  if (!audioFile && !uploading && !audioDragging) {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--accent-light)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!audioDragging) {
                    e.currentTarget.style.borderColor = audioFile ? 'var(--border-2)' : 'var(--border-2)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {audioFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Music2 size={20} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{audioFile.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatBytes(audioFile.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                      style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                    >
                      × Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Upload size={32} style={{ color: 'var(--text-faint)' }} />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Drop audio file here</span>
                    <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>or click to browse</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Max 200 MB · MP3, WAV, FLAC</span>
                  </div>
                )}
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAudioFile(f);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Cover Art */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
                Cover Art{' '}
                <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  onClick={() => !uploading && coverInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setCoverDragging(true); }}
                  onDragLeave={() => setCoverDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCoverDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleCoverFile(file);
                  }}
                  style={{
                    flex: 1, minHeight: 90,
                    border: `2px dashed ${coverDragging ? 'var(--accent)' : 'var(--border-2)'}`,
                    borderRadius: 'var(--radius)', padding: '16px 12px', textAlign: 'center',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    background: coverDragging ? 'var(--accent-light)' : 'transparent',
                    transition: 'all 150ms',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    if (!coverDragging && !uploading) {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'var(--accent-light)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!coverDragging) {
                      e.currentTarget.style.borderColor = 'var(--border-2)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Drop image or click</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Max 5 MB · JPG, PNG, WebP</span>
                </div>
                {coverPreviewUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <img
                      src={coverPreviewUrl}
                      alt="Cover preview"
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                    />
                    <button
                      onClick={removeCoverArt}
                      style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      × Remove
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverFile(f);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Genres */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
                Genres <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              {genresLoading ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse"
                      style={{
                        height: 28, width: 60 + (i % 3) * 20,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface-2)',
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {genres?.map((g) => {
                    const selected = selectedGenreIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGenre(g.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 'var(--radius-full)',
                          fontSize: 12, fontWeight: selected ? 600 : 500,
                          cursor: 'pointer', transition: 'all 150ms', border: '1px solid',
                          background: selected ? 'var(--accent-light)' : 'var(--surface-2)',
                          borderColor: selected ? 'var(--accent)' : 'var(--border)',
                          color: selected ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Schedule Toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  role="switch"
                  aria-checked={scheduleEnabled}
                  onClick={() => setScheduleEnabled((v) => !v)}
                  style={{
                    width: 36, height: 20, borderRadius: 'var(--radius-full)',
                    background: scheduleEnabled ? 'var(--accent)' : 'var(--border)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 200ms', flexShrink: 0, padding: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: scheduleEnabled ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'white', transition: 'left 200ms',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    display: 'block',
                  }} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Schedule release</span>
              </div>
              {scheduleEnabled && (
                <div style={{ marginTop: 10 }}>
                  <input
                    type="datetime-local"
                    value={dropAt}
                    onChange={(e) => setDropAt(e.target.value)}
                    min={minDropAt}
                    max={maxDropAt}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      padding: '8px 12px', fontSize: 14, color: 'var(--text)',
                      background: 'var(--surface)', outline: 'none',
                      width: '100%', boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '6px 0 0' }}>
                    Song will be scheduled. You can approve it first — it stays locked until drop time.
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {uploading && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', margin: '0 0 6px' }}>
                  Uploading... {progress}%
                </p>
                <div style={{
                  height: 6, background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-full)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: 'var(--accent)', borderRadius: 'var(--radius-full)',
                    transition: 'width 100ms linear',
                  }} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--danger-light)', border: '1px solid #FCA5A5',
                borderRadius: 'var(--radius)', padding: '10px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px', flexShrink: 0,
            borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            <button
              onClick={() => handleOpenChange(false)}
              disabled={uploading}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.5 : 1, transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!canSubmit}
              style={{
                padding: '8px 20px', background: 'var(--accent)', color: 'white',
                borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: !canSubmit ? 'not-allowed' : 'pointer',
                opacity: !canSubmit ? 0.5 : 1, transition: 'all 150ms',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.filter = 'brightness(0.9)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Upload
                </>
              )}
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
