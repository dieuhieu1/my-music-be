'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

const ACCENT: Record<ToastKind, string> = {
  success: 'var(--success)',
  error:   'var(--danger)',
  warning: 'var(--warning)',
};

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle   size={15} color="var(--success)" strokeWidth={2} />,
  error:   <XCircle       size={15} color="var(--danger)"  strokeWidth={2} />,
  warning: <AlertTriangle size={15} color="var(--warning)" strokeWidth={2} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px 11px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${ACCENT[t.kind]}`,
              borderRadius: 'var(--radius)',
              minWidth: 260,
              maxWidth: 360,
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'all',
            }}
          >
            <div style={{ flexShrink: 0 }}>{ICONS[t.kind]}</div>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
              {t.message}
            </span>
            <button
              onClick={() => remove(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--text-faint)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                flexShrink: 0,
                transition: 'color 100ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              aria-label="Dismiss"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
