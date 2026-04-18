'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Library, Tags, ClipboardList, ArrowRight, Clock,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { adminApi, type GenreSuggestion } from '@/lib/api/admin.api';
import type { Song } from '@/lib/api/songs.api';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  value, label, href, locale, accent = false, idx,
}: {
  value: number;
  label: string;
  href: string;
  locale: string;
  accent?: boolean;
  idx: number;
}) {
  return (
    <Link
      href={`/${locale}${href}`}
      className={`anim-fade-up anim-fade-up-${idx + 2}`}
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: '24px 24px 20px',
        background: 'rgba(17,17,17,0.75)',
        border: `1px solid ${accent ? 'rgba(232,184,75,0.2)' : 'rgba(42,37,32,0.6)'}`,
        borderRadius: 8, textDecoration: 'none',
        boxShadow: accent ? '0 0 28px rgba(232,184,75,0.04)' : 'none',
        transition: 'border-color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.3)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = accent ? 'rgba(232,184,75,0.2)' : 'rgba(42,37,32,0.6)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '2.4rem', fontWeight: 400,
        color: accent ? 'var(--gold)' : 'var(--ivory)',
        lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{
        fontSize: '0.65rem', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-text)',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>View all</span>
        <ArrowRight size={11} color="var(--gold)" />
      </div>
    </Link>
  );
}

