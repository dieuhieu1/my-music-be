'use client';

import { useEffect, useState, useCallback } from 'react';
import { Flag, ChevronLeft, ChevronRight, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { Report, ReportStatus, ReportTargetType, ReportReason } from '@/lib/api/reports.api';

const STATUS_OPTS: { value: ReportStatus | ''; label: string }[] = [
  { value: '',          label: 'All'       },
  { value: 'PENDING',   label: 'Pending'   },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'RESOLVED',  label: 'Resolved'  },
];

const TARGET_OPTS: { value: ReportTargetType | ''; label: string }[] = [
  { value: '',         label: 'Any type' },
  { value: 'SONG',     label: 'Song'     },
  { value: 'PLAYLIST', label: 'Playlist' },
  { value: 'ARTIST',   label: 'Artist'   },
];

const REASON_LABELS: Record<ReportReason, string> = {
  EXPLICIT:      'Explicit content',
  COPYRIGHT:     'Copyright',
  INAPPROPRIATE: 'Inappropriate',
};

function statusStyle(status: ReportStatus) {
  if (status === 'PENDING')   return { color: 'rgba(240,190,60,0.9)',  bg: 'rgba(240,190,60,0.08)'  };
  if (status === 'DISMISSED') return { color: 'var(--muted-text)',     bg: 'rgba(42,37,32,0.3)'     };
  return                             { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)' };
}

