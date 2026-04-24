'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, ChevronLeft, ChevronRight, Gift, Loader2, Check, X,
} from 'lucide-react';
import { adminApi, type PaymentRecord } from '@/lib/api/admin.api';

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  SUCCESS:       { color: 'rgba(120,200,120,0.9)', bg: 'rgba(120,200,120,0.08)' },
  ADMIN_GRANTED: { color: 'rgba(232,184,75,0.9)',  bg: 'rgba(232,184,75,0.08)'  },
  PENDING:       { color: 'rgba(240,190,60,0.9)',  bg: 'rgba(240,190,60,0.08)'  },
  FAILED:        { color: 'rgba(220,80,80,0.9)',   bg: 'rgba(220,80,80,0.08)'   },
  REFUNDED:      { color: 'var(--muted-text)',      bg: 'rgba(42,37,32,0.3)'     },
};

// ── Grant premium panel ───────────────────────────────────────────────────────
function GrantPanel({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [userId, setUserId]       = useState('');
  const [days, setDays]           = useState('30');
  const [notes, setNotes]         = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handle = async () => {
    const d = parseInt(days);
    if (!userId.trim() || isNaN(d) || d < 1) { setError('User ID and valid duration required'); return; }
    setBusy(true);
    setError(null);
    try {
      await adminApi.grantPremium({ userId: userId.trim(), durationDays: d, notes: notes.trim() || undefined });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to grant premium';
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg));
      setBusy(false);
    }
  };

  return (
    <div className="anim-scale-reveal" style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      zIndex: 200, width: 'min(420px, 92vw)',
      background: 'var(--surface-2)', border: '1px solid rgba(232,184,75,0.15)',
      borderRadius: 12, padding: '28px',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Gift size={16} color="var(--gold)" />
          <p style={{ color: 'var(--ivory)', fontSize: '0.92rem', fontWeight: 500 }}>Grant Premium</p>
        </div>
        <button type="button" onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-text)', padding: 4,
        }}><X size={16} /></button>
      </div>

      {[
        { label: 'User ID', value: userId, setter: setUserId, placeholder: 'UUID of the user' },
        { label: 'Duration (days)', value: days, setter: setDays, placeholder: 'e.g. 30' },
        { label: 'Notes (optional)', value: notes, setter: setNotes, placeholder: 'Reason for manual grant' },
      ].map(({ label, value, setter, placeholder }) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 6 }}>
            {label}
          </p>
          <input
            value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 6,
              background: 'rgba(17,17,17,0.8)', border: '1px solid rgba(42,37,32,0.7)',
              color: 'var(--ivory)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.7)')}
          />
        </div>
      ))}

      {error && (
        <p style={{ fontSize: '0.74rem', color: 'rgba(220,80,80,0.9)', marginBottom: 14 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handle} disabled={busy} style={{
          flex: 1, padding: '10px 0', borderRadius: 6,
          background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.25)',
          color: 'var(--gold)', fontSize: '0.82rem', fontFamily: 'var(--font-body)',
          cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
          Grant Premium
        </button>
        <button type="button" onClick={onClose} style={{
          padding: '10px 18px', borderRadius: 6, background: 'transparent',
          border: '1px solid rgba(42,37,32,0.6)', color: 'var(--muted-text)',
          fontSize: '0.82rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Payment row ───────────────────────────────────────────────────────────────
function PaymentRow({ record, idx }: { record: PaymentRecord; idx: number }) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const sc = STATUS_COLORS[record.status] ?? STATUS_COLORS['PENDING'];

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(idx + 2, 8)}`}
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center', gap: 16, padding: '14px 20px',
        background: '#111', border: '1px solid rgba(42,37,32,0.5)',
        borderRadius: 6, transition: 'border-color 0.18s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(42,37,32,0.5)')}
    >
      {/* User + details */}
      <div style={{ minWidth: 0 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.userId.slice(0, 8)}…
        </p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.68rem', marginTop: 3 }}>
          {record.provider}
          {record.premiumType && ` · ${record.premiumType.replace(/_/g, ' ')}`}
          {record.durationDays && !record.premiumType && ` · ${record.durationDays}d custom`}
          {record.notes && ` · ${record.notes}`}
        </p>
      </div>

      {/* Amount */}
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--ivory)', textAlign: 'right', flexShrink: 0 }}>
        {record.amount != null ? `₫${record.amount.toLocaleString()}` : '—'}
      </p>

      {/* Status */}
      <span style={{
        padding: '3px 10px', borderRadius: 20, fontSize: '0.6rem',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: sc.color, background: sc.bg, whiteSpace: 'nowrap',
        border: `1px solid ${sc.color.replace('0.9)', '0.2)')}`,
      }}>
        {record.status.replace(/_/g, ' ')}
      </span>

      {/* Date */}
      <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {fmtDate(record.createdAt)}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SIZE = 25;
const TABS = [
  { value: 'all',    label: 'All payments' },
  { value: 'grants', label: 'Manual grants' },
];

export default function AdminPaymentsPage() {
  const [tab, setTab]             = useState<'all' | 'grants'>('all');
  const [records, setRecords]     = useState<PaymentRecord[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [toast, setToast]         = useState<string | null>(null);

  const showToastMsg = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async (p: number, t: string) => {
    setLoading(true);
    try {
      const res = t === 'grants'
        ? await adminApi.getManualGrants({ page: p, size: SIZE })
        : await adminApi.getPayments({ page: p, size: SIZE });
      const d = (res.data as any).data ?? res.data;
      setRecords(Array.isArray(d.items) ? d.items : []);
      setTotal(d.totalItems ?? 0);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, tab); }, [load, page, tab]);

  const handleTab = (t: 'all' | 'grants') => { setTab(t); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(total / SIZE));

  return (
    <div style={{ padding: '32px 32px' }}>

      {/* Overlay */}
      {showGrant && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowGrant(false)} />
      )}
      {showGrant && (
        <GrantPanel onClose={() => setShowGrant(false)} onSuccess={() => { showToastMsg('Premium granted'); load(page, tab); }} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 60,
          padding: '11px 18px', borderRadius: 6,
          background: 'rgba(120,200,120,0.12)', border: '1px solid rgba(120,200,120,0.3)',
          color: 'rgba(120,200,120,0.95)', fontSize: '0.82rem', fontFamily: 'var(--font-body)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} /> {toast}
          </div>
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
              Payments
            </h1>
            {total > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: 20, marginBottom: 6,
                background: 'rgba(90,85,80,0.15)', border: '1px solid rgba(42,37,32,0.6)',
                fontSize: '0.72rem', color: 'var(--muted-text)', letterSpacing: '0.06em',
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--ivory)' }}>{total}</span>
                {' '}records
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          {TABS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => handleTab(value as any)} style={{
              padding: '7px 14px', borderRadius: 4,
              background: tab === value ? 'rgba(232,184,75,0.08)' : 'transparent',
              border: `1px solid ${tab === value ? 'rgba(232,184,75,0.3)' : 'rgba(42,37,32,0.6)'}`,
              color: tab === value ? 'var(--gold)' : 'var(--muted-text)',
              fontSize: '0.72rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
              letterSpacing: '0.04em', transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => setShowGrant(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 6,
            background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.25)',
            color: 'var(--gold)', fontSize: '0.76rem', fontFamily: 'var(--font-body)',
            cursor: 'pointer', letterSpacing: '0.05em',
            transition: 'background 0.15s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.08)'; }}
          >
            <Gift size={13} /> Grant Premium
          </button>
        </div>
      </div>

      {/* Column headers */}
      {!loading && records.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto auto',
          gap: 16, padding: '6px 20px', marginBottom: 8,
          fontSize: '0.58rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(90,85,80,0.5)',
        }}>
          <div>User · Plan</div>
          <div style={{ textAlign: 'right' }}>Amount</div>
          <div>Status</div>
          <div style={{ textAlign: 'right' }}>Date</div>
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
      {!loading && records.length === 0 && (
        <div className="anim-fade-up anim-fade-up-3" style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px dashed rgba(42,37,32,0.5)', borderRadius: 10,
        }}>
          <CreditCard size={28} color="rgba(90,85,80,0.3)" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--muted-text)' }}>
            No payment records
          </p>
        </div>
      )}

      {/* Records */}
      {!loading && records.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {records.map((record, idx) => (
            <PaymentRow key={record.id} record={record} idx={idx} />
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
