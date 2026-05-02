'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Search, Crown } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { PaymentRecord, AdminUser } from '@/lib/api/admin.api';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

const SIZE = 20;

// ── Helpers ────────────────────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<string, { bg: string; color: string }> = {
  VNPAY: { bg: 'var(--accent-light)',  color: 'var(--accent)' },
  MOMO:  { bg: 'var(--success-light)', color: 'var(--success)' },
  ADMIN: { bg: 'var(--purple-light)',  color: 'var(--purple)' },
};

function ProviderBadge({ provider }: { provider: string }) {
  const cfg = PROVIDER_CONFIG[provider] ?? { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' };
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      background: cfg.bg, color: cfg.color,
    }}>
      {provider}
    </span>
  );
}

function userInitials(email: string): string {
  const local = email?.split('@')[0] ?? '?';
  return local.slice(0, 2).toUpperCase();
}

function formatVND(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function planLabel(premiumType: string | null): string {
  if (!premiumType) return 'Custom grant';
  const map: Record<string, string> = {
    MONTHLY: '1 month', QUARTERLY: '3 months',
    SEMI_ANNUAL: '6 months', ANNUAL: '12 months',
  };
  return map[premiumType] ?? premiumType;
}

// Tab → query params mapping
function tabToParams(tab: string): { provider?: string; status?: string } {
  switch (tab) {
    case 'vnpay':   return { provider: 'VNPAY' };
    case 'momo':    return { provider: 'MOMO' };
    case 'admin':   return { provider: 'ADMIN' };
    case 'success': return { status: 'SUCCESS' };
    case 'failed':  return { status: 'FAILED' };
    default:        return {};
  }
}

// ── Grant Modal ────────────────────────────────────────────────────────────

function GrantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [userSearch, setUserSearch]     = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [days, setDays]                 = useState<number | ''>(30);
  const [notes, setNotes]               = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: searchResults } = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: () => adminApi.getUserSearch(userSearch),
    enabled: userSearch.length >= 2,
    select: (r) => r.data.items,
  });

  const grant = useMutation({
    mutationFn: () => adminApi.grantPremium({
      userId: selectedUser!.id,
      durationDays: Number(days),
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast('Premium granted successfully', 'success');
      qc.invalidateQueries({ queryKey: ['payments'] });
      handleClose();
    },
    onError: () => toast('Failed to grant premium', 'error'),
  });

  function handleClose() {
    onClose();
    setUserSearch('');
    setSelectedUser(null);
    setDays(30);
    setNotes('');
    setDropdownOpen(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--bg)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius)', color: 'var(--text)',
    fontSize: 13, outline: 'none',
  };

  const canSubmit = !!selectedUser && Number(days) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent title="Grant Premium Access" description="Manually activate premium for a user.">

        {/* User search */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            User Email
          </label>
          {selectedUser ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'var(--accent-light)',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 'var(--radius)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-full)', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                }}>
                  {userInitials(selectedUser.email)}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{selectedUser.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 14, padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-faint)', pointerEvents: 'none',
              }} />
              <input
                placeholder="Search by email…"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
              {dropdownOpen && searchResults && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--surface)', border: '1px solid var(--border-2)',
                  borderRadius: 'var(--radius)', marginTop: 4,
                  boxShadow: 'var(--shadow-md)', overflow: 'hidden',
                }}>
                  {searchResults.slice(0, 6).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserSearch(u.email); setDropdownOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                        color: 'var(--text)', fontSize: 13, cursor: 'pointer',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 'var(--radius-full)', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: '#fff',
                      }}>
                        {userInitials(u.email)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Duration (days)
          </label>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  flex: 1, padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 100ms',
                  background: days === d ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: days === d ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${days === d ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value === '' ? '' : Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Notes (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Reason for grant…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <DialogFooter>
          <button
            onClick={handleClose}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
              background: 'transparent', border: '1px solid var(--border-2)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => grant.mutate()}
            disabled={!canSubmit || grant.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
              background: 'var(--accent)', color: '#fff', border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: (!canSubmit || grant.isPending) ? 0.55 : 1, transition: 'opacity 150ms',
            }}
          >
            <Crown size={13} />
            {grant.isPending ? 'Granting…' : 'Grant Premium'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab]         = useState('');
  const [page, setPage]       = useState(1);
  const [grantOpen, setGrantOpen]     = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PaymentRecord | null>(null);

  const queryParams = tabToParams(tab);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', tab, page],
    queryFn: () => adminApi.getPayments({ ...queryParams, page, size: SIZE }),
    select: (r) => r.data,
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => adminApi.revokePremium(userId),
    onSuccess: () => {
      toast('Premium revoked', 'warning');
      qc.invalidateQueries({ queryKey: ['payments'] });
      setRevokeTarget(null);
    },
    onError: () => toast('Failed to revoke', 'error'),
  });

  const TABS = [
    { key: '',        label: 'All' },
    { key: 'vnpay',   label: 'VNPay' },
    { key: 'momo',    label: 'MoMo' },
    { key: 'admin',   label: 'Manual Grant' },
    { key: 'success', label: 'Success' },
    { key: 'failed',  label: 'Failed' },
  ];

  const COLS: Column<PaymentRecord>[] = [
    {
      key: 'userEmail', header: 'User', width: 200,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 'var(--radius-full)', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
          }}>
            {userInitials(p.userEmail ?? '?')}
          </div>
          <span style={{
            fontSize: 13, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 155,
          }}>
            {p.userEmail ?? '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'provider', header: 'Provider', width: 120,
      render: (p) => <ProviderBadge provider={p.provider} />,
    },
    {
      key: 'amountVnd', header: 'Amount', width: 140,
      render: (p) => (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          {formatVND(p.amountVnd)}
        </span>
      ),
    },
    {
      key: 'premiumType', header: 'Plan', width: 110,
      render: (p) => (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {planLabel(p.premiumType)}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'transactionId', header: 'Transaction ID', width: 160,
      render: (p) => (
        <span
          title={p.transactionId ?? undefined}
          style={{
            fontFamily: 'monospace', fontSize: 11, color: 'var(--text-faint)',
            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', maxWidth: 144,
          }}
        >
          {p.transactionId ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Date', width: 120,
      render: (p) => (
        <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
          {format(new Date(p.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 80,
      render: (p) => {
        if (p.provider !== 'ADMIN' || p.status !== 'ADMIN_GRANTED') return null;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setRevokeTarget(p); }}
            style={{
              padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11,
              fontWeight: 500, background: 'var(--danger-light)', color: 'var(--danger)',
              border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
            }}
          >
            Revoke
          </button>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Payments</h1>
        <button
          onClick={() => setGrantOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--radius)',
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={14} /> Grant Premium
        </button>
      </div>

      <StatusTabs
        tabs={TABS}
        active={tab}
        onChange={(k) => { setTab(k); setPage(1); }}
      />

      <DataTable
        columns={COLS}
        data={data?.items ?? []}
        loading={isLoading}
        rowKey={(p) => p.id}
        page={page}
        size={SIZE}
        totalItems={data?.totalItems ?? 0}
        onPageChange={setPage}
        emptyIcon={CreditCard}
        emptyMessage="No payments found"
      />

      <GrantModal open={grantOpen} onClose={() => setGrantOpen(false)} />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}
        title="Revoke Premium"
        description={`This will immediately remove premium access from ${revokeTarget?.userEmail ?? 'this user'}. They will lose premium features right away.`}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.userId)}
        confirmLabel="Revoke"
        confirmVariant="destructive"
        loading={revoke.isPending}
      />

    </div>
  );
}
