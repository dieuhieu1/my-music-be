'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Users, Music, Clock, Flag, Crown, TrendingUp, Tag, ChevronRight,
} from 'lucide-react';
import {
  format, subDays, eachDayOfInterval, subMonths, getMonth, getYear,
} from 'date-fns';
import { adminApi } from '@/lib/api/admin.api';
import { StatCard } from '@/components/ui/StatCard';
import { ActivityFeed } from '@/components/ui/ActivityFeed';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';

// ── Chart helpers ──────────────────────────────────────────────────────────

function buildDailyData(items: { createdAt: string }[], days = 30) {
  const now  = new Date();
  const range = eachDayOfInterval({ start: subDays(now, days - 1), end: now });
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const key = format(new Date(item.createdAt), 'yyyy-MM-dd');
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return range.map((d) => ({
    label: format(d, 'MMM d'),
    value: counts[format(d, 'yyyy-MM-dd')] ?? 0,
  }));
}

function buildMonthlyRevenue(items: { createdAt: string; amountVnd: number | null; status: string }[]) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    return { label: format(d, 'MMM'), year: getYear(d), month: getMonth(d), total: 0 };
  });
  items.forEach((item) => {
    if (item.status !== 'SUCCESS') return;
    const d = new Date(item.createdAt);
    const m = months.find((x) => x.year === getYear(d) && x.month === getMonth(d));
    if (m) m.total += item.amountVnd ?? 0;
  });
  return months.map((m) => ({ label: m.label, value: m.total }));
}

function formatVnd(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

// ── Quick Action button ────────────────────────────────────────────────────

function QuickActionBtn({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  sub,
  count,
  onClick,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  sub: string;
  count?: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '12px 14px', marginBottom: 8,
        borderRadius: 'var(--radius)',
        border: `1px solid ${hovered ? 'var(--border-2)' : 'var(--border)'}`,
        background: hovered ? 'var(--bg-subtle)' : 'var(--surface)',
        cursor: 'pointer', textAlign: 'left', transition: 'all 150ms',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '9999px', flexShrink: 0,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{sub}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span style={{
          background: 'var(--warning)', color: 'white',
          fontSize: 10, fontWeight: 700,
          padding: '1px 7px', borderRadius: 'var(--radius-full)',
          minWidth: 18, textAlign: 'center', flexShrink: 0,
        }}>
          {count}
        </span>
      )}
      <ChevronRight size={14} color="var(--text-faint)" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const { data: users,     isLoading: lu } = useQuery({ queryKey: ['dash', 'users'],    queryFn: () => adminApi.getUsers({ size: 1 }),                              select: (r) => r.data });
  const { data: liveSongs, isLoading: ll } = useQuery({ queryKey: ['dash', 'live'],     queryFn: () => adminApi.getSongs({ status: 'LIVE', size: 1 }),              select: (r) => r.data });
  const { data: pending,   isLoading: lp } = useQuery({ queryKey: ['dash', 'pending'],  queryFn: () => adminApi.getSongs({ status: 'PENDING', size: 1 }),           select: (r) => r.data });
  const { data: reports,   isLoading: lr } = useQuery({ queryKey: ['dash', 'reports'],  queryFn: () => adminApi.getReports({ status: 'PENDING', size: 1 }),         select: (r) => r.data });
  const { data: genres                   } = useQuery({ queryKey: ['dash', 'genres'],   queryFn: () => adminApi.getGenreSuggestions(),                              select: (r) => r.data.filter((g) => g.status === 'PENDING').length });

  const { data: allSongs    } = useQuery({ queryKey: ['dash', 'songs-chart'],    queryFn: () => adminApi.getSongs({ size: 100 }),    select: (r) => r.data.items });
  const { data: allPayments } = useQuery({ queryKey: ['dash', 'payments-chart'], queryFn: () => adminApi.getPayments({ size: 100 }), select: (r) => r.data.items });

  // Current month revenue
  const now = new Date();
  const thisMonth = getMonth(now);
  const thisYear  = getYear(now);
  const monthRevenue = (allPayments ?? [])
    .filter((p) =>
      p.status === 'SUCCESS' &&
      getMonth(new Date(p.createdAt)) === thisMonth &&
      getYear(new Date(p.createdAt))  === thisYear,
    )
    .reduce((s, p) => s + (p.amountVnd ?? 0), 0);

  const songsByDay     = buildDailyData(allSongs ?? []);
  const revenueByMonth = buildMonthlyRevenue(allPayments ?? []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Overview of your platform</p>
      </div>

      {/* Stat cards — 6 cols */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        <StatCard label="Total Users"     value={(users?.totalItems ?? 0).toLocaleString()}     icon={Users}     iconColor="var(--cyan)"    iconBg="var(--cyan-light)"    loading={lu} className="stagger-1" />
        <StatCard label="Songs Live"      value={(liveSongs?.totalItems ?? 0).toLocaleString()} icon={Music}     iconColor="var(--success)" iconBg="var(--success-light)" loading={ll} className="stagger-2" />
        <StatCard label="Pending Review"  value={(pending?.totalItems ?? 0).toLocaleString()}   icon={Clock}     iconColor="var(--warning)" iconBg="var(--warning-light)" loading={lp} className="stagger-3" />
        <StatCard label="Open Reports"    value={(reports?.totalItems ?? 0).toLocaleString()}   icon={Flag}      iconColor="var(--danger)"  iconBg="var(--danger-light)"  loading={lr} className="stagger-4" />
        <StatCard label="Premium Users"   value="—"                                             icon={Crown}     iconColor="var(--purple)"  iconBg="var(--purple-light)"  loading={false} className="stagger-5" />
        <StatCard label="Revenue (Month)" value={formatVnd(monthRevenue)}                       icon={TrendingUp} iconColor="var(--accent)" iconBg="var(--accent-light)"  loading={!allPayments} className="animate-fade-in-up" />
      </div>

      {/* Charts row — 60/40 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <LineChart
          data={songsByDay}
          title="Upload Trend"
          subtitle="Last 30 days"
          color="var(--accent)"
          height={160}
        />
        <BarChart
          data={revenueByMonth}
          title="Monthly Revenue"
          subtitle="Last 6 months"
          color="var(--success)"
          height={160}
          formatValue={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)}
        />
      </div>

      {/* Activity + Quick Actions — 60/40 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <ActivityFeed />

        {/* Quick actions */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>
            Quick Actions
          </h3>
          <QuickActionBtn
            icon={Music}
            iconBg="var(--warning-light)"
            iconColor="var(--warning)"
            label="Review pending songs"
            sub="Approve or reject submissions"
            count={pending?.totalItems}
            onClick={() => router.push('/songs?status=PENDING')}
          />
          <QuickActionBtn
            icon={Flag}
            iconBg="var(--danger-light)"
            iconColor="var(--danger)"
            label="Review open reports"
            sub="Handle flagged content"
            count={reports?.totalItems}
            onClick={() => router.push('/reports?status=PENDING')}
          />
          <QuickActionBtn
            icon={Tag}
            iconBg="var(--accent-light)"
            iconColor="var(--accent)"
            label="Approve genre suggestions"
            sub="Review user-submitted genres"
            count={genres ?? 0}
            onClick={() => router.push('/genres')}
          />
          <QuickActionBtn
            icon={Crown}
            iconBg="var(--purple-light)"
            iconColor="var(--purple)"
            label="Grant premium manually"
            sub="Manage premium subscriptions"
            onClick={() => router.push('/payments')}
          />
        </div>
      </div>
    </div>
  );
}
