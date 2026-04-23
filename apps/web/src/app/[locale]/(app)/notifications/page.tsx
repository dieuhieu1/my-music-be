'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Bell, Check, Music2, Zap, Star, AlertCircle, Radio, X, BellOff, CalendarDays } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications.api';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';

interface Notification {
  id: string;
  type: string;
  isRead: boolean;
  payload: Record<string, string>;
  createdAt: string;
  title?: string;
  body?: string;
}

function notifIcon(type: string) {
  switch (type) {
    case 'SONG_APPROVED':          return <Music2       size={14} />;
    case 'SONG_REJECTED':          return <X            size={14} />;
    case 'SONG_REUPLOAD_REQUIRED': return <AlertCircle  size={14} />;
    case 'SONG_RESTORED':          return <Check        size={14} />;
    case 'PREMIUM_ACTIVATED':      return <Star         size={14} />;
    case 'PREMIUM_REVOKED':        return <X            size={14} />;
    case 'UPCOMING_DROP':          return <Radio        size={14} />;
    case 'NEW_RELEASE':            return <Zap          size={14} />;
    case 'DROP_CANCELLED':         return <BellOff      size={14} />;
    case 'DROP_RESCHEDULED':       return <CalendarDays size={14} />;
    default:                       return <Bell         size={14} />;
  }
}

function notifLabel(n: Notification): string {
  if (n.title) return n.title;
  const p = n.payload;
  switch (n.type) {
    case 'SONG_APPROVED':          return `"${p.songTitle}" approved`;
    case 'SONG_REJECTED':          return `"${p.songTitle}" rejected`;
    case 'SONG_REUPLOAD_REQUIRED': return `Reupload needed for "${p.songTitle}"`;
    case 'SONG_RESTORED':          return `"${p.songTitle}" restored`;
    case 'PREMIUM_ACTIVATED':      return 'Premium activated';
    case 'PREMIUM_REVOKED':        return 'Premium revoked';
    case 'UPCOMING_DROP':          return `"${p.songTitle}" dropping soon`;
    case 'NEW_RELEASE':            return `"${p.songTitle}" is now live`;
    case 'DROP_CANCELLED':         return `Drop cancelled for "${p.songTitle}"`;
    case 'DROP_RESCHEDULED':       return `Drop rescheduled for "${p.songTitle}"`;
    default:                       return 'New notification';
  }
}

function notifBody(n: Notification): string | null {
  if (n.body) return n.body;
  return null;
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { refetch } = useNotifications();

  const [items, setItems]         = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res  = await notificationsApi.getNotifications(p, PAGE_SIZE);
      const data = res.data?.data ?? res.data;
      if (p === 1) {
        setItems(data?.items ?? []);
      } else {
        setItems(prev => [...prev, ...(data?.items ?? [])]);
      }
      setTotal(data?.total ?? 0);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      refetch();
    } catch {}
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllAsRead();
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
      refetch();
    } catch {
    } finally {
      setMarkingAll(false);
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next);
  };

  const hasUnread = items.some(n => !n.isRead);
  const hasMore   = items.length < total;

  return (
    <div style={{ padding: '32px 28px', maxWidth: 720, margin: '0 auto' }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(232,184,75,0.08)',
              border: '1px solid rgba(232,184,75,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={16} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.55rem', fontWeight: 500,
                color: 'var(--ivory)',
              }}>
                Notifications
              </h1>
              {total > 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--muted-text)', marginTop: 2 }}>
                  {total} {total === 1 ? 'notification' : 'notifications'}
                </p>
              )}
            </div>
          </div>

          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={markingAll}
              style={{
                padding: '7px 16px', borderRadius: 20,
                background: 'rgba(232,184,75,0.06)',
                border: '1px solid rgba(232,184,75,0.2)',
                color: 'var(--gold)', fontSize: '0.75rem',
                fontFamily: 'var(--font-body)',
                cursor: markingAll ? 'not-allowed' : 'pointer',
                opacity: markingAll ? 0.5 : 1,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!markingAll) { e.currentTarget.style.background = 'rgba(232,184,75,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.35)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.06)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.2)'; }}
            >
              {markingAll ? 'Marking…' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* ── Loading (initial) ─────────────────────────────────────────────── */}
      {loading && items.length === 0 && (
        <div style={{ padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="vinyl-spin" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
          <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Loading…</p>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && items.length === 0 && (
        <div
          className="anim-fade-up anim-fade-up-2"
          style={{
            padding: '64px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12,
          }}
        >
          <Check size={36} style={{ color: 'var(--muted-text)', opacity: 0.5 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--ivory)' }}>
            You're all caught up
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)', textAlign: 'center', maxWidth: 280 }}>
            No notifications yet. We'll let you know when something happens.
          </p>
        </div>
      )}

      {/* ── Notification list ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {items.map((n, i) => (
            <div
              key={n.id}
              className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
              onClick={() => { if (!n.isRead) handleMarkRead(n.id); }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '16px 20px',
                background: n.isRead ? 'transparent' : 'rgba(232,184,75,0.03)',
                borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: n.isRead ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(232,184,75,0.03)'; }}
            >
              {/* Icon circle */}
              <div style={{
                width: 32, height: 32, flexShrink: 0,
                borderRadius: '50%',
                background: n.isRead ? 'rgba(255,255,255,0.04)' : 'rgba(232,184,75,0.1)',
                border: `1px solid ${n.isRead ? 'rgba(255,255,255,0.06)' : 'rgba(232,184,75,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: n.isRead ? 'var(--muted-text)' : 'var(--gold)',
                marginTop: 1,
              }}>
                {notifIcon(n.type)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '0.85rem',
                  color: n.isRead ? 'var(--muted-text)' : 'var(--ivory)',
                  lineHeight: 1.4,
                  marginBottom: notifBody(n) ? 4 : 0,
                }}>
                  {notifLabel(n)}
                </p>
                {notifBody(n) && (
                  <p style={{
                    fontSize: '0.75rem', color: 'var(--muted-text)',
                    lineHeight: 1.45, marginBottom: 4,
                  }}>
                    {notifBody(n)}
                  </p>
                )}
                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>

              {/* Unread dot */}
              {!n.isRead && (
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--gold)', flexShrink: 0, marginTop: 8,
                }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Load more ────────────────────────────────────────────────────── */}
      {hasMore && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            style={{
              padding: '9px 28px', borderRadius: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: loading ? 'var(--muted-text)' : 'var(--ivory)',
              fontSize: '0.78rem', fontFamily: 'var(--font-body)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
