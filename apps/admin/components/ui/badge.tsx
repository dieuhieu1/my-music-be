import { cn } from '@/lib/utils/cn';

const variantMap: Record<string, string> = {
  default: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  success: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  muted: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',
  purple: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]',
};

const statusVariantMap: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  LIVE: 'success',
  REJECTED: 'danger',
  TAKEN_DOWN: 'danger',
  SCHEDULED: 'default',
  REUPLOAD_REQUIRED: 'warning',
  DISMISSED: 'muted',
  COMPLETED: 'success',
  FAILED: 'danger',
  REFUNDED: 'muted',
  ADMIN: 'purple',
  ARTIST: 'default',
  USER: 'muted',
  PREMIUM: 'warning',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof variantMap;
  status?: string;
  className?: string;
}

export function Badge({ children, variant, status, className }: BadgeProps) {
  const resolvedVariant = status
    ? (statusVariantMap[status] ?? 'muted')
    : (variant ?? 'default');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        variantMap[resolvedVariant] ?? variantMap.muted,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DC2626] px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}
