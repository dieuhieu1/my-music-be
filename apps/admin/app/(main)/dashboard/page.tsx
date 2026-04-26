'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, Music2, Flag, CreditCard } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import { format } from 'date-fns';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>
          {loading ? '—' : value}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'users', 'count'],
    queryFn: async () => (await adminApi.getUsers({ size: 1 })).data,
    staleTime: 60_000,
  });

  const { data: pendingSongsData, isLoading: loadingSongs } = useQuery({
    queryKey: ['admin', 'songs', 'pending-count'],
    queryFn: async () => (await adminApi.getSongs({ status: 'PENDING', size: 1 })).data,
    staleTime: 60_000,
  });

  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ['admin', 'reports', 'open-count'],
    queryFn: async () => (await adminApi.getReports({ status: 'PENDING', size: 1 })).data,
    staleTime: 60_000,
  });

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['admin', 'payments', 'stats'],
    queryFn: async () => (await adminApi.getPayments({ status: 'COMPLETED', size: 100 })).data,
    staleTime: 300_000,
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ['admin', 'audit', 'recent'],
    queryFn: async () => (await adminApi.getAuditLogs({ size: 10 })).data,
    staleTime: 30_000,
  });

  const totalRevenue =
    paymentsData?.items
      .reduce((sum, p) => sum + (p.amountVnd ?? 0), 0)
      .toLocaleString('vi-VN') ?? '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          label="Total Users"
          value={usersData?.totalItems ?? 0}
          icon={Users}
          color="#2563EB"
          loading={loadingUsers}
        />
        <StatCard
          label="Pending Songs"
          value={pendingSongsData?.totalItems ?? 0}
          icon={Music2}
          color="#D97706"
          loading={loadingSongs}
        />
        <StatCard
          label="Open Reports"
          value={reportsData?.totalItems ?? 0}
          icon={Flag}
          color="#DC2626"
          loading={loadingReports}
        />
        <StatCard
          label="Total Revenue (VND)"
          value={totalRevenue}
          icon={CreditCard}
          color="#16A34A"
          loading={loadingPayments}
        />
      </div>

      {/* Recent audit activity */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
            Recent Activity
          </h2>
        </div>
        <div>
          {loadingAudit ? (
            <p style={{ padding: '32px 20px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              Loading…
            </p>
          ) : auditData?.items.length === 0 ? (
            <p style={{ padding: '32px 20px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              No recent activity.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#F9FAFB' }}>
                  {['Admin', 'Action', 'Target', 'Date'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 20px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6B7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditData?.items.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#374151' }}>
                      {log.adminEmail}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#111827', fontWeight: 500 }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#6B7280' }}>
                      {log.targetType ? `${log.targetType}:${log.targetId}` : '—'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: '#9CA3AF' }}>
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
