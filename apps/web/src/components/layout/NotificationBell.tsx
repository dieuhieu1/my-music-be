'use client';

import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Check, Music2, Zap, Star, AlertCircle, Download, Radio, X, BellOff, CalendarDays } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationsApi } from '@/lib/api/notifications.api';
import { formatDistanceToNow } from 'date-fns';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
    case 'SONG_APPROVED':     return <Music2    size={13} />;
    case 'SONG_REJECTED':     return <X         size={13} />;
    case 'SONG_REUPLOAD_REQUIRED': return <AlertCircle size={13} />;
    case 'SONG_RESTORED':     return <Check     size={13} />;
    case 'PREMIUM_ACTIVATED': return <Star      size={13} />;
    case 'PREMIUM_REVOKED':   return <X         size={13} />;
    case 'UPCOMING_DROP':     return <Radio     size={13} />;
    case 'NEW_RELEASE':       return <Zap       size={13} />;
    case 'DROP_CANCELLED':    return <BellOff   size={13} />;
    case 'DROP_RESCHEDULED':  return <CalendarDays size={13} />;
    default:                  return <Bell      size={13} />;
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

export default function NotificationBell() {
  const { locale } = useParams<{ locale: string }>();
  const { unreadCount, refetch } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res  = await notificationsApi.getNotifications(1, 10);
      const data = res.data?.data ?? res.data;
      setItems(data?.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

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

  const hasUnread = unreadCount > 0;

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          style={{
            position: 'relative',
            width: 34, height: 34, borderRadius: '50%',
            background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${hasUnread ? 'rgba(232,184,75,0.3)' : 'rgba(255,255,255,0.06)'}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: hasUnread ? 'var(--gold)' : 'var(--muted-text)',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            outline: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--ivory)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = hasUnread ? 'var(--gold)' : 'var(--muted-text)'; }}
        >
          <Bell size={15} />
          {hasUnread && (
            <span
              className={unreadCount > 0 ? 'email-pulse-icon' : ''}
              style={{
                position: 'absolute', top: -3, right: -3,
                minWidth: 16, height: 16,
                background: 'var(--gold)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.55rem', fontWeight: 700,
                color: '#0d0d0d',
                border: '1.5px solid var(--charcoal)',
                padding: '0 3px',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="anim-fade-up"
          align="end"
          sideOffset={8}
          style={{
            width: 320,
            background: 'var(--surface-2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            zIndex: 55,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '0.9rem',
              fontWeight: 500, color: 'var(--ivory)',
            }}>
              Notifications
            </span>
            {items.some(n => !n.isRead) && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                style={{
                  fontSize: '0.68rem', color: 'var(--gold)',
                  background: 'none', border: 'none',
                  cursor: markingAll ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  opacity: markingAll ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
                <div
                  className="vinyl-spin"
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
                    border: '2px solid rgba(232,184,75,0.2)',
                  }}
                />
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <Check size={22} style={{ color: 'var(--muted-text)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>You're all caught up</p>
              </div>
            ) : (
              items.map((n, i) => (
                <DropdownMenu.Item
                  key={n.id}
                  asChild
                  onSelect={() => { if (!n.isRead) handleMarkRead(n.id); }}
                >
                  <div
                    className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 11,
                      padding: '12px 16px',
                      background: n.isRead ? 'transparent' : 'rgba(232,184,75,0.04)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      outline: 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(232,184,75,0.04)'; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 26, height: 26, flexShrink: 0,
                      borderRadius: '50%',
                      background: n.isRead ? 'rgba(255,255,255,0.05)' : 'rgba(232,184,75,0.1)',
                      border: `1px solid ${n.isRead ? 'rgba(255,255,255,0.06)' : 'rgba(232,184,75,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: n.isRead ? 'var(--muted-text)' : 'var(--gold)',
                    }}>
                      {notifIcon(n.type)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.78rem',
                        color: n.isRead ? 'var(--muted-text)' : 'var(--ivory)',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {notifLabel(n)}
                      </p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--muted-text)', marginTop: 2 }}>
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--gold)', flexShrink: 0, marginTop: 6,
                      }} />
                    )}
                  </div>
                </DropdownMenu.Item>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Link
                href={`/${locale}/notifications`}
                style={{
                  display: 'block', textAlign: 'center',
                  fontSize: '0.72rem', color: 'var(--gold)',
                  textDecoration: 'none',
                  letterSpacing: '0.04em',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                View all notifications
              </Link>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
