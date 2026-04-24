'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Music2, CheckCircle2, XCircle, RefreshCw, Clock,
  ChevronDown, ChevronUp, Loader2, ChevronLeft, ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { Song } from '@/lib/api/songs.api';

const STATUS_OPTIONS = [
  { value: 'PENDING',           label: 'Pending',          color: 'rgba(240,190,60,0.9)'  },
  { value: 'LIVE',              label: 'Live',             color: 'rgba(120,200,120,0.9)' },
  { value: 'TAKEN_DOWN',        label: 'Taken down',       color: 'rgba(220,80,80,0.9)'   },
  { value: 'REJECTED',          label: 'Rejected',         color: 'rgba(220,80,80,0.7)'   },
  { value: 'REUPLOAD_REQUIRED', label: 'Reupload req.',    color: 'rgba(240,140,60,0.9)'  },
  { value: 'SCHEDULED',         label: 'Scheduled',        color: 'rgba(100,180,240,0.9)' },
];

function statusColor(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color ?? 'var(--muted-text)';
}

// ── Inline action panel ───────────────────────────────────────────────────────
function ActionPanel({ type, onSubmit, onCancel }: {
  type: 'reject' | 'reupload';
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const color  = type === 'reject' ? 'rgba(220,80,80,0.9)' : 'rgba(240,140,60,0.9)';
  const border = type === 'reject' ? 'rgba(220,80,80,0.3)' : 'rgba(240,140,60,0.3)';
  const bg     = type === 'reject' ? 'rgba(220,80,80,0.08)' : 'rgba(240,140,60,0.08)';
  const label  = type === 'reject' ? 'Rejection reason' : 'Reupload notes';
  const btn    = type === 'reject' ? 'Reject' : 'Request Reupload';

  const handle = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await onSubmit(text.trim());
  };

  return (
    <div className="anim-fade-up" style={{
      marginTop: 12, padding: '14px 16px',
      background: bg, border: `1px solid ${border}`, borderRadius: 6,
    }}>
      <p style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color, marginBottom: 8 }}>
        {label} <span style={{ color: 'rgba(201,76,76,0.6)' }}>*</span>
      </p>
      <textarea
        autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2}
        placeholder={type === 'reject' ? 'e.g. Audio quality too low…' : 'e.g. Please re-upload at 320kbps…'}
        style={{
          width: '100%', padding: '8px 10px', resize: 'vertical',
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(42,37,32,0.8)',
          borderRadius: 4, color: 'var(--ivory)', fontSize: '0.82rem',
          fontFamily: 'var(--font-body)', outline: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={handle} disabled={busy || !text.trim()} style={{
          padding: '7px 16px', borderRadius: 4, border: `1px solid ${border}`,
          background: bg, color, fontSize: '0.75rem', fontFamily: 'var(--font-body)',
          cursor: busy || !text.trim() ? 'not-allowed' : 'pointer',
          opacity: busy || !text.trim() ? 0.5 : 1,
          display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em',
        }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : null}
          {btn}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: '7px 14px', borderRadius: 4, border: '1px solid rgba(42,37,32,0.6)',
          background: 'transparent', color: 'var(--muted-text)',
          fontSize: '0.75rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Song card ─────────────────────────────────────────────────────────────────
function SongCard({ song, idx, statusFilter, onAction }: {
  song: Song & { artistName?: string };
  idx: number;
  statusFilter: string;
  onAction: (songId: string, action: string, text?: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel]       = useState<'reject' | 'reupload' | null>(null);
  const [busy, setBusy]         = useState(false);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDuration = (s: number | null) =>
    s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '—';

  const act = async (action: string, text?: string) => {
    setBusy(true);
    await onAction(song.id, action, text);
    setBusy(false);
  };

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        background: '#111', border: '1px solid rgba(42,37,32,0.6)',
        borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.6)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
        {/* Cover */}
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

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--ivory)', fontSize: '0.92rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.title}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3 }}>
            {(song as any).artistName ? `${(song as any).artistName} · ` : ''}
            {fmtDate(song.createdAt)}
            {song.bpm !== null && ` · ${song.bpm} BPM`}
            {` · ${fmtDuration(song.duration)}`}
          </p>
          {statusFilter === 'ALL' && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              padding: '1px 7px', borderRadius: 20,
              fontSize: '0.6rem', letterSpacing: '0.06em', textTransform: 'uppercase',
              color: statusColor(song.status), background: `${statusColor(song.status).replace('0.9)', '0.08)')}`,
              border: `1px solid ${statusColor(song.status).replace('0.9)', '0.2)')}`,
            }}>
              {song.status.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {(statusFilter === 'PENDING' || song.status === 'PENDING') && (
            <>
              <button type="button" onClick={() => act('approve')} disabled={busy || panel !== null}
                title="Approve" style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 4, background: 'rgba(120,200,120,0.08)',
                  border: '1px solid rgba(120,200,120,0.25)', color: 'rgba(120,200,120,0.9)',
                  fontSize: '0.75rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
                  cursor: busy || panel !== null ? 'not-allowed' : 'pointer',
                  opacity: busy || panel !== null ? 0.5 : 1, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!busy && !panel) (e.currentTarget as HTMLElement).style.background = 'rgba(120,200,120,0.14)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(120,200,120,0.08)'; }}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Approve
              </button>
              <button type="button" onClick={() => setPanel(panel === 'reupload' ? null : 'reupload')} disabled={busy} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4,
                background: panel === 'reupload' ? 'rgba(240,140,60,0.12)' : 'transparent',
                border: `1px solid ${panel === 'reupload' ? 'rgba(240,140,60,0.3)' : 'rgba(42,37,32,0.8)'}`,
                color: panel === 'reupload' ? 'rgba(240,140,60,0.9)' : 'var(--muted-text)',
                fontSize: '0.75rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
                cursor: busy ? 'not-allowed' : 'pointer', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}>
                <RefreshCw size={13} /> Reupload
              </button>
              <button type="button" onClick={() => setPanel(panel === 'reject' ? null : 'reject')} disabled={busy} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 4,
                background: panel === 'reject' ? 'rgba(220,80,80,0.1)' : 'transparent',
                border: `1px solid ${panel === 'reject' ? 'rgba(220,80,80,0.3)' : 'rgba(42,37,32,0.8)'}`,
                color: panel === 'reject' ? 'rgba(220,80,80,0.9)' : 'var(--muted-text)',
                fontSize: '0.75rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
                cursor: busy ? 'not-allowed' : 'pointer', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}>
                <XCircle size={13} /> Reject
              </button>
            </>
          )}

          {(statusFilter === 'TAKEN_DOWN' || song.status === 'TAKEN_DOWN') && (
            <button type="button" onClick={() => act('restore')} disabled={busy} title="Restore" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 4, background: 'rgba(100,180,240,0.08)',
              border: '1px solid rgba(100,180,240,0.25)', color: 'rgba(100,180,240,0.9)',
              fontSize: '0.75rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
            }}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={13} />}
              Restore
            </button>
          )}

          <button type="button" onClick={() => setExpanded((v) => !v)} style={{
            padding: '7px 8px', borderRadius: 4, background: 'transparent',
            border: '1px solid rgba(42,37,32,0.5)', cursor: 'pointer',
            color: 'var(--muted-text)', transition: 'color 0.15s',
          }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Metadata */}
      {expanded && (
        <div className="anim-fade-up" style={{
          borderTop: '1px solid rgba(42,37,32,0.5)', padding: '14px 20px',
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
          {song.dropAt && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 4 }}>Drop Date</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--ivory)' }}>{new Date(song.dropAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Inline panel */}
      {panel && (
        <div style={{ padding: '0 20px 16px' }}>
          <ActionPanel
            type={panel}
            onSubmit={async (text) => { await act(panel!, text); setPanel(null); }}
            onCancel={() => setPanel(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SIZE = 20;

export default function AdminSongsPage() {
  const [songs, setSongs]         = useState<(Song & { artistName?: string })[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatus] = useState('PENDING');
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (p: number, status: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getSongs({
        status: status !== 'ALL' ? status : undefined,
        page: p,
        size: SIZE,
      });
      const d = (res.data as any).data ?? res.data;
      setSongs(Array.isArray(d.items) ? d.items : []);
      setTotal(d.totalItems ?? 0);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, statusFilter); }, [load, page, statusFilter]);

  const handleFilter = (s: string) => { setStatus(s); setPage(1); };

  const handleAction = async (songId: string, action: string, text?: string) => {
    try {
      if (action === 'approve')  await adminApi.approveSong(songId);
      if (action === 'reject')   await adminApi.rejectSong(songId, text!);
      if (action === 'reupload') await adminApi.requestReupload(songId, text!);
      if (action === 'restore')  await adminApi.restoreSong(songId);
      showToast(`Song ${action}d`);
      load(page, statusFilter);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Action failed';
      showToast(Array.isArray(msg) ? msg.join(' · ') : msg, false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / SIZE));

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
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Admin Panel
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem,4vw,2.6rem)',
              fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
            }}>
              Song Management
            </h1>
            {total > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: 20, marginBottom: 6,
                background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.2)',
                fontSize: '0.72rem', color: 'var(--gold)', letterSpacing: '0.06em',
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{total}</span>
                {statusFilter !== 'ALL' && ` ${statusFilter.toLowerCase().replace(/_/g, ' ')}`}
              </span>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {[{ value: 'PENDING', label: 'Pending' }, { value: 'LIVE', label: 'Live' }, { value: 'TAKEN_DOWN', label: 'Taken Down' }, { value: 'REJECTED', label: 'Rejected' }, { value: 'ALL', label: 'All' }].map(({ value, label }) => (
            <button key={value} type="button" onClick={() => handleFilter(value)} style={{
              padding: '7px 14px', borderRadius: 4,
              background: statusFilter === value ? 'rgba(232,184,75,0.08)' : 'transparent',
              border: `1px solid ${statusFilter === value ? 'rgba(232,184,75,0.3)' : 'rgba(42,37,32,0.6)'}`,
              color: statusFilter === value ? 'var(--gold)' : 'var(--muted-text)',
              fontSize: '0.72rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
              letterSpacing: '0.04em', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <div className="vinyl-spin" style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
        </div>
      )}

      {/* Empty */}
      {!loading && songs.length === 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          padding: '64px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.12)', borderRadius: 10,
        }}>
          <CheckCircle2 size={22} color="rgba(120,200,120,0.5)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>
            {statusFilter === 'PENDING' ? 'Queue is clear' : 'No songs found'}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
            {statusFilter === 'PENDING' ? 'No songs awaiting review.' : `No songs with status: ${statusFilter.toLowerCase()}`}
          </p>
        </div>
      )}

      {/* Songs */}
      {!loading && songs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {songs.map((song, idx) => (
            <SongCard key={song.id} song={song} idx={idx} statusFilter={statusFilter} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32 }}>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 4,
            background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
            color: page === 1 ? 'rgba(90,85,80,0.4)' : 'var(--muted-text)',
            fontSize: '0.75rem', fontFamily: 'var(--font-body)',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
          }}>
            <ChevronLeft size={13} /> Previous
          </button>
          <p style={{ fontSize: '0.76rem', color: 'var(--muted-text)' }}>
            Page{' '}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{page}</span>
            {' '}of{' '}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{totalPages}</span>
          </p>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 4,
            background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
            color: page === totalPages ? 'rgba(90,85,80,0.4)' : 'var(--muted-text)',
            fontSize: '0.75rem', fontFamily: 'var(--font-body)',
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
          }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
