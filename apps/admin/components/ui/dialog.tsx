'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Dialog        = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose   = RadixDialog.Close;

export function DialogContent({
  children, title, description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }} />
      <RadixDialog.Content style={{
        position: 'fixed', left: 'calc(50% + 120px)', top: '50%', zIndex: 51,
        transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 420,
        outline: 'none',
      }}>
        <div className="anim-fade-up" style={{
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 12, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <RadixDialog.Title style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close style={{
              background: 'none', border: 'none', color: 'var(--text-faint)',
              cursor: 'pointer', padding: 4, borderRadius: 4,
              transition: 'color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
            >
              <X size={15} />
            </RadixDialog.Close>
          </div>
          {children}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      {children}
    </div>
  );
}

type ConfirmVariant = 'destructive' | 'default' | 'success';

const VARIANT_BG: Record<ConfirmVariant, string> = {
  destructive: 'var(--danger)',
  default:     'var(--accent)',
  success:     'var(--success)',
};

export function ConfirmDialog({
  open, onOpenChange, title, description, onConfirm,
  confirmLabel = 'Confirm', confirmVariant = 'destructive',
  loading = false, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const bg = VARIANT_BG[confirmVariant];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {children}
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: 'transparent', border: '1px solid var(--border-2)',
              color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: bg, color: '#fff', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'opacity 150ms',
            }}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
