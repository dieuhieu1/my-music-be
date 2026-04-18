'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Music2, CheckCircle2, XCircle, RefreshCw, Clock,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { Song } from '@/lib/api/songs.api';

// ── Inline action panel ───────────────────────────────────────────────────────
function ActionPanel({
  type,
  onSubmit,
  onCancel,
}: {
  type: 'reject' | 'reupload';
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const label   = type === 'reject' ? 'Rejection reason' : 'Reupload notes';
  const btnText = type === 'reject' ? 'Reject' : 'Request Reupload';
  const color   = type === 'reject' ? 'rgba(220,80,80,0.9)' : 'rgba(240,140,60,0.9)';
  const border  = type === 'reject' ? 'rgba(220,80,80,0.3)' : 'rgba(240,140,60,0.3)';
  const bg      = type === 'reject' ? 'rgba(220,80,80,0.08)' : 'rgba(240,140,60,0.08)';

  const handle = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await onSubmit(text.trim());
  };

  return (
    <div className="anim-fade-up" style={{
      marginTop: 12, padding: '14px 16px',
      background: bg, border: `1px solid ${border}`,
      borderRadius: 6,
    }}>
      <p style={{
        fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase',
        color, marginBottom: 8,
      }}>
        {label} <span style={{ color: 'rgba(201,76,76,0.6)' }}>*</span>
      </p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={type === 'reject' ? 'e.g. Audio quality too low…' : 'e.g. Please re-upload at 320kbps…'}
        style={{
          width: '100%', padding: '8px 10px', resize: 'vertical',
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(42,37,32,0.8)',
          borderRadius: 4, color: 'var(--ivory)', fontSize: '0.82rem',
          fontFamily: 'var(--font-body)', outline: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={handle}
          disabled={busy || !text.trim()}
          style={{
            padding: '7px 16px', borderRadius: 4, border: `1px solid ${border}`,
            background: bg, color, fontSize: '0.75rem', fontFamily: 'var(--font-body)',
            cursor: busy || !text.trim() ? 'not-allowed' : 'pointer',
            opacity: busy || !text.trim() ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
            letterSpacing: '0.05em',
          }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : null}
          {btnText}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '7px 14px', borderRadius: 4, border: '1px solid rgba(42,37,32,0.6)',
            background: 'transparent', color: 'var(--muted-text)',
            fontSize: '0.75rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Song approval card ────────────────────────────────────────────────────────
function SongCard({
  song,
  idx,
  onAction,
}: {
  song: Song;
  idx: number;
  onAction: (songId: string, action: 'approve' | 'reject' | 'reupload', text?: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel]       = useState<'reject' | 'reupload' | null>(null);
  const [busy, setBusy]         = useState(false);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const fmtDuration = (s: number | null) => {
    if (!s) return '—';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const handleApprove = async () => {
    setBusy(true);
    await onAction(song.id, 'approve');
  };

  const handlePanel = async (text: string) => {
    await onAction(song.id, panel!, text);
    setPanel(null);
  };

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        background: '#111', border: '1px solid rgba(42,37,32,0.6)',
        borderRadius: 8, overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.6)')}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
        {/* Cover art */}
        <div style={{
          width: 52, height: 52, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
          background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {song.coverArtUrl
            ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Music2 size={20} color="rgba(232,184,75,0.25)" />
          }
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: 'var(--ivory)', fontSize: '0.92rem', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {song.title}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3 }}>
            Uploaded {fmtDate(song.createdAt)}
            {song.bpm !== null && ` · ${song.bpm} BPM`}
            {song.camelotKey && ` · ${song.camelotKey}`}
            {` · ${fmtDuration(song.duration)}`}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Approve */}
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy || panel !== null}
            title="Approve"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 4,
              background: 'rgba(120,200,120,0.08)',
              border: '1px solid rgba(120,200,120,0.25)',
              color: 'rgba(120,200,120,0.9)', fontSize: '0.75rem',
              fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
              cursor: busy || panel !== null ? 'not-allowed' : 'pointer',
              opacity: busy || panel !== null ? 0.5 : 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { if (!busy && !panel) (e.currentTarget as HTMLElement).style.background = 'rgba(120,200,120,0.14)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(120,200,120,0.08)'; }}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Approve
          </button>

          {/* Reupload */}
          <button
            type="button"
            onClick={() => setPanel(panel === 'reupload' ? null : 'reupload')}
            disabled={busy}
            title="Request Reupload"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 4,
              background: panel === 'reupload' ? 'rgba(240,140,60,0.12)' : 'transparent',
              border: `1px solid ${panel === 'reupload' ? 'rgba(240,140,60,0.3)' : 'rgba(42,37,32,0.8)'}`,
              color: panel === 'reupload' ? 'rgba(240,140,60,0.9)' : 'var(--muted-text)',
              fontSize: '0.75rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            <RefreshCw size={13} />
            Reupload
          </button>

          {/* Reject */}
          <button
            type="button"
            onClick={() => setPanel(panel === 'reject' ? null : 'reject')}
            disabled={busy}
            title="Reject"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 4,
              background: panel === 'reject' ? 'rgba(220,80,80,0.1)' : 'transparent',
              border: `1px solid ${panel === 'reject' ? 'rgba(220,80,80,0.3)' : 'rgba(42,37,32,0.8)'}`,
              color: panel === 'reject' ? 'rgba(220,80,80,0.9)' : 'var(--muted-text)',
              fontSize: '0.75rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            <XCircle size={13} />
            Reject
          </button>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              padding: '7px 8px', borderRadius: 4, background: 'transparent',
              border: '1px solid rgba(42,37,32,0.5)', cursor: 'pointer',
              color: 'var(--muted-text)', transition: 'color 0.15s',
            }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded metadata */}
      {expanded && (
        <div className="anim-fade-up" style={{
          borderTop: '1px solid rgba(42,37,32,0.5)',
          padding: '14px 20px',
          display: 'flex', gap: 32, flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 4 }}>Song ID</p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(232,184,75,0.5)', fontFamily: 'monospace' }}>{song.id}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 4 }}>Artist ID</p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(232,184,75,0.5)', fontFamily: 'monospace' }}>{song.userId}</p>
          </div>
          {song.genreIds?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 6 }}>Genres</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {song.genreIds.map((gId) => (
                  <span key={gId} style={{
                    padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(232,184,75,0.07)', border: '1px solid rgba(232,184,75,0.15)',
                    fontSize: '0.66rem', color: 'var(--gold)', letterSpacing: '0.05em',
                  }}>{gId.slice(0, 8)}…</span>
                ))}
              </div>
            </div>
          )}
          {song.dropAt && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 4 }}>Drop Date</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--ivory)' }}>
                {new Date(song.dropAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inline action panel */}
      {panel && (
        <div style={{ padding: '0 20px 16px' }}>
          <ActionPanel
            type={panel}
            onSubmit={handlePanel}
            onCancel={() => setPanel(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminSongsPage() {
  const { locale } = useParams<{ locale: string }>();
  const [songs, setSongs]     = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    adminApi.getSongQueue()
      .then((r) => { const d = (r.data as any).data ?? r.data; setSongs(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (songId: string, action: 'approve' | 'reject' | 'reupload', text?: string) => {
    try {
      if (action === 'approve') {
        await adminApi.approveSong(songId);
        showToast('Song approved');
      } else if (action === 'reject') {
        await adminApi.rejectSong(songId, text!);
        showToast('Song rejected');
      } else {
        await adminApi.requestReupload(songId, text!);
        showToast('Reupload requested');
      }
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Action failed';
      showToast(Array.isArray(msg) ? msg.join(' · ') : msg, false);
    }
  };

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

  return (
    <div style={{ padding: '32px 32px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 60,
          padding: '11px 18px', borderRadius: 6,
          background: toast.ok ? 'rgba(120,200,120,0.12)' : 'rgba(220,80,80,0.12)',
          border: `1px solid ${toast.ok ? 'rgba(120,200,120,0.3)' : 'rgba(220,80,80,0.3)'}`,
          color: toast.ok ? 'rgba(120,200,120,0.95)' : 'rgba(220,80,80,0.95)',
          fontSize: '0.82rem', fontFamily: 'var(--font-body)',
          animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 36 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Admin Panel
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem,4vw,2.6rem)',
            fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
          }}>
            Song Queue
          </h1>
          {songs.length > 0 && (
            <span style={{
              padding: '4px 12px', borderRadius: 20, marginBottom: 6,
              background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.2)',
              fontSize: '0.72rem', color: 'var(--gold)', letterSpacing: '0.06em',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{songs.length}</span>
              {' '}pending
            </span>
          )}
        </div>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
          Review uploaded songs. Approve, reject, or request changes.
        </p>
      </div>

      {/* Empty */}
      {songs.length === 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          padding: '64px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.12)', borderRadius: 10,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(120,200,120,0.06)', border: '1px solid rgba(120,200,120,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle2 size={22} color="rgba(120,200,120,0.6)" />
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>
            Queue is clear
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
            No songs awaiting review.
          </p>
        </div>
      )}

      {/* Song cards */}
      {songs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Column headers */}
          <div className="anim-fade-up anim-fade-up-2" style={{
            display: 'grid',
            gridTemplateColumns: '52px 1fr auto',
            gap: 16, padding: '6px 20px',
            fontSize: '0.6rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(90,85,80,0.6)',
          }}>
            <div />
            <div>Song</div>
            <div>Actions</div>
          </div>

          {songs.map((song, idx) => (
            <SongCard key={song.id} song={song} idx={idx} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}
