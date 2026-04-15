'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usersApi, type UserProfile } from '@/lib/api/users.api';
import { Edit3, Lock, MonitorSmartphone, Star, Users, UserCheck, Crown, Loader2 } from 'lucide-react';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    PREMIUM: { bg: 'rgba(232,184,75,0.12)', color: 'var(--gold)',    label: '✦ Premium' },
    ARTIST:  { bg: 'rgba(160,120,200,0.12)', color: '#c8a0e8',       label: '♪ Artist'  },
    ADMIN:   { bg: 'rgba(100,180,255,0.12)', color: '#90c8ff',       label: '⬡ Admin'   },
    USER:    { bg: 'rgba(255,255,255,0.05)', color: 'var(--muted-text)', label: 'Listener' },
  };
  const s = styles[role] ?? styles.USER;
  return (
    <span style={{
      padding: '3px 9px',
      background: s.bg,
      border: `1px solid ${s.color}22`,
      borderRadius: 20,
      fontSize: '0.68rem',
      color: s.color,
      fontWeight: 500,
      letterSpacing: '0.04em',
      fontFamily: 'var(--font-body)',
    }}>
      {s.label}
    </span>
  );
}

interface QuickLinkProps { href: string; icon: React.ReactNode; label: string; desc: string }
function QuickLink({ href, icon, label, desc }: QuickLinkProps) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        background: hov ? '#181818' : '#111111',
        border: `1px solid ${hov ? '#2a2520' : '#1a1a1a'}`,
        borderRadius: 6,
        textDecoration: 'none',
        transition: 'background 0.18s, border-color 0.18s',
        flex: 1, minWidth: 0,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'rgba(232,184,75,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ivory)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>{desc}</p>
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const { locale } = useParams<{ locale: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getMe()
      .then((r) => setProfile((r.data as any).data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10, color: 'var(--muted-text)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ fontSize: '0.85rem' }}>Loading profile…</span>
      </div>
    );
  }

  if (!profile) return null;

  const joinYear = new Date(profile.createdAt).getFullYear();
  const roles = profile.roles ?? ['USER'];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div
        className="anim-hero-reveal"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '48px 40px 36px',
          background: 'linear-gradient(135deg, #0e0c09 0%, #111111 40%, #0a0a0a 100%)',
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -60, left: -40, width: 280, height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,184,75,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, position: 'relative', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            border: '2px solid rgba(232,184,75,0.4)',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 0 30px rgba(232,184,75,0.12)',
          }}
            className="avatar-ring-pulse anim-scale-reveal"
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'rgba(232,184,75,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 500,
                color: 'var(--gold)',
              }}>
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {roles.filter(r => r !== 'USER' || roles.length === 1)
                    .map(r => <RoleBadge key={r} role={r} />)}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.4rem',
              fontWeight: 400,
              color: 'var(--ivory)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 8,
            }}>
              {profile.name}
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
              {profile.email}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 32, marginTop: 28,
          paddingTop: 20,
          borderTop: '1px solid #1a1a1a',
          position: 'relative',
        }}>
          {[
            { label: 'followers', value: fmt(profile.followerCount ?? 0) },
            { label: 'following', value: fmt(profile.followingCount ?? 0) },
            { label: 'joined',    value: joinYear.toString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem', fontWeight: 400,
                color: 'var(--gold)', lineHeight: 1,
              }}>
                {value}
              </p>
              <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {label}
              </p>
            </div>
          ))}

          {profile.isPremium && (
            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                background: 'rgba(232,184,75,0.08)',
                border: '1px solid rgba(232,184,75,0.2)',
                borderRadius: 20,
              }}>
                <Crown size={11} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--gold)', letterSpacing: '0.06em', fontWeight: 600 }}>
                  PREMIUM ACTIVE
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-2" style={{ padding: '24px 24px 0' }}>
        <p style={{ fontSize: '0.63rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Account
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <QuickLink
            href={`/${locale}/profile/edit`}
            icon={<Edit3 size={16} style={{ color: 'var(--gold)' }} />}
            label="Edit Profile"
            desc="Name & avatar"
          />
          <QuickLink
            href={`/${locale}/profile/password`}
            icon={<Lock size={16} style={{ color: 'var(--gold)' }} />}
            label="Change Password"
            desc="Update credentials"
          />
          <QuickLink
            href={`/${locale}/profile/sessions`}
            icon={<MonitorSmartphone size={16} style={{ color: 'var(--gold)' }} />}
            label="Active Sessions"
            desc="Manage devices"
          />
        </div>
      </div>

      {/* ── Detail card ──────────────────────────────────────────────────── */}
      <div
        className="anim-fade-up anim-fade-up-3"
        style={{ margin: '20px 24px 32px', padding: '20px 24px', background: '#111111', border: '1px solid #1a1a1a', borderRadius: 8 }}
      >
        <p style={{ fontSize: '0.63rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>
          Details
        </p>
        {[
          { label: 'Email',        value: profile.email },
          { label: 'Member since', value: new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
          { label: 'Account type', value: profile.isPremium ? 'Premium Member' : 'Free Listener' },
          ...(profile.premiumExpiresAt ? [{ label: 'Premium expires', value: new Date(profile.premiumExpiresAt).toLocaleDateString() }] : []),
        ].map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid #161616',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>{label}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--ivory)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
