'use client';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api/auth.api';
import { Monitor, Smartphone, Tablet, Wifi, Trash2, Loader2 } from 'lucide-react';

interface Session {
  id: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'OTHER';
  deviceName: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  createdAt: string;
}

function DeviceIcon({ type }: { type: Session['deviceType'] }) {
  const style = { color: 'var(--gold)', flexShrink: 0 };
  if (type === 'MOBILE') return <Smartphone size={18} style={style} />;
  if (type === 'TABLET') return <Tablet size={18} style={style} />;
  if (type === 'DESKTOP') return <Monitor size={18} style={style} />;
  return <Wifi size={18} style={style} />;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await authApi.getSessions();
      const data = (res.data as any)?.data ?? res.data;
      setSessions(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await authApi.revokeSession(id);
      setSessions((s) => s.filter((x) => x.id !== id));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div style={{ maxWidth: 680, padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div className="anim-fade-up anim-fade-up-1 mb-8">
        <p style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Security
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 300, color: 'var(--ivory)', marginBottom: 6 }}>
          Active sessions
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
          Devices currently signed in to your account. Revoke any you don&apos;t recognize.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 anim-fade-up" style={{ color: 'var(--muted-text)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '0.85rem' }}>Loading sessions…</span>
        </div>
      ) : sessions.length === 0 ? (
        <div
          className="anim-fade-up"
          style={{
            padding: '24px', border: '1px solid #1e1e1e', borderRadius: 6,
            textAlign: 'center', color: 'var(--muted-text)', fontSize: '0.85rem',
          }}
        >
          No active sessions found.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => (
            <div
              key={s.id}
              className={`anim-fade-up anim-fade-up-${Math.min(i + 2, 8)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px',
                background: '#111111',
                border: '1px solid #1e1e1e',
                borderRadius: 6,
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2a2520')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e1e')}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(232,184,75,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <DeviceIcon type={s.deviceType} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--ivory)', marginBottom: 3, fontWeight: 500 }}>
                  {s.deviceName ? s.deviceName.slice(0, 60) : s.deviceType.toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {s.ipAddress && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)' }}>{s.ipAddress}</span>
                  )}
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)' }}>
                    Last seen {timeAgo(s.lastSeenAt)}
                  </span>
                </div>
              </div>

              {/* Revoke */}
              <button
                type="button"
                onClick={() => revoke(s.id)}
                disabled={revoking === s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px',
                  background: 'transparent',
                  border: '1px solid #2a2520',
                  borderRadius: 4,
                  color: revoking === s.id ? 'var(--muted-text)' : '#c97070',
                  fontSize: '0.75rem',
                  cursor: revoking === s.id ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (revoking !== s.id) {
                    e.currentTarget.style.borderColor = '#c97070';
                    e.currentTarget.style.background = 'rgba(201,112,112,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2a2520';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {revoking === s.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="anim-fade-up mt-6">
          <button
            type="button"
            onClick={async () => {
              for (const s of sessions) await revoke(s.id);
            }}
            style={{
              fontSize: '0.78rem', color: 'var(--muted-text)',
              background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline', textDecorationColor: '#2a2520',
            }}
          >
            Revoke all sessions
          </button>
        </div>
      )}
    </div>
  );
}
