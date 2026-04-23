'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music2, Bell, BellOff, Lock, ArrowLeft } from 'lucide-react';
import { songsApi } from '@/lib/api/songs.api';
import { dropsApi } from '@/lib/api/drops.api';
import { useAuthStore } from '@/store/useAuthStore';
import DropCountdown from '@/components/drops/DropCountdown';
import { formatDistanceToNow } from 'date-fns';

interface TeaserData {
  id: string;
  title: string;
  coverArtUrl: string | null;
  dropAt: string;
  teaserText?: string;
  artist: { id: string; stageName: string; avatarUrl?: string | null };
  isNotifySubscribed: boolean | null;
}

export default function DropTeaserPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [teaser, setTeaser]     = useState<TeaserData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [subscribed, setSubscribed]   = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res  = await songsApi.getSongTeaser(id);
        const data = res.data?.data ?? res.data;
        setTeaser(data);
        setSubscribed(!!data?.isNotifySubscribed);
      } catch (err: any) {
        if (err?.response?.status === 404) setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleNotify = async () => {
    if (!user) { setShowLoginHint(true); setTimeout(() => setShowLoginHint(false), 3000); return; }
    setNotifyLoading(true);
    try {
      if (subscribed) {
        await dropsApi.unsubscribeNotify(id);
        setSubscribed(false);
      } else {
        await dropsApi.subscribeNotify(id);
        setSubscribed(true);
      }
    } catch {
    } finally {
      setNotifyLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--charcoal)',
      }}>
        <div className="vinyl-spin" style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
          border: '2px solid rgba(232,184,75,0.2)',
        }} />
      </main>
    );
  }

  if (notFound || !teaser) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--charcoal)', gap: 16, padding: '24px',
      }}>
        <Lock size={40} style={{ color: 'var(--muted-text)' }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--ivory)', textAlign: 'center' }}>
          Drop not found
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', textAlign: 'center', maxWidth: 320 }}>
          This drop doesn't exist or has already gone live. Check the artist's profile for the released track.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--muted-text)', fontSize: '0.8rem',
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ivory)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; }}
        >
          <ArrowLeft size={13} /> Go back
        </button>
      </main>
    );
  }

  const dropDate = new Date(teaser.dropAt);
  const relTime  = formatDistanceToNow(dropDate, { addSuffix: true });

  return (
    <main style={{ minHeight: '100vh', background: 'var(--charcoal)', position: 'relative', overflow: 'hidden' }}>

      {/* ── Ambient blurred background ────────────────────────────────────── */}
      {teaser.coverArtUrl && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${teaser.coverArtUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(55px)', transform: 'scale(1.15)',
          opacity: 0.18,
        }} />
      )}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to bottom, rgba(13,13,13,0.5) 0%, rgba(13,13,13,0.9) 60%, #0d0d0d 100%)',
      }} />

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 24px 0' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            color: 'var(--muted-text)', fontSize: '0.78rem',
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ivory)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; }}
        >
          <ArrowLeft size={13} /> Back
        </button>
      </div>

      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '40px 24px 80px',
        minHeight: 'calc(100vh - 60px)',
        justifyContent: 'center',
      }}>

        <div
          className="anim-scale-reveal"
          style={{
            width: '100%', maxWidth: 480,
            background: 'rgba(17,17,17,0.75)',
            border: '1px solid rgba(232,184,75,0.12)',
            backdropFilter: 'blur(16px)',
            borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            padding: '32px 28px 28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          }}
        >
          {/* Scheduled badge */}
          <span style={{
            padding: '3px 12px',
            background: 'rgba(160,125,46,0.12)',
            border: '1px solid rgba(160,125,46,0.3)',
            borderRadius: 20,
            fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--gold-dim)',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Lock size={9} style={{ color: 'var(--gold-dim)' }} />
            Scheduled Drop
          </span>

          {/* Cover art */}
          <div style={{
            width: 200, height: 200,
            borderRadius: 12,
            marginBottom: 24,
            flexShrink: 0,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(232,184,75,0.15)',
            overflow: 'hidden',
          }}>
            {teaser.coverArtUrl ? (
              <img
                src={teaser.coverArtUrl}
                alt={teaser.title}
                className="anim-scale-reveal"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'rgba(232,184,75,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Music2 size={48} style={{ color: 'var(--gold-dim)', opacity: 0.4 }} />
              </div>
            )}
          </div>

          {/* Song title */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.55rem', fontWeight: 500,
            color: 'var(--ivory)', textAlign: 'center',
            letterSpacing: '-0.01em', lineHeight: 1.25,
            marginBottom: 8,
          }}>
            {teaser.title}
          </h1>

          {/* Artist name */}
          <Link
            href={`/${locale}/artists/${teaser.artist.id}`}
            style={{
              fontSize: '0.82rem', color: 'var(--muted-text)',
              textDecoration: 'none', marginBottom: 28,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--ivory)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; }}
          >
            {teaser.artist.stageName}
          </Link>

          {/* Teaser text */}
          {teaser.teaserText && (
            <p style={{
              fontSize: '0.82rem', color: 'var(--muted-text)',
              textAlign: 'center', lineHeight: 1.55,
              marginBottom: 24, fontStyle: 'italic',
              maxWidth: 340,
            }}>
              "{teaser.teaserText}"
            </p>
          )}

          {/* Countdown */}
          <div style={{ marginBottom: 8 }}>
            <DropCountdown dropAt={teaser.dropAt} />
          </div>

          {/* Drop date label */}
          <p style={{ fontSize: '0.7rem', color: 'var(--muted-text)', marginBottom: 28, letterSpacing: '0.02em' }}>
            {relTime} · {dropDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
            at {dropDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>

          {/* Divider */}
          <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.06)', marginBottom: 24 }} />

          {/* Notify Me CTA */}
          <div style={{ position: 'relative', width: '100%' }}>
            <button
              type="button"
              onClick={handleNotify}
              disabled={notifyLoading}
              className={!subscribed && !notifyLoading ? 'btn-gold' : ''}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0',
                borderRadius: 24,
                fontFamily: 'var(--font-body)',
                fontWeight: 600, fontSize: '0.85rem',
                cursor: notifyLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                ...(subscribed ? {
                  background: 'rgba(232,184,75,0.08)',
                  border: '1px solid rgba(232,184,75,0.25)',
                  color: 'var(--gold)',
                } : notifyLoading ? {
                  background: 'rgba(232,184,75,0.1)',
                  border: '1px solid rgba(232,184,75,0.15)',
                  color: 'var(--muted-text)',
                } : {
                  color: '#0d0d0d',
                  border: 'none',
                }),
              }}
            >
              {subscribed
                ? <><BellOff size={15} /> Unsubscribe</>
                : notifyLoading
                  ? 'Saving…'
                  : <><Bell size={15} /> Notify Me</>
              }
            </button>

            {/* Login hint */}
            {showLoginHint && (
              <div
                className="anim-fade-up"
                style={{
                  position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '8px 14px',
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(232,184,75,0.2)',
                  borderRadius: 8,
                  fontSize: '0.72rem', color: 'var(--ivory)',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <Link
                  href={`/${locale}/login`}
                  style={{ color: 'var(--gold)', textDecoration: 'none' }}
                >
                  Log in
                </Link>{' '}
                to get notified when this drops
              </div>
            )}
          </div>

          {/* No stream note */}
          <p style={{ fontSize: '0.65rem', color: 'var(--muted-text)', marginTop: 14, textAlign: 'center' }}>
            <Lock size={9} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold-dim)' }} />
            Audio locked until drop time
          </p>
        </div>
      </div>
    </main>
  );
}
