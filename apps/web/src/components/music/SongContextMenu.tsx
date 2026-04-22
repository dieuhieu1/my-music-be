'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, ListPlus, Download } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface SongContextMenuProps {
  onAddToQueue?: () => void;
  onDownload?: () => void;
}

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: 13,
  outline: 'none', border: 'none', background: 'transparent',
  width: '100%', textAlign: 'left',
  transition: 'background 0.12s ease',
};

export function SongContextMenu({ onAddToQueue, onDownload }: SongContextMenuProps) {
  const { isPremium } = useAuthStore();
  const premium = isPremium();
  const hasDownload = premium && !!onDownload;

  if (!onAddToQueue && !hasDownload) return null;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-text)', padding: '6px',
            borderRadius: 6, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 32, minHeight: 32,
            transition: 'color 0.15s ease', outline: 'none',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ivory)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-text)'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          <MoreHorizontal size={15} />
        </button>
      </Dropdown.Trigger>

      <Dropdown.Portal>
        <Dropdown.Content
          sideOffset={4}
          align="end"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid rgba(232,184,75,0.12)',
            borderRadius: 8, padding: '4px',
            minWidth: 164,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            zIndex: 300,
          }}
        >
          {onAddToQueue && (
            <Dropdown.Item
              onSelect={onAddToQueue}
              style={{ ...itemStyle, color: 'var(--ivory)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <ListPlus size={14} color="var(--muted-text)" />
              Add to Queue
            </Dropdown.Item>
          )}

          {hasDownload && (
            <>
              {onAddToQueue && (
                <Dropdown.Separator style={{
                  height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0',
                }} />
              )}
              <Dropdown.Item
                onSelect={onDownload}
                style={{ ...itemStyle, color: 'var(--gold)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Download size={14} color="var(--gold)" />
                Download
              </Dropdown.Item>
            </>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
