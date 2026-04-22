'use client';

import { CheckCircle2, XCircle, RotateCcw, ArrowRight } from 'lucide-react';

interface PaymentResultCardProps {
  status: 'loading' | 'success' | 'error';
  expiryDate?: string | null;
  errorMessage?: string;
  onContinue?: () => void;
  onRetry?: () => void;
}

function fmtExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function btnBase(extra?: React.CSSProperties): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 28px', borderRadius: 8,
    fontWeight: 700, fontSize: 15,
    fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
    border: 'none', ...extra,
  };
}

export function PaymentResultCard({
  status, expiryDate, errorMessage, onContinue, onRetry,
}: PaymentResultCardProps) {
  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '64px 32px' }}>
        <div
          className="vinyl-spin"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, var(--surface-2), var(--charcoal))',
            border: '2px solid var(--gold-dim)',
            boxShadow: '0 0 24px var(--gold-glow)',
          }}
        />
        <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: 0 }}>
          Verifying your payment…
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div
        className="anim-scale-reveal"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '52px 36px', textAlign: 'center' }}
      >
        <div style={{ color: 'var(--gold)' }}>
          <CheckCircle2 size={56} strokeWidth={1.5} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ivory)', margin: '0 0 10px' }}>
            Premium Activated
          </h2>
          {expiryDate && (
            <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: 0 }}>
              Valid until {fmtExpiry(expiryDate)}
            </p>
          )}
        </div>
        <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 13, maxWidth: 280, margin: 0 }}>
          You now have access to HD streams, premium downloads, and early drops.
        </p>
        {onContinue && (
          <button
            onClick={onContinue}
            className="btn-gold"
            style={btnBase({ color: 'var(--charcoal)' })}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          >
            View Premium Status <ArrowRight size={16} />
          </button>
        )}
      </div>
    );
  }

  // error
  return (
    <div
      className="anim-scale-reveal"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '52px 36px', textAlign: 'center' }}
    >
      <div style={{ color: 'hsl(var(--destructive))', animation: 'glitchSkew 0.8s ease-in-out' }}>
        <XCircle size={56} strokeWidth={1.5} />
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ivory)', margin: '0 0 10px' }}>
          Payment Not Completed
        </h2>
        <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: 0 }}>
          {errorMessage ?? 'The transaction could not be verified. Please try again.'}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={btnBase({
            background: 'var(--surface)', color: 'var(--ivory)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            transition: 'border-color 0.2s ease',
          })}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          <RotateCcw size={15} /> Try Again
        </button>
      )}
    </div>
  );
}
