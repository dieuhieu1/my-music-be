'use client';
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
  variant?: 'gold' | 'ghost';
}

export default function AuthButton({ loading, children, variant = 'gold', className = '', ...props }: AuthButtonProps) {
  if (variant === 'ghost') {
    return (
      <button
        {...props}
        disabled={loading || props.disabled}
        style={{
          width: '100%',
          padding: '12px 0',
          background: 'transparent',
          border: '1px solid #2a2520',
          borderRadius: 4,
          color: 'var(--muted-text)',
          fontSize: '0.85rem',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          transition: 'border-color 0.2s, color 0.2s',
        }}
      >
        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : children}
      </button>
    );
  }

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="btn-gold"
      style={{
        width: '100%',
        padding: '13px 0',
        borderRadius: 4,
        border: 'none',
        color: '#0d0d0d',
        fontSize: '0.85rem',
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}
