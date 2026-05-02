interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, {
  bg: string;
  color: string;
  border: string;
  label: string;
}> = {
  PENDING:           { bg: 'var(--warning-light)', color: 'var(--warning)',    border: '#FDE68A',        label: 'Pending' },
  APPROVED:          { bg: 'var(--success-light)', color: 'var(--success)',    border: '#6EE7B7',        label: 'Approved' },
  LIVE:              { bg: 'var(--accent-light)',  color: 'var(--accent)',     border: '#A5B4FC',        label: 'Live' },
  SCHEDULED:         { bg: 'var(--purple-light)',  color: 'var(--purple)',     border: '#C4B5FD',        label: 'Scheduled' },
  REJECTED:          { bg: 'var(--danger-light)',  color: 'var(--danger)',     border: '#FCA5A5',        label: 'Rejected' },
  TAKEN_DOWN:        { bg: '#FFF1F2',              color: '#E11D48',           border: '#FECDD3',        label: 'Taken Down' },
  REUPLOAD_REQUIRED: { bg: 'var(--orange-light)',  color: 'var(--orange)',     border: '#FDBA74',        label: 'Reupload Required' },
  DISMISSED:         { bg: 'var(--surface-2)',     color: 'var(--text-muted)', border: 'var(--border)',  label: 'Dismissed' },
  RESOLVED:          { bg: 'var(--success-light)', color: 'var(--success)',    border: '#6EE7B7',        label: 'Resolved' },
  ACTIVE:            { bg: 'var(--success-light)', color: 'var(--success)',    border: '#6EE7B7',        label: 'Active' },
  INACTIVE:          { bg: 'var(--surface-2)',     color: 'var(--text-muted)', border: 'var(--border)',  label: 'Inactive' },
  PREMIUM:           { bg: 'var(--purple-light)',  color: 'var(--purple)',     border: '#C4B5FD',        label: 'Premium' },
  SUCCESS:           { bg: 'var(--success-light)', color: 'var(--success)',    border: '#6EE7B7',        label: 'Success' },
  FAILED:            { bg: 'var(--danger-light)',  color: 'var(--danger)',     border: '#FCA5A5',        label: 'Failed' },
  ADMIN_GRANTED:     { bg: 'var(--cyan-light)',    color: 'var(--cyan)',       border: '#67E8F9',        label: 'Admin Grant' },
  REFUNDED:          { bg: 'var(--surface-2)',     color: 'var(--text-muted)', border: 'var(--border)',  label: 'Refunded' },
  OPEN:              { bg: 'var(--warning-light)', color: 'var(--warning)',    border: '#FDE68A',        label: 'Open' },
};

const FALLBACK = {
  bg: 'var(--surface-2)',
  color: 'var(--text-muted)',
  border: 'var(--border)',
  label: '',
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const s = STATUS_CONFIG[status] ?? FALLBACK;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label || status}
    </span>
  );
}
