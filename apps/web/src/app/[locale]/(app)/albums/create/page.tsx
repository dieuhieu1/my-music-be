'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Disc, ImageIcon, ChevronLeft, Calendar } from 'lucide-react';
import { albumsApi } from '@/lib/api/albums.api';

// ── Cover Art Picker ──────────────────────────────────────────────────────────
function CoverArtPicker({ preview, onChange }: { preview: string | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => ref.current?.click()}
      style={{
        width: 160, height: 160, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
        background: preview ? 'transparent' : 'rgba(232,184,75,0.04)',
        border: preview ? '1px solid rgba(232,184,75,0.15)' : '2px dashed rgba(232,184,75,0.2)',
        overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = preview ? 'rgba(232,184,75,0.15)' : 'rgba(232,184,75,0.2)')}
    >
      {preview
        ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <ImageIcon size={28} color="rgba(232,184,75,0.3)" style={{ display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', letterSpacing: '0.05em' }}>Cover Art</p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(90,85,80,0.5)', marginTop: 4 }}>Optional</p>
          </div>
        )
      }
      {preview && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
          opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'opacity 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >
          <p style={{ color: 'var(--ivory)', fontSize: '0.7rem', letterSpacing: '0.06em' }}>Change</p>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CreateAlbumPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [releasedAt, setReleasedAt] = useState('');
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleCoverChange = (f: File | null) => {
    setCoverFile(f);
    setCoverPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (description.trim()) fd.append('description', description.trim());
      if (releasedAt) fd.append('releasedAt', new Date(releasedAt).toISOString());
      if (coverFile) fd.append('coverArt', coverFile);
      const res = await albumsApi.createAlbum(fd);
      const album = (res.data as any).data ?? res.data;
      router.push(`/${locale}/albums/${album.id}/edit`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create album');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

      {/* Back nav */}
      <Link
        href={`/${locale}/artist/songs`}
        className="anim-fade-up anim-fade-up-1"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32,
          color: 'var(--muted-text)', fontSize: '0.75rem', letterSpacing: '0.05em',
          textDecoration: 'none', transition: 'color 0.18s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-text)')}
      >
        <ChevronLeft size={14} /> Artist Studio
      </Link>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-2" style={{ marginBottom: 36 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Artist Studio
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,4vw,2.6rem)',
          fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
        }}>
          New Album
        </h1>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem', marginTop: 6 }}>
          Organise your tracks into a cohesive release.
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit}>
        <div className="anim-fade-up anim-fade-up-3" style={{
          background: '#111', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 10,
          padding: 28, display: 'flex', gap: 28, flexWrap: 'wrap',
        }}>
          {/* Cover */}
          <CoverArtPicker preview={coverPreview} onChange={handleCoverChange} />

          {/* Fields */}
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>
                Album Title <span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Untitled Album"
                required
                style={{
                  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                  background: 'rgba(13,13,13,0.7)', border: '1px solid rgba(42,37,32,0.8)',
                  borderRadius: 6, color: 'var(--ivory)', fontSize: '0.9rem',
                  fontFamily: 'var(--font-body)', outline: 'none',
                  transition: 'border-color 0.18s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(232,184,75,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(42,37,32,0.8)')}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                  background: 'rgba(13,13,13,0.7)', border: '1px solid rgba(42,37,32,0.8)',
                  borderRadius: 6, color: 'var(--ivory)', fontSize: '0.82rem',
                  fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical',
                  transition: 'border-color 0.18s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(232,184,75,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(42,37,32,0.8)')}
              />
            </div>

            {/* Release date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>
                Release Date
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={14} color="var(--muted-text)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="date"
                  value={releasedAt}
                  onChange={e => setReleasedAt(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 34px', boxSizing: 'border-box',
                    background: 'rgba(13,13,13,0.7)', border: '1px solid rgba(42,37,32,0.8)',
                    borderRadius: 6, color: 'var(--ivory)', fontSize: '0.82rem',
                    fontFamily: 'var(--font-body)', outline: 'none', colorScheme: 'dark',
                    transition: 'border-color 0.18s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(232,184,75,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(42,37,32,0.8)')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="anim-fade-up" style={{
            color: '#e07070', fontSize: '0.78rem', marginTop: 12,
            padding: '8px 14px', background: 'rgba(220,80,80,0.07)',
            borderRadius: 6, border: '1px solid rgba(220,80,80,0.2)',
          }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="anim-fade-up anim-fade-up-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Link
            href={`/${locale}/artist/songs`}
            style={{
              padding: '10px 20px', borderRadius: 6, background: 'transparent',
              border: '1px solid #2a2520', color: 'var(--muted-text)', fontSize: '0.8rem',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              transition: 'border-color 0.18s, color 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(90,85,80,0.5)'; e.currentTarget.style.color = 'var(--ivory)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2520'; e.currentTarget.style.color = 'var(--muted-text)'; }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="btn-gold"
            style={{
              padding: '10px 24px', borderRadius: 6, fontWeight: 600, fontSize: '0.82rem',
              letterSpacing: '0.07em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving || !title.trim() ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0d0d0d',
              border: 'none',
            }}
          >
            {saving
              ? <span className="vinyl-spin" style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(13,13,13,0.25)', borderTopColor: '#0d0d0d', display: 'inline-block' }} />
              : <Disc size={14} />
            }
            {saving ? 'Creating…' : 'Create Album'}
          </button>
        </div>
      </form>
    </div>
  );
}
