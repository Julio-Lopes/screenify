import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border-border-strong bg-surface-elevated text-text-primary hover:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger: 'border-transparent bg-danger-solid text-white hover:bg-error',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3.5 text-body-sm',
  lg: 'h-11 px-4.5 text-[15px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,transform] duration-120 ease-standard active:scale-[.97]',
        'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}