'use client';

export type Gateway = 'vnpay' | 'momo';

interface GatewayOption {
  id: Gateway;
  label: string;
  description: string;
  abbr: string;
}

const GATEWAYS: GatewayOption[] = [
  { id: 'vnpay', label: 'VNPay',  description: 'Visa · MasterCard · ATM', abbr: 'VP' },
  { id: 'momo',  label: 'MoMo',   description: 'MoMo e-wallet',            abbr: 'MM' },
];

interface GatewaySelectorProps {
  value: Gateway | null;
  onChange: (g: Gateway) => void;
  disabled?: boolean;
}

export function GatewaySelector({ value, onChange, disabled }: GatewaySelectorProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {GATEWAYS.map((g) => {
        const selected = value === g.id;
        return (
          <button
            key={g.id}
            onClick={() => !disabled && onChange(g.id)}
            disabled={disabled}
            style={{
              background: 'var(--surface-2)',
              border: `1.5px solid ${selected ? 'var(--gold)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 10,
              padding: '14px 16px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.16,1,0.3,1)',
              opacity: disabled ? 0.55 : 1,
              minHeight: 44,
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (disabled) return;
              if (!selected) e.currentTarget.style.borderColor = 'var(--gold-dim)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: selected ? 'rgba(232,184,75,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selected ? 'rgba(232,184,75,0.35)' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s ease, border-color 0.2s ease',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-body)',
                  color: selected ? 'var(--gold)' : 'var(--muted-text)',
                  letterSpacing: '-0.01em',
                }}>
                  {g.abbr}
                </span>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                  color: selected ? 'var(--ivory)' : 'var(--muted-text)',
                  transition: 'color 0.2s ease',
                }}>
                  {g.label}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--muted-text)',
                  fontFamily: 'var(--font-body)', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {g.description}
                </div>
              </div>

              {selected && (
                <div style={{
                  marginLeft: 'auto', flexShrink: 0,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="var(--charcoal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
