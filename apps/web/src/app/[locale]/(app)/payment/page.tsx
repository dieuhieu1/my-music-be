'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Crown, Download, Headphones, Zap, Sparkles } from 'lucide-react';
import { PlanCard } from '@/components/payment/PlanCard';
import { GatewaySelector, type Gateway } from '@/components/payment/GatewaySelector';
import { PLANS } from '@/components/payment/plans';
import { paymentsApi } from '@/lib/api/payments.api';
import { useAuthStore } from '@/store/useAuthStore';
import type { PremiumType } from '@mymusic/types';

const FEATURES = [
  { icon: Download,    label: 'Premium downloads' },
  { icon: Headphones,  label: 'HD streaming' },
  { icon: Zap,         label: 'Early drop access' },
];

function fmtExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PaymentPage() {
  const { locale } = useParams<{ locale: string }>();
  const { user, isPremium } = useAuthStore();

  const [selectedPlan, setSelectedPlan] = useState<PremiumType | null>(null);
  const [gateway, setGateway]           = useState<Gateway | null>(null);
  const [loading, setLoading]           = useState(false);
  const [fieldError, setFieldError]     = useState<'plan' | 'gateway' | null>(null);
  const [apiError, setApiError]         = useState<string | null>(null);

  const alreadyPremium = isPremium();

  const handleSubmit = async () => {
    if (!selectedPlan) { setFieldError('plan');    return; }
    if (!gateway)      { setFieldError('gateway'); return; }
    setFieldError(null);
    setApiError(null);
    setLoading(true);
    try {
      if (gateway === 'vnpay') {
        const res  = await paymentsApi.initiateVnpay(selectedPlan);
        const data = res.data?.data ?? res.data;
        window.location.href = data.paymentUrl;
      } else {
        const res  = await paymentsApi.initiateMomo(selectedPlan);
        const data = res.data?.data ?? res.data;
        window.location.href = data.paymentUrl;
      }
    } catch {
      setApiError('Could not connect to the payment gateway. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '44px 24px 100px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: 14 }}>
          <Crown size={38} color="var(--gold)" />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 40,
          color: 'var(--ivory)', margin: '0 0 10px', fontWeight: 600,
        }}>
          Go Premium
        </h1>
        <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 15, margin: '0 0 18px' }}>
          Upgrade your listening experience
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {FEATURES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 13 }}
            >
              <Icon size={14} color="var(--gold)" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Already-premium banner ──────────────────────────────────────────── */}
      {alreadyPremium && (
        <div
          className="anim-fade-up anim-fade-up-1"
          style={{
            background: 'rgba(232,184,75,0.07)',
            border: '1px solid rgba(232,184,75,0.22)',
            borderRadius: 10, padding: '13px 16px',
            marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <Sparkles size={15} color="var(--gold)" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ivory)' }}>
            {user?.premiumExpiryDate
              ? `You're Premium until ${fmtExpiry(user.premiumExpiryDate)}. Renewing now extends your current period.`
              : "You already have an active Premium membership. Renewing extends your current period."}
          </span>
        </div>
      )}

      {/* ── Plan cards ─────────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-2">
        <p style={{
          fontSize: 11, color: 'var(--muted-text)', fontFamily: 'var(--font-body)',
          marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Choose a plan
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))',
          gap: 14,
          border: fieldError === 'plan' ? '1px solid hsl(var(--destructive))' : '1px solid transparent',
          borderRadius: 14,
          padding: fieldError === 'plan' ? '12px' : '0',
          transition: 'border-color 0.2s ease, padding 0.2s ease',
        }}>
          {PLANS.map((plan, i) => (
            <div key={plan.type} className={`anim-fade-up anim-fade-up-${Math.min(i + 3, 8)}`}>
              <PlanCard
                plan={plan}
                selected={selectedPlan === plan.type}
                onSelect={(t) => { setSelectedPlan(t); setFieldError(null); }}
              />
            </div>
          ))}
        </div>
        {fieldError === 'plan' && (
          <p style={{ color: 'hsl(var(--destructive))', fontSize: 12, fontFamily: 'var(--font-body)', margin: '8px 0 0' }}>
            Please select a plan to continue.
          </p>
        )}
      </div>

      {/* ── Gateway selector ────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-7" style={{ marginTop: 28 }}>
        <p style={{
          fontSize: 11, color: 'var(--muted-text)', fontFamily: 'var(--font-body)',
          marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Pay with
        </p>
        <div style={{
          border: fieldError === 'gateway' ? '1px solid hsl(var(--destructive))' : '1px solid transparent',
          borderRadius: 12,
          padding: fieldError === 'gateway' ? '10px' : '0',
          transition: 'border-color 0.2s ease, padding 0.2s ease',
        }}>
          <GatewaySelector
            value={gateway}
            onChange={(g) => { setGateway(g); setFieldError(null); }}
            disabled={loading}
          />
        </div>
        {fieldError === 'gateway' && (
          <p style={{ color: 'hsl(var(--destructive))', fontSize: 12, fontFamily: 'var(--font-body)', margin: '8px 0 0' }}>
            Please choose a payment method.
          </p>
        )}
      </div>

      {/* ── API error ────────────────────────────────────────────────────────── */}
      {apiError && (
        <div
          className="anim-fade-up"
          style={{
            marginTop: 16, padding: '12px 16px',
            background: 'rgba(220,50,50,0.07)',
            border: '1px solid rgba(220,50,50,0.2)',
            borderRadius: 8,
          }}
        >
          <p style={{ color: 'hsl(var(--destructive))', fontSize: 13, fontFamily: 'var(--font-body)', margin: 0 }}>
            {apiError}
          </p>
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-8" style={{ marginTop: 32 }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-gold"
          style={{
            width: '100%', padding: '16px', borderRadius: 10, border: 'none',
            color: 'var(--charcoal)', fontWeight: 700, fontSize: 16,
            fontFamily: 'var(--font-body)', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.72 : 1, minHeight: 44,
          }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          {loading ? 'Redirecting to payment gateway…' : 'Continue to Payment →'}
        </button>
        <p style={{
          textAlign: 'center', marginTop: 12,
          fontSize: 12, color: 'var(--muted-text)', fontFamily: 'var(--font-body)',
        }}>
          Secure payment · Cancel anytime
        </p>
      </div>
    </div>
  );
}
