'use client';
import { forwardRef, InputHTMLAttributes } from 'react';

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)' }}
        >
          {label}
        </label>
        <div className="auth-field pb-2">
          <input
            ref={ref}
            id={inputId}
            {...props}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #2a2520',
              outline: 'none',
              color: 'var(--ivory)',
              fontSize: '0.95rem',
              fontFamily: 'var(--font-body)',
              padding: '6px 0',
              ...props.style,
            }}
          />
        </div>
        {error && (
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--destructive))', marginTop: 4 }}>
            {error}
          </p>
        )}
      </div>
    );
  },
);
AuthInput.displayName = 'AuthInput';
export default AuthInput;
