'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Bell, Music, Flag, Tag, CheckCircle2, ChevronRight } from 'lucide-react';
import { adminApi, type GenreSuggestion, type Paginated, type AdminSong, type Report } from '@/lib/api/admin.api';

// ── Shared query keys — must match AdminSidebar.tsx ───────────────────────
export const BADGE_QUERY_KEYS = {
  pendingSongs:    ['admin', 'badge', 'pending-songs']    as const,
  pendingReports:  ['admin', 'badge', 'pending-reports']  as const,
  genreSuggestions:['admin', 'genre-suggestions']         as const,
};

const QUERY_OPTIONS = { refetchInterval: 30_000, staleTime: 20_000 };

// ── NotificationItem ──────────────────────────────────────────────────────

interface NotificationItemProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  label: string;
  onClick: () => void;
}

function NotificationItem({ icon, iconBg, title, label, onClick }: NotificationItemProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: hovered ? 'var(--bg-subtle)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      {/* Icon area */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius)',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {label}
        </div>
      </div>

      <ChevronRight size={14} color="var(--text-faint)" style={{ flexShrink: 0 }} />
    </div>
  );
}

// ── NotificationBell ──────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pending songs count
  const { data: songsData } = useQuery<Paginated<AdminSong>>({
    queryKey: BADGE_QUERY_KEYS.pendingSongs,
    queryFn: () => adminApi.getSongs({ status: 'PENDING', page: 1, size: 1 }).then((r) => r.data),
    ...QUERY_OPTIONS,
  });

  // Pending reports count
  const { data: reportsData } = useQuery<Paginated<Report>>({
    queryKey: BADGE_QUERY_KEYS.pendingReports,
    queryFn: () => adminApi.getReports({ status: 'PENDING', page: 1, size: 1 }).then((r) => r.data),
    ...QUERY_OPTIONS,
  });

  // Genre suggestions (plain array — filter PENDING client-side)
  const { data: suggestionsData } = useQuery<GenreSuggestion[]>({
    queryKey: BADGE_QUERY_KEYS.genreSuggestions,
    queryFn: () => adminApi.getGenreSuggestions().then((r) => r.data),
    ...QUERY_OPTIONS,
  });

  const pendingSongs   = songsData?.totalItems ?? 0;
  const pendingReports = reportsData?.totalItems ?? 0;
  const pendingGenres  = (suggestionsData ?? []).filter((s) => s.status === 'PENDING').length;
  const totalUnread    = pendingSongs + pendingReports + pendingGenres;

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  const hasItems = pendingSongs > 0 || pendingReports > 0 || pendingGenres > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          padding: 8,
          borderRadius: 'var(--radius)',
          background: 'transparent',
          border: '1px solid transparent',
          transition: 'all 150ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-subtle)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <Bell
          size={20}
          color={open ? 'var(--accent)' : 'var(--text-muted)'}
          strokeWidth={1.8}
        />

        {/* Unread badge */}
        {totalUnread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              borderRadius: 'var(--radius-full)',
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--surface)',
              padding: '0 3px',
              animation: 'pulse-badge 2s infinite',
              lineHeight: 1,
            }}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="animate-scale-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Pending Actions
            </span>
          </div>

          {/* Items */}
          {hasItems ? (
            <>
              {pendingSongs > 0 && (
                <NotificationItem
                  icon={<Music size={16} color="var(--warning)" />}
                  iconBg="var(--warning-light)"
                  title="Songs pending approval"
                  label={`${pendingSongs} song${pendingSongs === 1 ? '' : 's'} waiting for review`}
                  onClick={() => navigate('/songs')}
                />
              )}
              {pendingReports > 0 && (
                <NotificationItem
                  icon={<Flag size={16} color="var(--danger)" />}
                  iconBg="var(--danger-light)"
                  title="Open reports"
                  label={`${pendingReports} report${pendingReports === 1 ? '' : 's'} need attention`}
                  onClick={() => navigate('/reports')}
                />
              )}
              {pendingGenres > 0 && (
                <NotificationItem
                  icon={<Tag size={16} color="var(--accent)" />}
                  iconBg="var(--accent-light)"
                  title="Genre suggestions"
                  label={`${pendingGenres} suggestion${pendingGenres === 1 ? '' : 's'} to review`}
                  onClick={() => navigate('/genres')}
                />
              )}
            </>
          ) : (
            /* Empty state */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 16px',
              gap: 8,
            }}>
              <CheckCircle2 size={32} color="var(--success)" strokeWidth={1.5} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                All caught up!
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                No pending actions
              </p>
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => navigate('/audit')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 13,
                color: 'var(--accent)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
            >
              View audit log →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
