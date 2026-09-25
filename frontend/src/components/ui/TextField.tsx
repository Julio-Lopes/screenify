import type { LucideIcon } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  size?: 'md' | 'lg';
  mono?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  icon: Icon,
  trailing,
  size = 'md',
  mono = false,
  className,
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-text-label">
        {label}
      </label>

      <div className="relative flex items-center">
        {Icon && (
          <Icon size={16} className="pointer-events-none absolute left-3 text-text-muted" aria-hidden />
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            'w-full min-w-0 rounded-md border border-border-strong bg-surface text-text-primary outline-none',
            'placeholder:text-text-muted transition-[border-color,box-shadow] duration-120',
            'hover:border-text-disabled focus:border-border-focus focus:ring-3 focus:ring-primary/25',
            'aria-invalid:border-error aria-invalid:focus:ring-error/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            size === 'lg' ? 'h-11 text-[15px]' : 'h-10 text-body-sm',
            Icon ? 'pl-9' : 'pl-3',
            trailing ? 'pr-10' : 'pr-3',
            mono && 'font-mono font-medium tracking-[.06em]',
          )}
          {...props}
        />
        {trailing && <div className="absolute right-1">{trailing}</div>}
      </div>

      {message && (
        <p id={messageId} className={cn('text-caption', error ? 'text-error-text' : 'text-text-muted')}>
          {message}
        </p>
      )}
    </div>
  );
}