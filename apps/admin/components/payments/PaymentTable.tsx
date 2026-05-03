'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { adminApi, type PaymentRecord } from '@/lib/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow, Pagination } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/dialog';
import { GrantModal } from './GrantModal';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

const PROVIDER_OPTS = [
  { value: '', label: 'All Providers' },
  { value: 'VNPAY', label: 'VNPay' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'MANUAL', label: 'Manual' },
];

const STATUS_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function AllPaymentsTab() {
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', 'all', provider, status, from, to, page],
    queryFn: async () =>
      (await adminApi.getPayments({
        provider: provider || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        size: 20,
      })).data,
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }}>
          {PROVIDER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>User</Th>
              <Th>Provider</Th>
              <Th>Status</Th>
              <Th>Plan</Th>
              <Th>Tx ID</Th>
              <Th>Amount (VND)</Th>
              <Th>Date</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={7} message="Loading…" />
            ) : data?.items.length === 0 ? (
              <EmptyRow cols={7} message="No payments found." />
            ) : (
              data?.items.map((p) => (
                <Tr key={p.id}>
                  <Td className="text-[#374151]">{p.userEmail}</Td>
                  <Td>
                    <Badge variant="muted">{p.provider}</Badge>
                  </Td>
                  <Td><Badge status={p.status}>{p.status}</Badge></Td>
                  <Td className="text-[#6B7280]">{p.premiumType ?? '—'}</Td>
                  <Td className="text-[#6B7280] font-mono text-xs">{p.transactionId ?? '—'}</Td>
                  <Td className="font-medium text-[#111827]">
                    {p.amountVnd != null ? `${p.amountVnd.toLocaleString()} VND` : '—'}
                  </Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {format(new Date(p.createdAt), 'MMM d, yyyy')}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </>
  );
}

function ManualGrantsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PaymentRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', 'manual-grants', page],
    queryFn: async () => (await adminApi.getManualGrants({ page, size: 20 })).data,
    placeholderData: (prev) => prev,
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => adminApi.revokePremium(userId),
    onSuccess: () => {
      toast('Premium revoked.', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      setRevokeTarget(null);
    },
    onError: () => toast('Failed to revoke premium.', 'error'),
  });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setGrantModalOpen(true)}>
          <Plus size={14} /> Grant Premium
        </Button>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>User</Th>
              <Th>Expires</Th>
              <Th>Granted</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={4} message="Loading…" />
            ) : data?.items.length === 0 ? (
              <EmptyRow cols={4} message="No manual grants." />
            ) : (
              data?.items.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.userEmail}</Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {p.expiresAt ? format(new Date(p.expiresAt), 'MMM d, yyyy') : '—'}
                  </Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {format(new Date(p.createdAt), 'MMM d, yyyy')}
                  </Td>
                  <Td>
                    <Button size="sm" variant="destructive" onClick={() => setRevokeTarget(p)}>
                      <Trash2 size={13} /> Revoke
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      <GrantModal open={grantModalOpen} onOpenChange={setGrantModalOpen} />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke Premium Access"
        description={`Revoke premium from ${revokeTarget?.userEmail}? They will lose premium access immediately.`}
        confirmLabel="Revoke"
        confirmVariant="destructive"
        loading={revokeMut.isPending}
        onConfirm={() => revokeTarget && revokeMut.mutate(revokeTarget.userId)}
      />
    </>
  );
}

export function PaymentTable() {
  const [tab, setTab] = useState<'all' | 'grants'>('all');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E7EB' }}>
        {(['all', 'grants'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #2563EB' : '2px solid transparent',
              color: tab === t ? '#2563EB' : '#6B7280',
              transition: 'color 0.15s',
            }}
          >
            {t === 'all' ? 'All Payments' : 'Manual Grants'}
          </button>
        ))}
      </div>

      {tab === 'all' ? <AllPaymentsTab /> : <ManualGrantsTab />}
    </div>
  );
}
