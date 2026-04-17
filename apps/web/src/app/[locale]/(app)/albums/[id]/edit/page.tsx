'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ImageIcon, Calendar, CheckCircle2, Trash2,
  RefreshCw, Music2, Pencil, Clock, XCircle, AlertCircle, Disc,
} from 'lucide-react';
import { albumsApi, type Album, type AlbumTrack } from '@/lib/api/albums.api';

// ── Status badge (mirrors songs page) ────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    PENDING:           { color: 'rgba(232,184,75,0.9)',  bg: 'rgba(232,184,75,0.08)',  icon: <Clock size={10} />,        label: 'Pending' },
    APPROVED:          { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)', icon: <CheckCircle2 size={10} />, label: 'Approved' },
    LIVE:              { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)', icon: <CheckCircle2 size={10} />, label: 'Live' },
    SCHEDULED:         { color: 'rgba(130,180,255,0.9)', bg: 'rgba(130,180,255,0.08)', icon: <Clock size={10} />,        label: 'Scheduled' },
    REJECTED:          { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)',   icon: <XCircle size={10} />,      label: 'Rejected' },
    REUPLOAD_REQUIRED: { color: 'rgba(240,140,60,0.9)',  bg: 'rgba(240,140,60,0.08)',  icon: <RefreshCw size={10} />,    label: 'Reupload' },
    TAKEN_DOWN:        { color: 'rgba(180,80,80,0.9)',   bg: 'rgba(180,80,80,0.08)',   icon: <AlertCircle size={10} />,  label: 'Taken Down' },
  };
  const s = map[status] ?? { color: 'var(--muted-text)', bg: 'rgba(90,85,80,0.1)', icon: null, label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: '0.62rem', letterSpacing: '0.06em',
      textTransform: 'uppercase', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
      color: s.color, background: s.bg,
    }}>
      {s.icon}{s.label}
    </span>
  );
}

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
            <ImageIcon size={24} color="rgba(232,184,75,0.3)" style={{ display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.65rem', color: 'var(--muted-text)', letterSpacing: '0.05em' }}>Cover Art</p>
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

// ── Track row ─────────────────────────────────────────────────────────────────
function TrackRow({ track, locale }: { track: AlbumTrack; locale: string }) {
  const [hov, setHov] = useState(false);

  const fmtDuration = (s: number | null) => {
    if (!s) return null;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
        background: hov ? 'rgba(255,255,255,0.025)' : 'transparent',
        borderBottom: '1px solid rgba(42,37,32,0.5)',
        transition: 'background 0.15s',
      }}
    >
      {/* Position */}
      <div style={{
        width: 24, flexShrink: 0, textAlign: 'center',
        fontFamily: 'var(--font-display)', fontSize: '0.78rem', color: 'var(--muted-text)',
      }}>
        {track.position}
      </div>

      {/* Thumb */}
      <div style={{
        width: 38, height: 38, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Music2 size={16} color="rgba(232,184,75,0.25)" />
      </div>

      {/* Title + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title ?? 'Untitled'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <StatusBadge status={track.status} />
        </div>
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {track.bpm !== null && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', color: 'var(--gold)' }}>{track.bpm}</p>
            <p style={{ fontSize: '0.58rem', color: 'var(--muted-text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>BPM</p>
          </div>
        )}
        {track.camelotKey && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', color: 'var(--ivory)' }}>{track.camelotKey}</p>
            <p style={{ fontSize: '0.58rem', color: 'var(--muted-text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Key</p>
          </div>
        )}
        {track.duration !== null && (
          <p style={{ color: 'var(--muted-text)', fontSize: '0.75rem', fontFamily: 'var(--font-display)', minWidth: 36, textAlign: 'right' }}>
            {fmtDuration(track.duration)}
          </p>
        )}
      </div>

      {/* Edit action */}
      <div style={{ opacity: hov ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <Link
          href={`/${locale}/artist/songs/${track.songId}/edit`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 4,
            background: 'rgba(232,184,75,0.07)', border: '1px solid rgba(232,184,75,0.18)',
            color: 'var(--gold)', fontSize: '0.7rem', textDecoration: 'none', letterSpacing: '0.04em',
          }}
        >
          <Pencil size={11} /> Edit
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EditAlbumPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [album, setAlbum]           = useState<Album | null>(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);

  // Form state
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [releasedAt, setReleasedAt] = useState('');
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Save state
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    albumsApi.getAlbum(id)
      .then(res => {
        const a: Album = (res.data as any).data ?? res.data;
        setAlbum(a);
        setTitle(a.title ?? '');
        setDescription(a.description ?? '');
        setReleasedAt(a.releasedAt ? a.releasedAt.slice(0, 10) : '');
        setCoverPreview(a.coverArtUrl ?? null);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCoverChange = (f: File | null) => {
    setCoverFile(f);
    setCoverPreview(f ? URL.createObjectURL(f) : (album?.coverArtUrl ?? null));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      if (releasedAt) fd.append('releasedAt', new Date(releasedAt).toISOString());
      if (coverFile) fd.append('coverArt', coverFile);
      const res = await albumsApi.updateAlbum(id, fd);
      const updated: Album = (res.data as any).data ?? res.data;
      setAlbum(prev => prev ? { ...prev, ...updated } : updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await albumsApi.deleteAlbum(id);
      router.push(`/${locale}/artist/songs`);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="vinyl-spin" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
          border: '2px solid rgba(232,184,75,0.2)',
        }} />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !album) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--ivory)', marginBottom: 12 }}>
          Album not found
        </p>
        <Link href={`/${locale}/artist/songs`} style={{ color: 'var(--gold)', fontSize: '0.8rem', textDecoration: 'none' }}>
          ← Back to studio
        </Link>
      </div>
    );
  }

  const tracks = album.tracks ?? [];

  // ── Page ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

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
      <div className="anim-fade-up anim-fade-up-2" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Edit Album
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,3.5vw,2.4rem)',
            fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
          }}>
            {album.title}
          </h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 28, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--gold)', fontWeight: 400 }}>
              {album.totalTracks}
            </p>
            <p style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tracks</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--ivory)', fontWeight: 400 }}>
              {album.totalHours > 0 ? album.totalHours.toFixed(2) : '—'}
            </p>
            <p style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Hours</p>
          </div>
        </div>
      </div>

      {/* ── Edit form ── */}
      <form onSubmit={handleSave}>
        <div className="anim-fade-up anim-fade-up-3" style={{
          background: '#111', border: '1px solid rgba(232,184,75,0.1)',
          borderRadius: 10, padding: 28, display: 'flex', gap: 28, flexWrap: 'wrap',
          marginBottom: 24,
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

        {/* Save error */}
        {saveError && (
          <p className="anim-fade-up" style={{
            color: '#e07070', fontSize: '0.78rem', marginBottom: 12,
            padding: '8px 14px', background: 'rgba(220,80,80,0.07)',
            borderRadius: 6, border: '1px solid rgba(220,80,80,0.2)',
          }}>
            {saveError}
          </p>
        )}

        {/* Save actions */}
        <div className="anim-fade-up anim-fade-up-4" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className={saved ? '' : 'btn-gold'}
            style={{
              padding: '10px 24px', borderRadius: 6, fontWeight: 600, fontSize: '0.82rem',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving || !title.trim() ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none',
              color: saved ? 'rgba(120,200,120,0.9)' : '#0d0d0d',
              background: saved ? 'rgba(120,200,120,0.1)' : undefined,
              transition: 'background 0.3s, color 0.3s',
            }}
          >
            {saving
              ? <span className="vinyl-spin" style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(13,13,13,0.25)', borderTopColor: '#0d0d0d', display: 'inline-block' }} />
              : saved
              ? <CheckCircle2 size={14} />
              : <Disc size={14} />
            }
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* ── Track listing ── */}
      <div className="anim-fade-up anim-fade-up-5" style={{ marginBottom: 40 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, flexWrap: 'wrap', gap: 8,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 400,
            color: 'var(--ivory)', letterSpacing: '0.01em',
          }}>
            Tracks
          </h2>
          <Link
            href={`/${locale}/artist/upload`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6, fontSize: '0.72rem',
              background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.15)',
              color: 'var(--gold)', textDecoration: 'none', letterSpacing: '0.04em',
              transition: 'background 0.18s, border-color 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.06)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.15)'; }}
          >
            + Add Track
          </Link>
        </div>

        {tracks.length === 0
          ? (
            <div style={{
              padding: '40px 24px', textAlign: 'center',
              border: '1px dashed rgba(232,184,75,0.12)', borderRadius: 8,
            }}>
              <Music2 size={32} color="rgba(232,184,75,0.15)" style={{ display: 'block', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>No tracks yet.</p>
              <p style={{ color: 'rgba(90,85,80,0.6)', fontSize: '0.75rem', marginTop: 4 }}>
                Upload a song and assign it to this album.
              </p>
            </div>
          )
          : (
            <div style={{ background: '#111', border: '1px solid rgba(42,37,32,0.6)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '9px 20px',
                background: '#0d0d0d', borderBottom: '1px solid rgba(42,37,32,0.8)',
              }}>
                <div style={{ width: 24 }} />
                <div style={{ width: 38 }} />
                <div style={{ flex: 1, fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(90,85,80,0.6)' }}>Title</div>
                <div style={{ fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(90,85,80,0.6)', width: 140, textAlign: 'right' }}>BPM / Key / Duration</div>
                <div style={{ width: 60 }} />
              </div>
              {tracks.map((track, i) => (
                <div key={track.songId} className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}>
                  <TrackRow track={track} locale={locale} />
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* ── Danger zone ── */}
      <div className="anim-fade-up anim-fade-up-6" style={{
        padding: '20px 24px', borderRadius: 8,
        border: '1px solid rgba(180,80,80,0.15)', background: 'rgba(180,80,80,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ color: '#e07070', fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.04em', marginBottom: 4 }}>
              Delete Album
            </p>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.72rem' }}>
              The album is removed. Songs are kept in your library.
            </p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            onMouseLeave={() => setConfirmDelete(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
              background: confirmDelete ? 'rgba(201,76,76,0.15)' : 'transparent',
              border: `1px solid ${confirmDelete ? 'rgba(201,76,76,0.45)' : 'rgba(180,80,80,0.25)'}`,
              color: confirmDelete ? '#e07070' : 'rgba(180,80,80,0.7)',
              letterSpacing: '0.04em', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            {deleting
              ? <span className="animate-spin"><RefreshCw size={12} /></span>
              : <Trash2 size={12} />
            }
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm Delete' : 'Delete Album'}
          </button>
        </div>
      </div>
    </div>
  );
}
