'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Music, ListMusic, Mic, User } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { Report } from '@/lib/api/admin.api';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { BADGE_QUERY_KEYS } from '@/components/ui/NotificationBell';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

const SIZE = 20;

// BE targetType values from Report type
const TARGET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '',         label: 'All types' },
  { value: 'SONG',     label: 'Song' },
  { value: 'PLAYLIST', label: 'Playlist' },
  { value: 'ARTIST',   label: 'Artist' },
  { value: 'USER',     label: 'User' },
];

const TARGET_CONFIG: Record<string, {
  icon: React.ElementType; label: string; bg: string; color: string;
}> = {
  SONG:     { icon: Music,     label: 'Song',     bg: 'var(--accent-light)',  color: 'var(--accent)' },
  PLAYLIST: { icon: ListMusic, label: 'Playlist', bg: 'var(--cyan-light)',    color: 'var(--cyan)' },
  ARTIST:   { icon: Mic,       label: 'Artist',   bg: 'var(--purple-light)',  color: 'var(--purple)' },
  USER:     { icon: User,      label: 'User',     bg: 'var(--orange-light)',  color: 'var(--orange)' },
};

function TargetTypePill({ type }: { type: string }) {
  const cfg = TARGET_CONFIG[type] ?? {
    icon: Flag, label: type,
    bg: 'var(--bg-subtle)', color: 'var(--text-muted)',
  };
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 500,
    }}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function ExpandedReport({ report }: { report: Report }) {
  const fields = [
    { label: 'Report ID',  value: report.id,             mono: true },
    { label: 'Target ID',  value: report.targetId,       mono: true },
    { label: 'Target Type',value: report.targetType },
    { label: 'Reason',     value: report.reason },
    { label: 'Reporter',   value: report.reporterEmail,  mono: true },
    { label: 'Status',     value: report.status },
    { label: 'Notes',      value: report.notes ?? '—' },
    { label: 'Filed',      value: format(new Date(report.createdAt), 'MMM d, yyyy HH:mm') },
  ];

  return (
    <div style={{
      padding: '16px 24px', background: 'var(--bg-subtle)',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 20px',
    }}>
      {fields.map(({ label, value, mono }) => (
        <div key={label}>
          <p style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text-faint)',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3,
          }}>
            {label}
          </p>
          <p style={{
            fontSize: 12, color: 'var(--text-muted)',
            fontFamily: mono ? 'monospace' : undefined,
            wordBreak: 'break-all',
          }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [targetType, setTargetType]     = useState('');
  const [page, setPage]                 = useState(1);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [takedownTarget, setTakedownTarget] = useState<Report | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', statusFilter, targetType, page],
    queryFn: () => adminApi.getReports({
      status: statusFilter || undefined,
      targetType: targetType || undefined,
      page,
      size: SIZE,
    }),
    select: (r) => r.data,
  });

  // Shared pending count — drives badge in sidebar + count pill
  const { data: pendingCount } = useQuery({
    queryKey: BADGE_QUERY_KEYS.pendingReports,
    queryFn: () => adminApi.getReports({ status: 'PENDING', size: 1 }),
    select: (r) => r.data.totalItems,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['reports'] });
    qc.invalidateQueries({ queryKey: BADGE_QUERY_KEYS.pendingReports });
  };

  const dismiss = useMutation({
    mutationFn: (id: string) => adminApi.dismissReport(id),
    onSuccess: () => { toast('Report dismissed'); invalidate(); setDismissingId(null); },
    onError: () => toast('Failed to dismiss', 'error'),
  });

  const takedown = useMutation({
    mutationFn: (id: string) => adminApi.takedownReport(id),
    onSuccess: () => { toast('Content taken down'); invalidate(); setTakedownTarget(null); },
    onError: () => toast('Failed to take down', 'error'),
  });

  // BE status union is PENDING | DISMISSED | TAKEN_DOWN  →  "Resolved" label maps to TAKEN_DOWN
  const STATUS_TABS = [
    { key: '',           label: 'All' },
    { key: 'PENDING',    label: 'Pending',   count: pendingCount ?? 0 },
    { key: 'DISMISSED', label: 'Dismissed' },
    { key: 'RESOLVED',  label: 'Resolved' },
  ];

  const COLS: Column<Report>[] = [
    {
      key: 'targetType', header: 'Target', width: 120,
      render: (r) => <TargetTypePill type={r.targetType} />,
    },
    {
      key: 'targetId', header: 'Target ID', width: 160,
      render: (r) => (
        <span
          title={r.targetId}
          style={{
            fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)',
            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', maxWidth: 144,
          }}
        >
          {r.targetId}
        </span>
      ),
    },
    {
      key: 'reason', header: 'Reason', width: 120,
      render: (r) => <StatusBadge status={r.reason} />,
    },
    {
      key: 'reporterEmail', header: 'Reporter', width: 140,
      render: (r) => (
        <span style={{
          fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
        }}>
          {r.reporterEmail}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Filed', width: 110,
      render: (r) => (
        <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
          {format(new Date(r.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions', header: 'Actions', width: 180,
      render: (r) => {
        if (r.status !== 'PENDING') return null;

        // Inline dismiss confirm
        if (dismissingId === r.id) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Are you sure?
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss.mutate(r.id); }}
                disabled={dismiss.isPending}
                style={{
                  padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                  fontWeight: 500, background: 'var(--warning-light)', color: 'var(--warning)',
                  border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDismissingId(null); }}
                style={{
                  padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                  background: 'var(--bg-subtle)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setDismissingId(r.id); }}
              style={{
                padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                fontWeight: 500, background: 'var(--bg-subtle)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setTakedownTarget(r); }}
              style={{
                padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                fontWeight: 500, background: 'var(--danger-light)', color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
              }}
            >
              Takedown
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Reports</h1>
          {(pendingCount ?? 0) > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--danger-light)', color: 'var(--danger)',
            }}>
              {pendingCount} open
            </span>
          )}
        </div>
        <select
          value={targetType}
          onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
          style={{
            width: 160, padding: '8px 10px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13,
            outline: 'none', cursor: 'pointer',
          }}
        >
          {TARGET_TYPE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <StatusTabs
        tabs={STATUS_TABS}
        active={statusFilter}
        onChange={(k) => { setStatusFilter(k); setPage(1); setDismissingId(null); }}
      />

      <DataTable
        columns={COLS}
        data={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        page={page}
        size={SIZE}
        totalItems={data?.totalItems ?? 0}
        onPageChange={setPage}
        onRowClick={(r) => setExpandedId((id) => id === r.id ? null : r.id)}
        expandedRowId={expandedId ?? undefined}
        renderExpanded={(r) => <ExpandedReport report={r} />}
        emptyIcon={Flag}
        emptyMessage="No reports found"
      />

      <ConfirmDialog
        open={!!takedownTarget}
        onOpenChange={(o) => { if (!o) setTakedownTarget(null); }}
        title="Take Down Content"
        description={`This will permanently remove the ${(takedownTarget?.targetType ?? 'content').toLowerCase()} and cannot be undone. All related data will be cascade deleted.`}
        onConfirm={() => takedownTarget && takedown.mutate(takedownTarget.id)}
        confirmLabel="Take Down"
        confirmVariant="destructive"
        loading={takedown.isPending}
      />

    </div>
  );
}
