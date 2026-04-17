'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Pencil, Trash2, Music2, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { songsApi, type Song } from '@/lib/api/songs.api';
import { SongStatus } from '@mymusic/types';

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    PENDING:           { color: 'rgba(232,184,75,0.9)',  bg: 'rgba(232,184,75,0.08)',  icon: <Clock size={11} />,        label: 'Pending' },
    APPROVED:          { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)', icon: <CheckCircle2 size={11} />, label: 'Approved' },
    LIVE:              { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)', icon: <CheckCircle2 size={11} />, label: 'Live' },
    SCHEDULED:         { color: 'rgba(130,180,255,0.9)', bg: 'rgba(130,180,255,0.08)', icon: <Clock size={11} />,        label: 'Scheduled' },
    REJECTED:          { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)',   icon: <XCircle size={11} />,      label: 'Rejected' },
    REUPLOAD_REQUIRED: { color: 'rgba(240,140,60,0.9)',  bg: 'rgba(240,140,60,0.08)',  icon: <RefreshCw size={11} />,    label: 'Reupload' },
    TAKEN_DOWN:        { color: 'rgba(180,80,80,0.9)',   bg: 'rgba(180,80,80,0.08)',   icon: <AlertCircle size={11} />,  label: 'Taken Down' },
  };
  const s = map[status] ?? { color: 'var(--muted-text)', bg: 'rgba(90,85,80,0.15)', icon: null, label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: '0.66rem', letterSpacing: '0.06em',
      textTransform: 'uppercase', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
      color: s.color, background: s.bg,
    }}>
      {s.icon}
      {s.label}
    </span>
  );
}

// ── Extraction indicator (shows when bpm is still null) ───────────────────────
function ExtractionPill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: '0.66rem',
      color: 'var(--muted-text)', background: 'rgba(90,85,80,0.1)',
      letterSpacing: '0.04em',
    }}>
      <span className="vinyl-spin" style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(232,184,75,0.4)', flexShrink: 0 }} />
      Analysing…
    </span>
  );
}

// ── Song row ──────────────────────────────────────────────────────────────────
function SongRow({ song, locale, onDelete }: { song: Song; locale: string; onDelete: (id: string) => void }) {
  const [hov, setHov] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await songsApi.deleteSong(song.id);
      onDelete(song.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const fmtDuration = (s: number | null) => {
    if (!s) return null;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setConfirmDelete(false); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderBottom: '1px solid rgba(42,37,32,0.5)',
        transition: 'background 0.15s',
      }}
    >
      {/* Cover art */}
      <div className={`anim-scale-reveal`} style={{
        width: 44, height: 44, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {song.coverArtUrl
          ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Music2 size={18} color="rgba(232,184,75,0.3)" />
        }
      </div>

      {/* Title + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.9rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {song.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
          <StatusBadge status={song.status} />
          {song.bpm === null && song.status === 'PENDING' && <ExtractionPill />}
        </div>
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
        {song.bpm !== null && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--gold)' }}>{song.bpm}</p>
            <p style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>BPM</p>
          </div>
        )}
        {song.camelotKey && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--ivory)' }}>{song.camelotKey}</p>
            <p style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Key</p>
          </div>
        )}
        {song.duration !== null && (
          <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem', fontFamily: 'var(--font-display)' }}>{fmtDuration(song.duration)}</p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, opacity: hov ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <Link href={`/${locale}/artist/songs/${song.id}/edit`} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 4,
          background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.2)',
          color: 'var(--gold)', fontSize: '0.72rem', textDecoration: 'none', letterSpacing: '0.04em',
        }}>
          <Pencil size={12} /> Edit
        </Link>
        <button onClick={handleDelete} disabled={deleting} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 4,
          background: confirmDelete ? 'rgba(201,76,76,0.15)' : 'transparent',
          border: `1px solid ${confirmDelete ? 'rgba(201,76,76,0.4)' : '#2a2520'}`,
          color: confirmDelete ? '#e07070' : 'var(--muted-text)',
          fontSize: '0.72rem', cursor: 'pointer', letterSpacing: '0.04em',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}>
          {deleting ? <span className="animate-spin"><RefreshCw size={12} /></span> : <Trash2 size={12} />}
          {confirmDelete ? 'Confirm' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MySongsPage() {
  const { locale } = useParams<{ locale: string }>();
  const [songs, setSongs]     = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    songsApi.getMySongs()
      .then((r) => { const d = (r.data as any).data ?? r.data; setSongs(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="vinyl-spin" style={{ width: 52, height: 52, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)', border: '2px solid rgba(232,184,75,0.2)' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Artist Studio</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em' }}>
            My Songs
          </h1>
          {songs.length > 0 && (
            <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--ivory)', fontSize: '1rem' }}>{songs.length}</span> &nbsp;track{songs.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link href={`/${locale}/artist/upload`} className="btn-gold" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
          borderRadius: 6, color: '#0d0d0d', fontWeight: 600, fontSize: '0.82rem',
          letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none',
        }}>
          <Upload size={14} /> Upload Song
        </Link>
      </div>

      {/* Empty state */}
      {songs.length === 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          padding: '64px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.12)', borderRadius: 10,
        }}>
          <div className="vinyl-spin" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px', background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)', border: '2px solid rgba(232,184,75,0.15)' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>No songs yet</p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginBottom: 24 }}>Upload your first track to get started.</p>
          <Link href={`/${locale}/artist/upload`} className="btn-gold" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px',
            borderRadius: 6, color: '#0d0d0d', fontWeight: 600, fontSize: '0.82rem',
            letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            <Upload size={14} /> Upload First Song
          </Link>
        </div>
      )}

      {/* Song list */}
      {songs.length > 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          background: '#111', border: '1px solid rgba(42,37,32,0.6)', borderRadius: 8, overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px',
            background: '#0d0d0d', borderBottom: '1px solid rgba(42,37,32,0.8)',
          }}>
            <div style={{ width: 44, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(90,85,80,0.7)' }}>Song</div>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(90,85,80,0.7)', width: 160, textAlign: 'right' }}>BPM / Key / Duration</div>
            <div style={{ width: 120 }} />
          </div>

          {songs.map((song, i) => (
            <div key={song.id} className={`anim-fade-up anim-fade-up-${Math.min(i + 3, 8)}`}>
              <SongRow song={song} locale={locale} onDelete={(id) => setSongs((prev) => prev.filter((s) => s.id !== id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
