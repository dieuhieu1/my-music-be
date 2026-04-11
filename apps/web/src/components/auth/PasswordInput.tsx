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
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)' }}
        >
          {label}
        </label>
        <div className="auth-field pb-2 flex items-center gap-2">
          <input
            ref={ref}
            id={inputId}
            type={show ? 'text' : 'password'}
            {...props}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #2a2520',
              outline: 'none',
              color: 'var(--ivory)',
              fontSize: '0.95rem',
              fontFamily: 'var(--font-body)',
              padding: '6px 0',
            }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            style={{ color: 'var(--muted-text)', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            tabIndex={-1}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
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
PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;
