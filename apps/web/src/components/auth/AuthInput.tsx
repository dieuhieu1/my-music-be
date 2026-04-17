'use client';
import { forwardRef, InputHTMLAttributes, useState } from 'react';

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, id, ...props }, ref) => {
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
            background: focused ? 'rgba(232,184,75,0.04)' : 'rgba(13,13,13,0.7)',
            border: `1px solid ${focused ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.15)'}`,
            borderRadius: 9,
            transition: 'border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
            boxShadow: focused
              ? '0 0 0 3px rgba(232,184,75,0.07), 0 4px 16px rgba(0,0,0,0.35)'
              : '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <input
            ref={ref}
            id={inputId}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            {...props}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ivory)',
              fontSize: '0.93rem',
              fontFamily: 'var(--font-body)',
              padding: '13px 16px',
              caretColor: 'var(--gold)',
              ...props.style,
            }}
          />
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
AuthInput.displayName = 'AuthInput';
export default AuthInput;
