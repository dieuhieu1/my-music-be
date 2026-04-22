'use client';

import { Check } from 'lucide-react';
import type { Plan } from './plans';
import type { PremiumType } from '@mymusic/types';

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onSelect: (type: PremiumType) => void;
}

export function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  return (
    <button
      onClick={() => onSelect(plan.type)}
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${selected ? 'var(--gold)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12,
        padding: '22px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.16,1,0.3,1)',
        width: '100%',
        minHeight: 44,
        outline: 'none',
      }}
      className={selected ? 'avatar-ring-pulse' : undefined}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--gold-dim)';
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
    >
      {plan.popular && (
        <span style={{
          position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--gold)', color: 'var(--charcoal)', fontSize: 10,
          fontWeight: 700, padding: '2px 10px', borderRadius: 20,
          fontFamily: 'var(--font-body)', letterSpacing: '0.06em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          Most Popular
        </span>
      )}

      {selected && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          background: 'var(--gold)', borderRadius: '50%',
          width: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={11} color="var(--charcoal)" strokeWidth={3} />
        </span>
      )}

      <div style={{
        color: 'var(--muted-text)', fontSize: 11, fontFamily: 'var(--font-body)',
        marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {plan.duration}
      </div>

      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ivory)',
        fontWeight: 600, lineHeight: 1,
      }}>
        {plan.price.toLocaleString('vi-VN')}
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 12,
          color: 'var(--muted-text)', fontWeight: 400, marginLeft: 3,
        }}>₫</span>
      </div>

      {plan.savingLabel && (
        <div style={{
          marginTop: 8, fontSize: 11, color: 'var(--gold)',
          fontFamily: 'var(--font-body)', fontWeight: 600,
        }}>
          {plan.savingLabel}
        </div>
      )}
    </button>
  );
}
