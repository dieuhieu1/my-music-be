'use client';

import { Crown } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface PremiumBadgeProps {
  /** 'pill' = full badge with label (Sidebar). 'icon' = Crown only, for tight spaces. */
  variant?: 'pill' | 'icon';
}

function fmtExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function PremiumBadge({ variant = 'pill' }: PremiumBadgeProps) {
  const { user, isPremium } = useAuthStore();

  if (!isPremium()) return null;

  const tooltip = user?.premiumExpiryDate
    ? `Premium until ${fmtExpiry(user.premiumExpiryDate)}`
    : 'Premium member';

  if (variant === 'icon') {
    return (
      <span
        title={tooltip}
        style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--gold)' }}
      >
        <Crown size={13} strokeWidth={1.8} />
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 20,
        background: 'rgba(232,184,75,0.10)',
        border: '1px solid rgba(232,184,75,0.28)',
        color: 'var(--gold)',
        fontSize: 10,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <Crown size={9} strokeWidth={2.2} />
      Premium
    </span>
  );
}
