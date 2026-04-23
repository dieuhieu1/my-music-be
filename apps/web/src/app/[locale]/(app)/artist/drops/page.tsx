'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Radio, Users, ExternalLink, X, CalendarDays } from 'lucide-react';
import { dropsApi } from '@/lib/api/drops.api';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';
import DropCountdown from '@/components/drops/DropCountdown';
import CancelDropModal from '@/components/drops/CancelDropModal';
import RescheduleDropModal from '@/components/drops/RescheduleDropModal';

interface DropItem {
  songId: string;
  title: string;
  coverArtUrl: string | null;
  dropAt: string;
  notifySubscriberCount: number;
  hasRescheduled?: boolean;
  artist: { id: string; stageName: string; avatarUrl?: string | null };
}

interface ToastMsg { text: string; kind: 'success' | 'warn' }

export default function ArtistDropsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole(Role.ADMIN);

  const [drops, setDrops]     = useState<DropItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<ToastMsg | null>(null);

  const [cancelModal, setCancelModal]     = useState<{ songId: string; title: string } | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{ songId: string; title: string; hasRescheduled: boolean } | null>(null);

  const showToast = (text: string, kind: ToastMsg['kind'] = 'success') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDrops = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await dropsApi.getDrops(1, 50);
      const data = res.data?.data ?? res.data;
      setDrops(data?.items ?? []);
    } catch {
      setDrops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDrops(); }, [loadDrops]);

  const handleCancelSuccess = () => {
    showToast('Drop cancelled — song returned to Approved status.');
    loadDrops();
  };

  const handleRescheduleSuccess = (requiresReApproval: boolean) => {
    if (requiresReApproval) {
      showToast('Rescheduled — song sent back for admin re-approval.', 'warn');
    } else {
      showToast('Drop rescheduled successfully.');
    }
    loadDrops();
  };

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="anim-fade-up"
          style={{
            position: 'fixed', top: 16, right: 20, zIndex: 70,
            padding: '12px 20px',
            background: toast.kind === 'warn' ? 'rgba(232,184,75,0.12)' : 'rgba(17,17,17,0.95)',
            border: `1px solid ${toast.kind === 'warn' ? 'rgba(232,184,75,0.3)' : 'rgba(232,184,75,0.15)'}`,
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontSize: '0.8rem',
            color: toast.kind === 'warn' ? 'var(--gold)' : 'var(--ivory)',
            maxWidth: 360,
          }}
        >
          {toast.text}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(232,184,75,0.08)',
            border: '1px solid rgba(232,184,75,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Radio size={16} style={{ color: 'var(--gold)' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.55rem', fontWeight: 500,
            color: 'var(--ivory)',
          }}>
            {isAdmin ? 'All Scheduled Drops' : 'My Drops'}
          </h1>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-text)', paddingLeft: 48 }}>
          {isAdmin
            ? 'All songs scheduled across all artists'
            : 'Manage your upcoming scheduled releases'}
        </p>
      </div>

      {/* ── Section label ──────────────────────────────────────────────────── */}
      {!loading && drops.length > 0 && (
        <div className="anim-fade-up anim-fade-up-1" style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        }}>
          <span style={{
            fontSize: '0.62rem', letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: 'rgba(232,184,75,0.35)',
          }}>
            {drops.length} scheduled {drops.length === 1 ? 'drop' : 'drops'}
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="vinyl-spin" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
          <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Loading drops…</p>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && drops.length === 0 && (
        <div
          className="anim-fade-up anim-fade-up-2"
          style={{
            padding: '60px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12,
          }}
        >
          <div className="vinyl-spin" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.15)',
            opacity: 0.5,
          }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--ivory)' }}>
            No scheduled drops
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)', textAlign: 'center', maxWidth: 300 }}>
            Upload a song and set a future release date to create a scheduled drop.
          </p>
          <Link
            href={`/${locale}/artist/upload`}
            className="btn-gold"
            style={{
              padding: '9px 22px', borderRadius: 20,
              fontSize: '0.8rem', fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: '#0d0d0d', textDecoration: 'none',
              marginTop: 4,
            }}
          >
            Upload Song
          </Link>
        </div>
      )}

      {/* ── Drop rows ──────────────────────────────────────────────────────── */}
      {!loading && drops.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drops.map((drop, i) => (
            <div
              key={drop.songId}
              className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 18px',
                background: 'var(--surface)',
                border: '1px solid rgba(232,184,75,0.08)',
                borderRadius: 12,
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.18)'; e.currentTarget.style.background = 'rgba(17,17,17,0.9)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.08)'; e.currentTarget.style.background = 'var(--surface)'; }}
            >
              {/* Cover art */}
              <div style={{
                width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                border: '1px solid rgba(232,184,75,0.15)',
                overflow: 'hidden',
                background: 'rgba(232,184,75,0.06)',
              }}>
                {drop.coverArtUrl ? (
                  <img src={drop.coverArtUrl} alt={drop.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Radio size={18} style={{ color: 'var(--gold-dim)', opacity: 0.5 }} />
                  </div>
                )}
              </div>

              {/* Title + artist (admin view) */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.95rem',
                  color: 'var(--ivory)', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginBottom: 3,
                }}>
                  {drop.title}
                </p>
                {isAdmin && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted-text)' }}>
                    {drop.artist.stageName}
                  </p>
                )}
              </div>

              {/* Countdown */}
              <div style={{ flexShrink: 0 }}>
                <DropCountdown dropAt={drop.dropAt} compact />
              </div>

              {/* Subscriber count */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}>
                <Users size={11} style={{ color: 'var(--muted-text)' }} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.78rem', color: 'var(--muted-text)',
                }}>
                  {drop.notifySubscriberCount}
                </span>
              </div>

              {/* Teaser link */}
              <Link
                href={`/${locale}/songs/${drop.songId}/teaser`}
                target="_blank"
                style={{ color: 'var(--muted-text)', flexShrink: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; }}
                title="View teaser page"
              >
                <ExternalLink size={14} />
              </Link>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setRescheduleModal({ songId: drop.songId, title: drop.title, hasRescheduled: !!drop.hasRescheduled })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8,
                    background: 'rgba(232,184,75,0.06)',
                    border: '1px solid rgba(232,184,75,0.15)',
                    color: 'var(--gold)',
                    fontSize: '0.72rem', fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,184,75,0.06)'; e.currentTarget.style.borderColor = 'rgba(232,184,75,0.15)'; }}
                >
                  <CalendarDays size={12} /> Reschedule
                </button>

                <button
                  type="button"
                  onClick={() => setCancelModal({ songId: drop.songId, title: drop.title })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8,
                    background: 'rgba(220,80,80,0.06)',
                    border: '1px solid rgba(220,80,80,0.2)',
                    color: 'hsl(var(--destructive))',
                    fontSize: '0.72rem', fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,80,80,0.12)'; e.currentTarget.style.borderColor = 'rgba(220,80,80,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,80,80,0.06)'; e.currentTarget.style.borderColor = 'rgba(220,80,80,0.2)'; }}
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {cancelModal && (
        <CancelDropModal
          songId={cancelModal.songId}
          songTitle={cancelModal.title}
          open={!!cancelModal}
          onClose={() => setCancelModal(null)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {rescheduleModal && (
        <RescheduleDropModal
          songId={rescheduleModal.songId}
          songTitle={rescheduleModal.title}
          hasRescheduled={rescheduleModal.hasRescheduled}
          open={!!rescheduleModal}
          onClose={() => setRescheduleModal(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </div>
  );
}
