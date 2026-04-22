'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Crown, Download, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { usersApi } from '@/lib/api/users.api';
import { downloadsApi } from '@/lib/api/downloads.api';
import { PremiumBadge } from '@/components/layout/PremiumBadge';
import { PremiumUpgradeModal } from '@/components/payment/PremiumUpgradeModal';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}

// ── Quota bar — same progressGrow pattern as K1 DownloadModal ─────────────
function QuotaSection({
  used, quota, locale,
}: { used: number; quota: number; locale: string }) {
  const [animate, setAnimate] = useState(false);
  const pct       = Math.min((used / quota) * 100, 100);
  const nearLimit = pct >= 90;

  useEffect(() => { const t = setTimeout(() => setAnimate(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid rgba(232,184,75,0.07)',
      borderRadius: 12, padding: '22px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={16} color="var(--muted-text)" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Downloads
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: nearLimit ? 'hsl(var(--destructive))' : 'var(--ivory)' }}>
          {used}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted-text)', marginLeft: 4 }}>
            / {quota}
          </span>
        </span>
      </div>

      {/* Progress bar — outer div sets target %, inner animates 0→100% of outer */}
      <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${pct}%`, height: '100%' }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 4,
            background: nearLimit
              ? 'linear-gradient(90deg, hsl(var(--destructive)) 0%, rgba(220,50,50,0.7) 100%)'
              : 'linear-gradient(90deg, var(--gold-dim) 0%, var(--gold) 100%)',
            animation: animate ? 'progressGrow 0.7s cubic-bezier(0.16,1,0.3,1) both' : 'none',
          }} />
        </div>
      </div>

      <a
        href={`/${locale}/downloads`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500,
          color: 'var(--gold)', textDecoration: 'none',
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      >
        Manage Downloads →
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function PremiumStatusPage() {
  const { locale }                    = useParams<{ locale: string }>();
  const { user, setUser, isPremium }  = useAuthStore();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quotaUsed, setQuotaUsed]     = useState<number | null>(null);
  const [quota, setQuota]             = useState<number>(100);
  const fetched                       = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    // Refresh auth store with fresh premiumExpiryDate
    usersApi.getMe()
      .then((res) => setUser(res.data?.data ?? res.data))
      .catch(() => {});

    // Fetch download quota (even non-premium users may have 0)
    downloadsApi.getDownloads()
      .then((res) => {
        const d = res.data?.data ?? res.data;
        setQuotaUsed(d.downloadCount ?? 0);
        setQuota(d.downloadQuota ?? 100);
      })
      .catch(() => setQuotaUsed(0));
  }, [setUser]);

  const active      = isPremium();
  const expiryDate  = user?.premiumExpiryDate ?? null;
  const days        = expiryDate ? daysUntil(expiryDate) : Infinity;
  const expiringSoon = active && days <= 7 && days > 0;

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '44px 24px 100px' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Crown size={26} color="var(--gold)" />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--ivory)', margin: 0 }}>
          Premium Status
        </h1>
        <PremiumBadge variant="pill" />
      </div>

      {/* ── Status card ────────────────────────────────────────────────── */}
      {active ? (
        <div
          className="anim-fade-up anim-fade-up-1"
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(232,184,75,0.18)',
            borderRadius: 12, padding: '24px',
            marginBottom: 16,
            boxShadow: '0 0 32px rgba(232,184,75,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Sparkles size={15} color="var(--gold)" />
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 700,
                  color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Active
                </span>
                {expiringSoon && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(160,125,46,0.12)',
                    border: '1px solid rgba(160,125,46,0.28)',
                    fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
                    color: 'var(--gold-dim)',
                  }}>
                    <AlertTriangle size={9} /> Expiring soon
                  </span>
                )}
              </div>
              {expiryDate && (
                <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 13, margin: 0 }}>
                  Valid until{' '}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: expiringSoon ? 'var(--gold-dim)' : 'var(--ivory)' }}>
                    {fmtDate(expiryDate)}
                  </span>
                  {expiringSoon && (
                    <span style={{ color: 'var(--gold-dim)', marginLeft: 6, fontSize: 12 }}>
                      ({Math.ceil(days)} day{Math.ceil(days) !== 1 ? 's' : ''} left)
                    </span>
                  )}
                </p>
              )}
            </div>

            <button
              onClick={() => setUpgradeOpen(true)}
              className="btn-gold"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 8, border: 'none',
                color: 'var(--charcoal)', fontWeight: 700, fontSize: 13,
                fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 40,
                flexShrink: 0,
              }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
            >
              <RefreshCw size={13} /> Renew / Upgrade
            </button>
          </div>
        </div>
      ) : (
        <div
          className="anim-fade-up anim-fade-up-1"
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '32px 24px',
            marginBottom: 16, textAlign: 'center',
          }}
        >
          <Crown size={40} color="rgba(232,184,75,0.22)" style={{ marginBottom: 14 }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ivory)', margin: '0 0 8px' }}>
            You're not on Premium
          </h2>
          <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: '0 0 22px' }}>
            Unlock HD streaming, offline downloads, and early access to drops.
          </p>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="btn-gold"
            style={{
              padding: '13px 32px', borderRadius: 8, border: 'none',
              color: 'var(--charcoal)', fontWeight: 700, fontSize: 15,
              fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
            }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          >
            Go Premium →
          </button>
        </div>
      )}

      {/* ── Download quota ─────────────────────────────────────────────── */}
      {active && quotaUsed !== null && (
        <div className="anim-fade-up anim-fade-up-2">
          <QuotaSection used={quotaUsed} quota={quota} locale={locale} />
        </div>
      )}

      <PremiumUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
