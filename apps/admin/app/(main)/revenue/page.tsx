'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, BarChart2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { adminApi } from '@/lib/api/admin.api';
import type { PaymentRecord } from '@/lib/api/admin.api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { BarChart } from '@/components/charts/BarChart';

const PAGE_SIZE = 20;
const CIRCUMFERENCE = 2 * Math.PI * 60;

// ── Formatters ─────────────────────────────────────────────────────────────

function formatVND(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function shortVND(n: number): string {
  if (n >= 1_000_000_000) return `₫${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `₫${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `₫${(n / 1_000).toFixed(0)}K`;
  return `₫${n}`;
}

function planLabel(premiumType: string | null): string {
  if (!premiumType) return 'Custom grant';
  const map: Record<string, string> = {
    ONE_MONTH: '1 month', THREE_MONTH: '3 months',
    SIX_MONTH: '6 months', TWELVE_MONTH: '12 months',
    MONTHLY: '1 month', QUARTERLY: '3 months',
    SEMI_ANNUAL: '6 months', ANNUAL: '12 months',
  };
  return map[premiumType] ?? premiumType;
}

// ── Donut chart ────────────────────────────────────────────────────────────

interface DonutSegment { label: string; color: string; amount: number; fraction: number; }

const PROVIDER_COLORS: Record<string, string> = {
  VNPAY: '#6366F1',
  MOMO:  '#10B981',
  ADMIN: '#8B5CF6',
};

function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, g) => s + g.amount, 0);

  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <svg viewBox="0 0 160 160" width={160} height={160}>
          <circle
            cx={80} cy={80} r={60} fill="none"
            stroke="var(--border)" strokeWidth={24}
          />
          <text x={80} y={86} textAnchor="middle"
            style={{ fontSize: 11, fill: 'var(--text-faint)', fontFamily: 'Inter, sans-serif' }}>
            No data
          </text>
        </svg>
      </div>
    );
  }

  let cumulativeAngle = -90;
  const rendered = segments.map((seg) => {
    const dashLen  = seg.fraction * CIRCUMFERENCE;
    const rotation = cumulativeAngle;
    cumulativeAngle += seg.fraction * 360;
    return { ...seg, dashLen, rotation };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox="0 0 160 160" width={160} height={160}>
          {rendered.map((seg, i) => (
            <circle
              key={i}
              cx={80} cy={80} r={60}
              fill="none"
              stroke={seg.color}
              strokeWidth={24}
              strokeDasharray={`${seg.dashLen} ${CIRCUMFERENCE}`}
              strokeDashoffset={0}
              transform={`rotate(${seg.rotation} 80 80)`}
            />
          ))}
          <text
            x={80} y={74} textAnchor="middle"
            style={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'Inter, sans-serif' }}
          >
            Total
          </text>
          <text
            x={80} y={90} textAnchor="middle"
            style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text)', fontFamily: 'Inter, sans-serif' }}
          >
            {shortVND(total)}
          </text>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, padding: '0 8px' }}>
        {rendered.map((seg) => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {shortVND(seg.amount)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 38, textAlign: 'right' }}>
              {(seg.fraction * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, string | undefined> = {
  vnpay: 'VNPAY', momo: 'MOMO', admin: 'ADMIN',
};

const PROVIDER_TABS = [
  { key: '',      label: 'All' },
  { key: 'vnpay', label: 'VNPay' },
  { key: 'momo',  label: 'MoMo' },
  { key: 'admin', label: 'Manual Grant' },
];

const PROVIDER_PILL: Record<string, { bg: string; color: string }> = {
  VNPAY: { bg: 'var(--accent-light)',  color: 'var(--accent)' },
  MOMO:  { bg: 'var(--success-light)', color: 'var(--success)' },
  ADMIN: { bg: 'var(--purple-light)',  color: 'var(--purple)' },
};

export default function RevenuePage() {
  const [providerTab, setProviderTab] = useState('');
  const [tablePage, setTablePage]     = useState(1);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['revenue', 'summary'],
    queryFn: () => adminApi.getRevenueSummary(),
    select: (r) => r.data,
  });

  const providerParam = PROVIDER_MAP[providerTab];

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['revenue', 'payments', providerTab, tablePage],
    queryFn: () => adminApi.getPayments({
      status: 'SUCCESS',
      provider: providerParam,
      page: tablePage,
      size: PAGE_SIZE,
    }),
    select: (r) => r.data,
  });

  // Build chart data from summary
  const monthlyChartData = (summary?.last6Months ?? []).map((m) => ({
    label: m.month,
    value: m.total,
  }));

  const donutSegments: DonutSegment[] = (() => {
    const allTime = summary?.allTime ?? 0;
    if (allTime === 0) return [];
    return (summary?.byProvider ?? [])
      .map((p) => ({
        label:    p.provider === 'ADMIN' ? 'Manual' : p.provider.charAt(0) + p.provider.slice(1).toLowerCase(),
        color:    PROVIDER_COLORS[p.provider] ?? '#9CA3AF',
        amount:   p.total,
        fraction: allTime > 0 ? p.total / allTime : 0,
      }))
      .filter((s) => s.amount > 0);
  })();

  const COLS: Column<PaymentRecord>[] = [
    {
      key: 'userEmail', header: 'User', width: 200,
      render: (p) => {
        const initials = (p.userEmail ?? '??').split('@')[0].slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 'var(--radius-full)', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#fff',
            }}>
              {initials}
            </div>
            <span style={{
              fontSize: 13, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 155,
            }}>
              {p.userEmail ?? '—'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'provider', header: 'Provider', width: 120,
      render: (p) => {
        const cfg = PROVIDER_PILL[p.provider] ?? { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' };
        return (
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: cfg.bg, color: cfg.color,
          }}>
            {p.provider}
          </span>
        );
      },
    },
    {
      key: 'amountVnd', header: 'Amount', width: 160,
      render: (p) => (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          {formatVND(p.amountVnd)}
        </span>
      ),
    },
    {
      key: 'premiumType', header: 'Plan', width: 110,
      render: (p) => (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{planLabel(p.premiumType)}</span>
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
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Revenue</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Financial overview</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard
          label="Today's Revenue"
          value={shortVND(summary?.today ?? 0)}
          icon={TrendingUp}
          iconColor="var(--accent)"
          iconBg="var(--accent-light)"
          loading={summaryLoading}
        />
        <StatCard
          label="This Month"
          value={shortVND(summary?.thisMonth ?? 0)}
          icon={Calendar}
          iconColor="var(--success)"
          iconBg="var(--success-light)"
          loading={summaryLoading}
        />
        <StatCard
          label="This Year"
          value={shortVND(summary?.thisYear ?? 0)}
          icon={BarChart2}
          iconColor="var(--purple)"
          iconBg="var(--purple-light)"
          loading={summaryLoading}
        />
        <StatCard
          label="All Time"
          value={shortVND(summary?.allTime ?? 0)}
          icon={DollarSign}
          iconColor="var(--cyan)"
          iconBg="var(--cyan-light)"
          loading={summaryLoading}
        />
      </div>

      {/* Charts row — 60/40 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <BarChart
          data={monthlyChartData}
          title="Monthly Revenue"
          subtitle="Last 6 months"
          color="var(--accent)"
          height={180}
          formatValue={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
            : v >= 1_000  ? `${(v / 1_000).toFixed(0)}K`
            : String(v)
          }
        />

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
            Revenue by Provider
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Success payments only
          </p>
          {summaryLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="skeleton" style={{ width: 160, height: 160, borderRadius: 'var(--radius-full)' }} />
            </div>
          ) : (
            <DonutChart segments={donutSegments} />
          )}
        </div>
      </div>

      {/* Successful payments table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Successful Payments
          </h2>
          {(paymentsData?.totalItems ?? 0) > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--success-light)', color: 'var(--success)',
            }}>
              {paymentsData!.totalItems} total
            </span>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <StatusTabs
            tabs={PROVIDER_TABS}
            active={providerTab}
            onChange={(k) => { setProviderTab(k); setTablePage(1); }}
          />
        </div>

        <DataTable
          columns={COLS}
          data={paymentsData?.items ?? []}
          loading={paymentsLoading}
          rowKey={(p) => p.id}
          page={tablePage}
          size={PAGE_SIZE}
          totalItems={paymentsData?.totalItems ?? 0}
          onPageChange={setTablePage}
          emptyIcon={TrendingUp}
          emptyMessage="No successful payments found"
        />
      </div>

    </div>
  );
}
