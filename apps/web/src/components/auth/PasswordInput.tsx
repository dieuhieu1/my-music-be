'use client';
import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, id, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div>
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            fontSize: '0.68rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: focused ? 'rgba(232,184,75,0.85)' : 'var(--muted-text)',
            marginBottom: 8,
            transition: 'color 0.22s ease',
          }}
        >
          {label}
        </label>
        <div
          style={{
            position: 'relative',
            background: focused ? 'rgba(232,184,75,0.028)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${focused ? 'rgba(232,184,75,0.42)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            transition: 'border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
            boxShadow: focused
              ? '0 0 0 3px rgba(232,184,75,0.07), 0 4px 16px rgba(0,0,0,0.35)'
              : '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          <input
            ref={ref}
            id={inputId}
            type={show ? 'text' : 'password'}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            {...props}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ivory)',
              fontSize: '0.93rem',
              fontFamily: 'var(--font-body)',
              padding: '12px 14px',
              ...props.style,
            }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 14px',
              color: focused ? 'rgba(232,184,75,0.7)' : 'var(--muted-text)',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = focused ? 'rgba(232,184,75,0.7)' : 'var(--muted-text)')}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          {/* Gold shimmer line at bottom on focus */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '12%',
              right: '12%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(232,184,75,0.7), transparent)',
              opacity: focused ? 1 : 0,
              transition: 'opacity 0.3s ease',
              borderRadius: '0 0 9px 9px',
            }}
          />
        </div>
        {error && (
          <p
            style={{
              fontSize: '0.72rem',
              color: '#e07070',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;
