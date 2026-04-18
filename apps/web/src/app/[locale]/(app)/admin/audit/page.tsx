'use client';

import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';

interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  notes: string | null;
  createdAt: string;
}

// ── Action badge ──────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  SONG_APPROVED:               { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)' },
  SONG_REJECTED:               { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)'   },
  SONG_REUPLOAD_REQUIRED:      { color: 'rgba(240,140,60,0.9)',  bg: 'rgba(240,140,60,0.08)'  },
  SONG_RESTORED:               { color: 'rgba(100,180,240,0.9)', bg: 'rgba(100,180,240,0.08)' },
  GENRE_SUGGESTION_APPROVED:   { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)' },
  GENRE_SUGGESTION_REJECTED:   { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)'   },
  SONG_RESUBMITTED:            { color: 'rgba(232,184,75,0.9)',  bg: 'rgba(232,184,75,0.08)'  },
};

function ActionBadge({ action }: { action: string }) {
  const c = ACTION_COLORS[action] ?? { color: 'var(--muted-text)', bg: 'rgba(90,85,80,0.15)' };
  const label = action.replace(/_/g, ' ');
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 9px', borderRadius: 20,
      fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: c.color, background: c.bg, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────
function LogRow({ entry, idx }: { entry: AuditLogEntry; idx: number }) {
  const [expanded, setExpanded] = useState(false);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        background: '#111', border: '1px solid rgba(42,37,32,0.5)',
        borderRadius: 6, overflow: 'hidden', cursor: entry.notes ? 'pointer' : 'default',
        transition: 'border-color 0.18s',
      }}
      onClick={() => entry.notes && setExpanded((v) => !v)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.5)')}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center',
        gap: 16, padding: '13px 20px',
      }}>
        {/* Action */}
        <div style={{ minWidth: 0 }}>
          <ActionBadge action={entry.action} />
          <p style={{ color: 'var(--muted-text)', fontSize: '0.66rem', marginTop: 5, fontFamily: 'monospace' }}>
            {entry.targetType}{entry.targetId ? ` · ${entry.targetId.slice(0, 8)}…` : ''}
          </p>
        </div>

        {/* Admin ID */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(90,85,80,0.6)', marginBottom: 3 }}>Admin</p>
          <p style={{ fontSize: '0.68rem', color: 'rgba(232,184,75,0.45)', fontFamily: 'monospace' }}>
            {entry.adminId.slice(0, 8)}…
          </p>
        </div>

        {/* Notes indicator */}
        <div style={{ flexShrink: 0, width: 20, textAlign: 'center' }}>
          {entry.notes && (
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(232,184,75,0.4)', margin: '0 auto',
            }} />
          )}
        </div>

        {/* Timestamp */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', whiteSpace: 'nowrap' }}>
            {fmtDate(entry.createdAt)}
          </p>
        </div>
      </div>

      {/* Notes panel */}
      {expanded && entry.notes && (
        <div className="anim-fade-up" style={{
          borderTop: '1px solid rgba(42,37,32,0.5)',
          padding: '12px 20px',
          background: 'rgba(232,184,75,0.02)',
        }}>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.4)', marginBottom: 6 }}>
            Notes
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--ivory)', lineHeight: 1.6 }}>
            {entry.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const ACTION_OPTIONS = [
  'ALL',
  'SONG_APPROVED',
  'SONG_REJECTED',
  'SONG_REUPLOAD_REQUIRED',
  'SONG_RESTORED',
  'GENRE_SUGGESTION_APPROVED',
  'GENRE_SUGGESTION_REJECTED',
  'SONG_RESUBMITTED',
];

export default function AdminAuditPage() {
  const [entries, setEntries]   = useState<AuditLogEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [showFilter, setShowFilter]     = useState(false);
  const limit = 25;

  const load = useCallback(async (p: number, action: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({
        page:   p,
        limit,
        action: action !== 'ALL' ? action : undefined,
      });
      const d = (res.data as any).data ?? res.data;
      setEntries(Array.isArray(d.items) ? d.items : []);
      setTotal(d.total ?? 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, actionFilter); }, [load, page, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleFilter = (action: string) => {
    setActionFilter(action);
    setPage(1);
    setShowFilter(false);
  };

  return (
    <div style={{ padding: '32px 32px' }}>

      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
              Audit Log
            </h1>
            {total > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: 20, marginBottom: 6,
                background: 'rgba(90,85,80,0.15)', border: '1px solid rgba(42,37,32,0.6)',
                fontSize: '0.72rem', color: 'var(--muted-text)', letterSpacing: '0.06em',
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--ivory)' }}>{total}</span>
                {' '}entries
              </span>
            )}
          </div>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
            Immutable record of all admin actions. Click a row with notes to expand.
          </p>
        </div>

        {/* Filter button */}
        <div style={{ position: 'relative', flexShrink: 0, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowFilter((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 6,
              background: actionFilter !== 'ALL' ? 'rgba(232,184,75,0.08)' : 'transparent',
              border: `1px solid ${actionFilter !== 'ALL' ? 'rgba(232,184,75,0.3)' : 'rgba(42,37,32,0.7)'}`,
              color: actionFilter !== 'ALL' ? 'var(--gold)' : 'var(--muted-text)',
              fontSize: '0.75rem', fontFamily: 'var(--font-body)',
              letterSpacing: '0.05em', cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            <Filter size={13} />
            {actionFilter === 'ALL' ? 'Filter by action' : actionFilter.replace(/_/g, ' ')}
          </button>

          {showFilter && (
            <div className="anim-fade-up" style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 50,
              background: '#111', border: '1px solid rgba(42,37,32,0.8)',
              borderRadius: 8, overflow: 'hidden', minWidth: 240,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}>
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleFilter(opt)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', background: actionFilter === opt ? 'rgba(232,184,75,0.07)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(42,37,32,0.4)',
                    color: actionFilter === opt ? 'var(--gold)' : 'var(--muted-text)',
                    fontSize: '0.76rem', fontFamily: 'var(--font-body)',
                    letterSpacing: '0.04em', cursor: 'pointer',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={(e) => { if (actionFilter !== opt) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (actionFilter !== opt) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {opt === 'ALL' ? 'All actions' : opt.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column headers */}
      {!loading && entries.length > 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto',
          gap: 16, padding: '6px 20px', marginBottom: 8,
          fontSize: '0.58rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(90,85,80,0.5)',
        }}>
          <div>Action · Target</div>
          <div>Admin</div>
          <div />
          <div style={{ textAlign: 'right' }}>Timestamp</div>
        </div>
      )}

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
      {!loading && entries.length === 0 && (
        <div className="anim-fade-up anim-fade-up-3" style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px dashed rgba(42,37,32,0.5)', borderRadius: 10,
        }}>
          <ClipboardList size={28} color="rgba(90,85,80,0.3)" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--muted-text)' }}>
            No audit entries found
          </p>
          {actionFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => handleFilter('ALL')}
              style={{
                marginTop: 16, padding: '7px 16px', borderRadius: 4,
                background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
                color: 'var(--muted-text)', fontSize: '0.76rem',
                fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Entries */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry, idx) => (
            <LogRow key={entry.id} entry={entry} idx={idx} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="anim-fade-up" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          marginTop: 32,
        }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 4,
              background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
              color: page === 1 ? 'rgba(90,85,80,0.4)' : 'var(--muted-text)',
              fontSize: '0.75rem', fontFamily: 'var(--font-body)',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <ChevronLeft size={13} /> Previous
          </button>

          <p style={{ fontSize: '0.76rem', color: 'var(--muted-text)' }}>
            Page{' '}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{page}</span>
            {' '}of{' '}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)' }}>{totalPages}</span>
          </p>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 4,
              background: 'transparent', border: '1px solid rgba(42,37,32,0.6)',
              color: page === totalPages ? 'rgba(90,85,80,0.4)' : 'var(--muted-text)',
              fontSize: '0.75rem', fontFamily: 'var(--font-body)',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
