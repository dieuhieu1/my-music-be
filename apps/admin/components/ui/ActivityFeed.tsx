'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin.api';
import { formatDistanceToNow } from 'date-fns';

const ACTION_COLOR: Record<string, string> = {
  SONG_APPROVED:    'var(--success)',
  SONG_REJECTED:    'var(--danger)',
  SONG_TAKEDOWN:    'var(--danger)',
  SONG_RESTORED:    'var(--success)',
  USER_ROLE_UPDATED:'var(--purple)',
  PREMIUM_GRANTED:  'var(--warning)',
  PREMIUM_REVOKED:  'var(--danger)',
  REPORT_DISMISSED: 'var(--text-faint)',
  REPORT_TAKEDOWN:  'var(--danger)',
  GENRE_APPROVED:   'var(--success)',
  GENRE_REJECTED:   'var(--danger)',
};

function dotColor(action: string) {
  for (const [key, color] of Object.entries(ACTION_COLOR)) {
    if (action.includes(key)) return color;
  }
  return 'var(--accent)';
}

function formatAction(action: string) {
  return action
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function ActivityFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => adminApi.getAuditLogs({ size: 20 }),
    refetchInterval: 30_000,
    select: (r) => r.data.items,
  });

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Recent Activity</h3>
      </div>

      <div style={{ padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 16px' }}>
              <div className="skeleton" style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 8, width: '30%' }} />
              </div>
            </div>
          ))
          : !data?.length
            ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
                No activity yet
              </div>
            )
            : data.map((log, i) => (
              <div
                key={log.id}
                className="anim-fade-up"
                style={{
                  display: 'flex', gap: 12, padding: '8px 16px',
                  position: 'relative',
                  animationDelay: `${Math.min(i, 7) * 30}ms`,
                }}
              >
                {/* Timeline line */}
                {i < data.length - 1 && (
                  <div style={{
                    position: 'absolute', left: 19, top: 20, bottom: -8,
                    width: 1, background: 'var(--border)',
                  }} />
                )}

                {/* Dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: dotColor(log.action), marginTop: 5,
                  boxShadow: `0 0 0 2px var(--surface)`,
                  zIndex: 1,
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{log.adminEmail?.split('@')[0]}</span>
                    {' · '}
                    <span>{formatAction(log.action)}</span>
                  </p>
                  {log.notes && (
                    <p className="truncate" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                      {log.notes}
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3 }}>
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