// ── Resolution panel ──────────────────────────────────────────────────────────
function ResolvePanel({ action, onSubmit, onCancel }: {
  action: 'dismiss' | 'takedown';
  onSubmit: (notes?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy]   = useState(false);

  const isDanger = action === 'takedown';
  const color  = isDanger ? 'rgba(220,80,80,0.9)' : 'var(--muted-text)';
  const border = isDanger ? 'rgba(220,80,80,0.3)' : 'rgba(42,37,32,0.6)';
  const bg     = isDanger ? 'rgba(220,80,80,0.05)' : 'rgba(42,37,32,0.15)';

  const handle = async () => {
    setBusy(true);
    await onSubmit(notes.trim() || undefined);
  };

  return (
    <div className="anim-fade-up" style={{
      marginTop: 12, padding: '14px 16px',
      background: bg, border: `1px solid ${border}`, borderRadius: 6,
    }}>
      {isDanger && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={14} color="rgba(220,80,80,0.8)" />
          <p style={{ fontSize: '0.74rem', color: 'rgba(220,80,80,0.8)' }}>
            This will take down the reported content and cannot be easily undone.
          </p>
        </div>
      )}
      <p style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color, marginBottom: 8 }}>
        Notes (optional)
      </p>
      <textarea
        value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
        placeholder="Internal notes for this action…"
        style={{
          width: '100%', padding: '8px 10px', resize: 'vertical',
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(42,37,32,0.8)',
          borderRadius: 4, color: 'var(--ivory)', fontSize: '0.82rem',
          fontFamily: 'var(--font-body)', outline: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={handle} disabled={busy} style={{
          padding: '7px 16px', borderRadius: 4, border: `1px solid ${border}`,
          background: bg, color, fontSize: '0.75rem', fontFamily: 'var(--font-body)',
          cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
          display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em',
        }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : null}
          {action === 'dismiss' ? 'Dismiss report' : 'Take down content'}
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

// ── Report row ────────────────────────────────────────────────────────────────
function ReportRow({ report: initReport, idx, onUpdate }: {
  report: Report;
  idx: number;
  onUpdate: (updated: Report) => void;
}) {
  const [report, setReport] = useState(initReport);
  const [panel, setPanel]   = useState<'dismiss' | 'takedown' | null>(null);
  const [toast, setToast]   = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleAction = async (action: 'dismiss' | 'takedown', notes?: string) => {
    try {
      const res = action === 'dismiss'
        ? await adminApi.dismissReport(report.id, notes)
        : await adminApi.takedownReport(report.id, notes);
      const d = (res.data as any).data ?? res.data;
      setReport(d);
      onUpdate(d);
      setPanel(null);
      showToast(action === 'dismiss' ? 'Report dismissed' : 'Content taken down');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Action failed';
      setPanel(null);
      showToast(Array.isArray(msg) ? msg.join(' · ') : String(msg), false);
    }
  };

  const sc = statusStyle(report.status);
  const isPending = report.status === 'PENDING';

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        background: '#111', border: '1px solid rgba(42,37,32,0.5)',
        borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.18s',
        position: 'relative',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.5)')}
    >
      {/* Row toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 8, right: 12, zIndex: 10,
          padding: '5px 12px', borderRadius: 4,
          background: toast.ok ? 'rgba(120,200,120,0.1)' : 'rgba(220,80,80,0.1)',
          border: `1px solid ${toast.ok ? 'rgba(120,200,120,0.25)' : 'rgba(220,80,80,0.25)'}`,
          color: toast.ok ? 'rgba(120,200,120,0.9)' : 'rgba(220,80,80,0.9)',
          fontSize: '0.72rem', fontFamily: 'var(--font-body)',
        }}>
          {toast.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px' }}>
        {/* Icon */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: 'rgba(220,80,80,0.06)', border: '1px solid rgba(220,80,80,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Flag size={13} color="rgba(220,80,80,0.6)" />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: '0.6rem',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: sc.color, background: sc.bg,
            }}>
              {report.status}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: '0.6rem',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--muted-text)', background: 'rgba(42,37,32,0.3)',
            }}>
              {report.targetType}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>
              {REASON_LABELS[report.reason as ReportReason] ?? report.reason}
            </span>
          </div>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.68rem', fontFamily: 'monospace' }}>
            Target: {report.targetId.slice(0, 20)}…
          </p>
          <p style={{ color: 'rgba(90,85,80,0.6)', fontSize: '0.66rem', marginTop: 4 }}>
            Reported {fmtDate(report.createdAt)}
          </p>
          {report.notes && (
            <p style={{ color: 'var(--muted-text)', fontSize: '0.74rem', marginTop: 6, fontStyle: 'italic' }}>
              "{report.notes}"
            </p>
          )}
        </div>

        {/* Actions */}
        {isPending && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => setPanel(panel === 'dismiss' ? null : 'dismiss')} style={{
              padding: '7px 12px', borderRadius: 4, fontSize: '0.72rem',
              fontFamily: 'var(--font-body)', letterSpacing: '0.04em', cursor: 'pointer',
              background: panel === 'dismiss' ? 'rgba(90,85,80,0.15)' : 'transparent',
              border: `1px solid ${panel === 'dismiss' ? 'rgba(90,85,80,0.4)' : 'rgba(42,37,32,0.6)'}`,
              color: 'var(--muted-text)', transition: 'background 0.15s, border-color 0.15s',
            }}>
              Dismiss
            </button>
            <button type="button" onClick={() => setPanel(panel === 'takedown' ? null : 'takedown')} style={{
              padding: '7px 12px', borderRadius: 4, fontSize: '0.72rem',
              fontFamily: 'var(--font-body)', letterSpacing: '0.04em', cursor: 'pointer',
              background: panel === 'takedown' ? 'rgba(220,80,80,0.1)' : 'transparent',
              border: `1px solid ${panel === 'takedown' ? 'rgba(220,80,80,0.3)' : 'rgba(42,37,32,0.6)'}`,
              color: panel === 'takedown' ? 'rgba(220,80,80,0.9)' : 'var(--muted-text)',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}>
              Take down
            </button>
          </div>
        )}
      </div>

      {panel && (
        <div style={{ padding: '0 20px 16px' }}>
          <ResolvePanel
            action={panel}
            onSubmit={(notes) => handleAction(panel, notes)}
            onCancel={() => setPanel(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SIZE = 20;

export default function AdminReportsPage() {
  const [reports, setReports]         = useState<Report[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatus]     = useState<ReportStatus | ''>('PENDING');
  const [targetFilter, setTarget]     = useState<ReportTargetType | ''>('');
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async (p: number, status: string, target: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getReports({
        page: p, size: SIZE,
        status: status || undefined,
        targetType: target || undefined,
      } as any);
      const d = (res.data as any).data ?? res.data;
      setReports(Array.isArray(d.items) ? d.items : []);
      setTotal(d.totalItems ?? 0);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, statusFilter, targetFilter); }, [load, page, statusFilter, targetFilter]);

  const handleStatus = (s: ReportStatus | '') => { setStatus(s); setPage(1); };
  const handleTarget = (t: ReportTargetType | '') => { setTarget(t); setPage(1); };
  const handleUpdate = (updated: Report) => setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));

  const totalPages = Math.max(1, Math.ceil(total / SIZE));

  return (
    <div style={{ padding: '32px 32px' }}>

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
              Content Reports
            </h1>
            {total > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: 20, marginBottom: 6,
                background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)',
                fontSize: '0.72rem', color: 'rgba(220,80,80,0.8)', letterSpacing: '0.06em',
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{total}</span>
                {statusFilter === 'PENDING' ? ' open' : ''}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
            Review flagged content. Dismiss or take down as appropriate.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {STATUS_OPTS.map(({ value, label }) => (
            <button key={value || 'all'} type="button" onClick={() => handleStatus(value as any)} style={{
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
          <div style={{ width: 1, background: 'rgba(42,37,32,0.5)', margin: '0 2px' }} />
          {TARGET_OPTS.map(({ value, label }) => (
            <button key={value || 'any'} type="button" onClick={() => handleTarget(value as any)} style={{
              padding: '7px 14px', borderRadius: 4,
              background: targetFilter === value ? 'rgba(232,184,75,0.08)' : 'transparent',
              border: `1px solid ${targetFilter === value ? 'rgba(232,184,75,0.3)' : 'rgba(42,37,32,0.6)'}`,
              color: targetFilter === value ? 'var(--gold)' : 'var(--muted-text)',
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
      {!loading && reports.length === 0 && (
        <div className="anim-fade-up anim-fade-up-3" style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px dashed rgba(42,37,32,0.5)', borderRadius: 10,
        }}>
          <CheckCircle2 size={28} color="rgba(120,200,120,0.3)" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--muted-text)' }}>
            {statusFilter === 'PENDING' ? 'No open reports' : 'No reports found'}
          </p>
        </div>
      )}

      {/* Reports */}
      {!loading && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map((report, idx) => (
            <ReportRow key={report.id} report={report} idx={idx} onUpdate={handleUpdate} />
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
            Page <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{page}</span>
            {' '}of <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{totalPages}</span>
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
