'use client';

interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface StatusTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function StatusTabs({ tabs, active, onChange, className = '' }: StatusTabsProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 4,
        gap: 2,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0,
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              background: isActive ? 'var(--surface)' : 'transparent',
              border: 'none',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 6,
                minWidth: 18,
                height: 18,
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: 600,
                background: isActive ? 'var(--accent-light)' : 'var(--border)',
                color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                lineHeight: 1,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
