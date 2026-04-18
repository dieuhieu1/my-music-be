'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, Tags, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { adminApi, type GenreSuggestion } from '@/lib/api/admin.api';

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    PENDING:  { color: 'rgba(232,184,75,0.9)',  bg: 'rgba(232,184,75,0.08)',  label: 'Pending'  },
    APPROVED: { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)', label: 'Approved' },
    REJECTED: { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)',   label: 'Rejected' },
  };
  const s = map[status] ?? { color: 'var(--muted-text)', bg: 'rgba(90,85,80,0.15)', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: '0.64rem',
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: s.color, background: s.bg, whiteSpace: 'nowrap',
    }}>
      {status === 'PENDING'  && <Clock size={10} />}
      {status === 'APPROVED' && <CheckCircle2 size={10} />}
      {status === 'REJECTED' && <XCircle size={10} />}
      {s.label}
    </span>
  );
}

// ── Suggestion row ────────────────────────────────────────────────────────────
function SuggestionRow({
  suggestion,
  idx,
  onAction,
}: {
  suggestion: GenreSuggestion;
  idx: number;
  onAction: (id: string, action: 'approve' | 'reject', notes?: string) => Promise<void>;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes]           = useState('');
  const [busy, setBusy]             = useState(false);

  const isPending = suggestion.status === 'PENDING';

  const handleApprove = async () => {
    setBusy(true);
    await onAction(suggestion.id, 'approve');
  };

  const handleReject = async () => {
    setBusy(true);
    await onAction(suggestion.id, 'reject', notes || undefined);
    setRejectOpen(false);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        background: '#111', border: '1px solid rgba(42,37,32,0.6)',
        borderRadius: 8, overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => isPending && (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.6)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
        {/* Genre icon */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: isPending ? 'rgba(232,184,75,0.07)' : 'rgba(90,85,80,0.08)',
          border: `1px solid ${isPending ? 'rgba(232,184,75,0.15)' : 'rgba(42,37,32,0.5)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Tags size={15} color={isPending ? 'var(--gold)' : 'var(--muted-text)'} />
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: isPending ? 'var(--ivory)' : 'var(--muted-text)',
            fontSize: '0.9rem', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {suggestion.name}
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 3 }}>
            Suggested {fmtDate(suggestion.createdAt)}
            {suggestion.songId && ' · with song upload'}
          </p>
        </div>

        {/* Status */}
        <StatusBadge status={suggestion.status} />

        {/* Actions (pending only) */}
        {isPending && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 4,
                background: 'rgba(120,200,120,0.08)',
                border: '1px solid rgba(120,200,120,0.25)',
                color: 'rgba(120,200,120,0.9)',
                fontSize: '0.73rem', fontFamily: 'var(--font-body)',
                letterSpacing: '0.05em',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = 'rgba(120,200,120,0.13)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(120,200,120,0.08)'; }}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Approve
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen((v) => !v)}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 4,
                background: rejectOpen ? 'rgba(220,80,80,0.09)' : 'transparent',
                border: `1px solid ${rejectOpen ? 'rgba(220,80,80,0.3)' : 'rgba(42,37,32,0.8)'}`,
                color: rejectOpen ? 'rgba(220,80,80,0.9)' : 'var(--muted-text)',
                fontSize: '0.73rem', fontFamily: 'var(--font-body)',
                letterSpacing: '0.05em',
                cursor: busy ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
            >
              {rejectOpen ? <ChevronUp size={12} /> : <XCircle size={12} />}
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Reject panel */}
      {rejectOpen && (
        <div className="anim-fade-up" style={{
          borderTop: '1px solid rgba(42,37,32,0.5)',
          padding: '14px 20px',
          background: 'rgba(220,80,80,0.04)',
        }}>
          <p style={{
            fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(220,80,80,0.7)', marginBottom: 8,
          }}>
            Rejection notes (optional)
          </p>
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Already covered by existing Synthpop genre…"
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
              onClick={handleReject}
              disabled={busy}
              style={{
                padding: '6px 16px', borderRadius: 4,
                background: 'rgba(220,80,80,0.09)',
                border: '1px solid rgba(220,80,80,0.3)',
                color: 'rgba(220,80,80,0.9)', fontSize: '0.73rem',
                fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Confirm Reject
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              style={{
                padding: '6px 14px', borderRadius: 4,
                background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
                color: 'var(--muted-text)', fontSize: '0.73rem',
                fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminGenresPage() {
  const [suggestions, setSuggestions] = useState<GenreSuggestion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState<{ text: string; ok: boolean } | null>(null);
  const [filter, setFilter]           = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    adminApi.getGenreSuggestions()
      .then((r) => { const d = (r.data as any).data ?? r.data; setSuggestions(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      if (action === 'approve') {
        await adminApi.approveGenreSuggestion(id);
        setSuggestions((prev) =>
          prev.map((s) => s.id === id ? { ...s, status: 'APPROVED' as const } : s),
        );
        showToast('Genre approved — bulk tagging queued');
      } else {
        await adminApi.rejectGenreSuggestion(id, notes);
        setSuggestions((prev) =>
          prev.map((s) => s.id === id ? { ...s, status: 'REJECTED' as const } : s),
        );
        showToast('Suggestion rejected');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Action failed';
      showToast(Array.isArray(msg) ? msg.join(' · ') : msg, false);
    }
  };

  const filtered = suggestions.filter((s) => filter === 'ALL' ? true : s.status === filter);
  const pendingCount = suggestions.filter((s) => s.status === 'PENDING').length;

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
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 32 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Admin Panel
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem,4vw,2.6rem)',
            fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
          }}>
            Genre Suggestions
          </h1>
          {pendingCount > 0 && (
            <span style={{
              padding: '4px 12px', borderRadius: 20, marginBottom: 6,
              background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.2)',
              fontSize: '0.72rem', color: 'var(--gold)', letterSpacing: '0.06em',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{pendingCount}</span>
              {' '}pending
            </span>
          )}
        </div>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
          Artist-submitted genre suggestions. Approving creates a new genre and retroactively tags linked songs.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="anim-fade-up anim-fade-up-2" style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => {
          const count = f === 'ALL' ? suggestions.length : suggestions.filter((s) => s.status === f).length;
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 4,
                background: active ? 'rgba(232,184,75,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(232,184,75,0.3)' : 'rgba(42,37,32,0.6)'}`,
                color: active ? 'var(--gold)' : 'var(--muted-text)',
                fontSize: '0.73rem', fontFamily: 'var(--font-body)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
            >
              {f}{' '}
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.8rem',
                color: active ? 'var(--gold)' : 'rgba(90,85,80,0.8)',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="anim-fade-up anim-fade-up-3" style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 10,
        }}>
          <Tags size={28} color="rgba(232,184,75,0.2)" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--muted-text)' }}>
            No {filter === 'ALL' ? '' : filter.toLowerCase()} suggestions
          </p>
        </div>
      )}

      {/* Suggestion list */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((s, idx) => (
            <SuggestionRow key={s.id} suggestion={s} idx={idx} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}
