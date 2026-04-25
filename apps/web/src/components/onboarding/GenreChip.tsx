'use client';

import { useState } from 'react';

interface Props {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function GenreChip({ label, selected, disabled, onClick }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 16px', borderRadius: 99, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${
          selected
            ? 'var(--gold)'
            : hovered && !disabled
            ? 'var(--gold-dim)'
            : 'rgba(24,24,24,0.9)'
        }`,
        background: selected
          ? 'rgba(232,184,75,0.12)'
          : hovered && !disabled
          ? 'rgba(17,17,17,0.9)'
          : 'var(--surface-2)',
        boxShadow: selected ? '0 0 12px var(--gold-glow)' : 'none',
        color: selected ? 'var(--gold)' : disabled ? 'var(--muted-text)' : 'var(--ivory)',
        fontSize: '0.8rem', fontWeight: 500, fontFamily: 'var(--font-body)',
        transform: hovered && !disabled && !selected ? 'translateY(-2px)' : 'translateY(0)',
        opacity: disabled && !selected ? 0.4 : 1,
        transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  );
}
