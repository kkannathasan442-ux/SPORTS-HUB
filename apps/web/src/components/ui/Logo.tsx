import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  showTagline = false,
}) => {
  const iconSizes = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-xl',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <Link
      href="/"
      className={cn('inline-flex items-center gap-2.5 group select-none', className)}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-sports-navy text-white font-black tracking-tighter shadow-sm group-hover:bg-brand-600 transition-colors duration-200',
          iconSizes[size]
        )}
      >
        <span className="bg-gradient-to-tr from-white via-slate-100 to-sky-300 bg-clip-text text-transparent">
          S
        </span>
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            'font-bold tracking-tight text-slate-900 group-hover:text-sports-navy transition-colors',
            textSizes[size]
          )}
        >
          Sports<span className="text-sports-accent">Hub</span>
        </span>
        {showTagline && (
          <span className="text-[10px] font-medium tracking-wide uppercase text-slate-500">
            Book · Play · Compete · Connect
          </span>
        )}
      </div>
    </Link>
  );
};
