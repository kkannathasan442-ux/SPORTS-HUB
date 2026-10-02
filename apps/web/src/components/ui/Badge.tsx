import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'info' | 'error' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-brand-50 text-brand-700 border-brand-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    outline: 'border-slate-300 text-slate-700 bg-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
