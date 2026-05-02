'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { AuditLog } from '@/lib/api/admin.api';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { format } from 'date-fns';

const SIZE = 20;

const TARGET_TYPES = ['', 'SONG', 'USER', 'REPORT', 'GENRE', 'PAYMENT', 'SYSTEM'];

const TYPE_QUICK_TABS = [
  { key: '',       label: 'All' },
  { key: 'SONG',   label: 'Songs' },
  { key: 'USER',   label: 'Users' },
  { key: 'REPORT', label: 'Reports' },
  { key: 'GENRE',  label: 'Genres' },
];

const TYPE_PILL: Record<string, { bg: string; color: string }> = {
  SONG:    { bg: 'var(--accent-light)',  color: 'var(--accent)' },
  USER:    { bg: 'var(--cyan-light)',    color: 'var(--cyan)' },
  REPORT:  { bg: 'var(--danger-light)',  color: 'var(--danger)' },
  GENRE:   { bg: 'var(--success-light)', color: 'var(--success)' },
  PAYMENT: { bg: 'var(--purple-light)',  color: 'var(--purple)' },
  SYSTEM:  { bg: 'var(--warning-light)', color: 'var(--warning)' },
};

function adminInitials(email: string | null | undefined): string {
  if (!email) return '??';
  const local = email.split('@')[0];
  const parts = local.split(/[._\-]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase();
}

function exportCSV(items: AuditLog[]) {
  const header = '"Admin","Action","Target Type","Target ID","Notes","Timestamp"\n';
  const rows = items
    .map((l) =>
      [
        l.adminEmail,
        l.action,
        l.targetType ?? '',
        l.targetId ?? '',
        (l.notes ?? '').replace(/"/g, '""'),
        format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      ]
        .map((v) => `"${v}"`)
        .join(','),
    )
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [action, setAction]         = useState('');
  const [targetType, setTargetType] = useState('');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [page, setPage]             = useState(1);

  const hasFilters = !!(action || targetType || from || to);

  const clearFilters = () => {
    setAction(''); setTargetType(''); setFrom(''); setTo(''); setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action, targetType, from, to, page],
    queryFn: () => adminApi.getAuditLogs({
      action: action || undefined,
      targetType: targetType || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      size: SIZE,
    }),
    select: (r) => r.data,
  });

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  };

  const COLS: Column<AuditLog>[] = [
    {
      key: 'adminEmail', header: 'Admin', width: 180,
      render: (l) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 'var(--radius-full)', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
          }}>
            {adminInitials(l.adminEmail)}
          </div>
          <span style={{
            fontSize: 12, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130,
          }}>
            {l.adminEmail ?? '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'action', header: 'Action', width: 180,
      render: (l) => (
        <span style={{
          display: 'inline-block', fontFamily: 'monospace', fontSize: 11,
          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-subtle)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', whiteSpace: 'nowrap',
        }}>
          {l.action}
        </span>
      ),
    },
    {
      key: 'targetType', header: 'Target Type', width: 120,
      render: (l) => {
        if (!l.targetType) {
          return <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>;
        }
        const cfg = TYPE_PILL[l.targetType] ?? { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' };
        return (
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color,
          }}>
            {l.targetType}
          </span>
        );
      },
    },
    {
      key: 'targetId', header: 'Target ID', width: 160,
      render: (l) => l.targetId ? (
        <span style={{
          fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 144,
        }}>
          {l.targetId}
        </span>
      ) : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>,
    },
    {
      key: 'notes', header: 'Notes',
      render: (l) => (
        <span style={{
          fontSize: 13, color: 'var(--text-muted)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 200,
        }}>
          {l.notes ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Timestamp', width: 150,
      render: (l) => (
        <span
          title={l.createdAt}
          style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', cursor: 'default' }}
        >
          {format(new Date(l.createdAt), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Audit Log</h1>
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-subtle)', color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}>
            Read only
          </span>
        </div>
        <button
          onClick={() => data?.items?.length && exportCSV(data.items)}
          disabled={!data?.items?.length}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--radius)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 13,
            cursor: data?.items?.length ? 'pointer' : 'not-allowed',
            opacity: data?.items?.length ? 1 : 0.5, transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            if (data?.items?.length) {
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.borderColor = 'var(--border-2)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search action…"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 160 }}
        />
        <select
          value={targetType}
          onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 140, cursor: 'pointer' }}
        >
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>{t || 'All types'}</option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 140, colorScheme: 'light' as React.CSSProperties['colorScheme'] }}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 140, colorScheme: 'light' as React.CSSProperties['colorScheme'] }}
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{
              padding: '7px 10px', background: 'none', border: 'none',
              color: 'var(--accent)', fontSize: 13, cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Quick tab filter — keeps select + tabs in sync */}
      <StatusTabs
        tabs={TYPE_QUICK_TABS}
        active={targetType}
        onChange={(k) => { setTargetType(k); setPage(1); }}
      />

      <DataTable
        columns={COLS}
        data={data?.items ?? []}
        loading={isLoading}
        rowKey={(l) => l.id}
        page={page}
        size={SIZE}
        totalItems={data?.totalItems ?? 0}
        onPageChange={setPage}
        emptyIcon={ScrollText}
        emptyMessage="No audit entries found"
      />

    </div>
  );
}
