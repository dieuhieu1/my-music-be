'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastKind = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-[#16A34A]" />,
  error: <XCircle size={16} className="text-[#DC2626]" />,
  warning: <AlertTriangle size={16} className="text-[#D97706]" />,
};

const kindClass: Record<ToastKind, string> = {
  success: 'border-l-[#16A34A]',
  error: 'border-l-[#DC2626]',
  warning: 'border-l-[#D97706]',
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
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 shadow-lg',
              'border-l-4',
              kindClass[t.kind],
            )}
          >
            {icons[t.kind]}
            <span className="flex-1 text-sm text-[#111827]">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="ml-2 text-[#9CA3AF] hover:text-[#374151]"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
