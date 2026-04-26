'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default:
          'bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus:ring-[#2563EB]',
        outline:
          'border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] focus:ring-[#2563EB]',
        ghost:
          'bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]',
        destructive:
          'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus:ring-[#DC2626]',
        success:
          'bg-[#16A34A] text-white hover:bg-[#15803D] focus:ring-[#16A34A]',
        warning:
          'bg-[#D97706] text-white hover:bg-[#B45309] focus:ring-[#D97706]',
      },
      size: {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-3.5 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
