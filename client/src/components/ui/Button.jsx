import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn.js';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm',
  secondary: 'bg-white text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50 active:bg-brand-100',
  soft: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
  ghost: 'bg-transparent text-brand-800 hover:bg-brand-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
};
const SIZES = {
  sm: 'min-h-[36px] px-3 text-sm',
  md: 'min-h-tap px-4 text-[15px]',
  lg: 'min-h-[52px] px-6 text-base',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
