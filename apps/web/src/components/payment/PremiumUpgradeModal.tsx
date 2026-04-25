'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Crown, X } from 'lucide-react';
import { PlanCard } from './PlanCard';
import { GatewaySelector, type Gateway } from './GatewaySelector';
import { PLANS } from './plans';
import { paymentsApi } from '@/lib/api/payments.api';
import type { PremiumType } from '@mymusic/types';

interface PremiumUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PremiumUpgradeModal({ open, onOpenChange }: PremiumUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PremiumType | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedPlan) { setError('Please select a plan.'); return; }
    if (!gateway)       { setError('Please choose a payment method.'); return; }
    setError(null);
    setLoading(true);
    try {
      if (gateway === 'vnpay') {
        const res = await paymentsApi.initiateVnpay(selectedPlan);
        const data = res.data?.data ?? res.data;
        window.location.href = data.paymentUrl;
      } else {
        const res = await paymentsApi.initiateMomo(selectedPlan);
        const data = res.data?.data ?? res.data;
        window.location.href = data.paymentUrl;
      }
    } catch {
      setError('Failed to connect to payment gateway. Please try again.');
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!loading) {
      if (!next) { setError(null); }
      onOpenChange(next);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        }} />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%', zIndex: 201,
            transform: 'translate(-50%, -50%)',
            width: 'min(640px, 94vw)',
            outline: 'none',
          }}
        >
          {/* Inner wrapper carries the scale animation so it doesn't override translate(-50%,-50%) */}
          <div
            className="anim-scale-reveal"
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(232,184,75,0.15)',
              borderRadius: 14,
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              maxHeight: '88vh', overflowY: 'auto',
            }}
          >
          {/* Header */}
          <div style={{ padding: '26px 26px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crown size={20} color="var(--gold)" />
              <Dialog.Title style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ivory)', margin: 0 }}>
                Go Premium
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted-text)', padding: 6, borderRadius: 6,
                  minWidth: 44, minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s ease', outline: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ivory)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-text)'; }}
                onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
                onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div style={{ padding: '18px 26px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: 0 }}>
              Unlock HD streaming, premium downloads, and early access to drops.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.type}
                  plan={plan}
                  selected={selectedPlan === plan.type}
                  onSelect={(t) => { setSelectedPlan(t); setError(null); }}
                />
              ))}
            </div>

            <div>
              <p style={{
                fontSize: 11, color: 'var(--muted-text)', fontFamily: 'var(--font-body)',
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Pay with
              </p>
              <GatewaySelector
                value={gateway}
                onChange={(g) => { setGateway(g); setError(null); }}
                disabled={loading}
              />
            </div>

            {error && (
              <p style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-body)', fontSize: 13, margin: 0 }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-gold"
              style={{
                width: '100%', padding: '14px', borderRadius: 8, border: 'none',
                color: 'var(--charcoal)', fontWeight: 700, fontSize: 15,
                fontFamily: 'var(--font-body)', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, minHeight: 44,
              }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
            >
              {loading ? 'Redirecting…' : 'Continue to Payment →'}
            </button>
          </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