// ── Quick action link ─────────────────────────────────────────────────────────
function QuickLink({
  href, locale, Icon, label, description, idx,
}: {
  href: string;
  locale: string;
  Icon: React.ElementType;
  label: string;
  description: string;
  idx: number;
}) {
  return (
    <Link
      href={`/${locale}${href}`}
      className={`anim-fade-up anim-fade-up-${idx + 5}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
        background: 'transparent', border: '1px solid rgba(42,37,32,0.5)',
        borderRadius: 8, textDecoration: 'none',
        transition: 'background 0.18s, border-color 0.18s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.03)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.5)';
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(232,184,75,0.07)', border: '1px solid rgba(232,184,75,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color="var(--gold)" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--ivory)', fontSize: '0.86rem', fontWeight: 500 }}>{label}</p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 2 }}>{description}</p>
      </div>
      <ArrowRight size={14} color="var(--muted-text)" style={{ flexShrink: 0 }} />
    </Link>
  );
}

// ── Recent suggestion row ─────────────────────────────────────────────────────
function RecentSuggestionRow({ suggestion }: { suggestion: GenreSuggestion }) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: '1px solid rgba(42,37,32,0.4)',
    }}>
      <Tags size={13} color="var(--muted-text)" style={{ flexShrink: 0 }} />
      <p style={{ flex: 1, color: 'var(--ivory)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {suggestion.name}
      </p>
      <span style={{ color: 'var(--muted-text)', fontSize: '0.68rem' }}>
        {fmtDate(suggestion.createdAt)}
      </span>
    </div>
  );
}

// ── Recent pending song row ───────────────────────────────────────────────────
function RecentSongRow({ song }: { song: Song }) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: '1px solid rgba(42,37,32,0.4)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 3, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {song.coverArtUrl
          ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Clock size={11} color="rgba(232,184,75,0.3)" />
        }
      </div>
      <p style={{ flex: 1, color: 'var(--ivory)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {song.title}
      </p>
      <span style={{ color: 'var(--muted-text)', fontSize: '0.68rem' }}>
        {fmtDate(song.createdAt)}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { locale } = useParams<{ locale: string }>();
  const [songs, setSongs]             = useState<Song[]>([]);
  const [suggestions, setSuggestions] = useState<GenreSuggestion[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.allSettled([
      adminApi.getSongQueue(),
      adminApi.getGenreSuggestions(),
    ]).then(([songRes, suggRes]) => {
      if (songRes.status === 'fulfilled') {
        const d = (songRes.value.data as any).data ?? songRes.value.data;
        setSongs(Array.isArray(d) ? d : []);
      }
      if (suggRes.status === 'fulfilled') {
        const d = (suggRes.value.data as any).data ?? suggRes.value.data;
        setSuggestions(Array.isArray(d) ? d : []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const pendingSongs    = songs.length;
  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING').length;
  const recentSongs     = songs.slice(0, 5);
  const recentSuggestions = suggestions.filter((s) => s.status === 'PENDING').slice(0, 5);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="vinyl-spin" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
          border: '2px solid rgba(232,184,75,0.2)',
        }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 32px', position: 'relative', overflow: 'hidden' }}>

      {/* Ambient background orbs */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-5%', width: 400, height: 400,
        borderRadius: '50%', background: 'rgba(232,184,75,0.04)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
        animation: 'auroraShift1 18s ease-in-out infinite',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 40 }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Admin Panel
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem,4vw,3rem)',
            fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
          }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 6 }}>
            Moderation overview — review queues and recent activity.
          </p>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16, marginBottom: 40,
        }}>
          <StatCard
            value={pendingSongs}
            label="Songs awaiting review"
            href="/admin/songs"
            locale={locale}
            accent={pendingSongs > 0}
            idx={0}
          />
          <StatCard
            value={pendingSuggestions}
            label="Genre suggestions pending"
            href="/admin/genres"
            locale={locale}
            accent={pendingSuggestions > 0}
            idx={1}
          />
          <StatCard
            value={suggestions.filter((s) => s.status === 'APPROVED').length}
            label="Genres approved total"
            href="/admin/genres"
            locale={locale}
            idx={2}
          />
        </div>

        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', marginBottom: 40 }} />

        {/* Two-column layout: recent queues + quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40 }}>

          {/* Pending songs preview */}
          <div className="anim-fade-up anim-fade-up-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.35)' }}>
                Pending Songs
              </p>
              <Link href={`/${locale}/admin/songs`} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.7rem', color: 'var(--gold)', textDecoration: 'none',
                letterSpacing: '0.04em',
              }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {recentSongs.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <CheckCircle2 size={20} color="rgba(120,200,120,0.3)" style={{ margin: '0 auto 8px' }} />
                <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>Queue is clear</p>
              </div>
            ) : (
              <div style={{ background: '#111', border: '1px solid rgba(42,37,32,0.5)', borderRadius: 8, padding: '4px 16px' }}>
                {recentSongs.map((s) => <RecentSongRow key={s.id} song={s} />)}
                {pendingSongs > 5 && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--muted-text)', padding: '10px 0', textAlign: 'center' }}>
                    +{pendingSongs - 5} more waiting
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pending genre suggestions preview */}
          <div className="anim-fade-up anim-fade-up-5">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.35)' }}>
                Genre Suggestions
              </p>
              <Link href={`/${locale}/admin/genres`} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.7rem', color: 'var(--gold)', textDecoration: 'none',
                letterSpacing: '0.04em',
              }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {recentSuggestions.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <CheckCircle2 size={20} color="rgba(120,200,120,0.3)" style={{ margin: '0 auto 8px' }} />
                <p style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>All caught up</p>
              </div>
            ) : (
              <div style={{ background: '#111', border: '1px solid rgba(42,37,32,0.5)', borderRadius: 8, padding: '4px 16px' }}>
                {recentSuggestions.map((s) => <RecentSuggestionRow key={s.id} suggestion={s} />)}
                {pendingSuggestions > 5 && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--muted-text)', padding: '10px 0', textAlign: 'center' }}>
                    +{pendingSuggestions - 5} more pending
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="anim-fade-up anim-fade-up-6" style={{ marginBottom: 8 }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.35)', marginBottom: 14 }}>
            Quick Access
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QuickLink href="/admin/songs"  locale={locale} Icon={Library}       label="Song Queue"       description="Review pending uploads from artists"         idx={0} />
            <QuickLink href="/admin/genres" locale={locale} Icon={Tags}          label="Genre Suggestions" description="Approve or reject artist genre proposals"    idx={1} />
            <QuickLink href="/admin/audit"  locale={locale} Icon={ClipboardList} label="Audit Log"        description="Immutable record of all admin actions"        idx={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
