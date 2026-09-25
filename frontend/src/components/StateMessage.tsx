import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StateMessageProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Código técnico exibido em mono para facilitar suporte */
  code?: string;
  actions?: ReactNode;
  tone?: 'neutral' | 'error';
}

export function StateMessage({ icon: Icon, title, description, code, actions, tone = 'neutral' }: StateMessageProps) {
  return (
    <div className="flex max-w-[400px] flex-col items-center gap-4 text-center">
      <span
        className={
          tone === 'error'
            ? 'flex size-12 items-center justify-center rounded-full bg-error/12 text-error-text'
            : 'flex size-12 items-center justify-center rounded-full bg-surface-active text-text-secondary'
        }
      >
        <Icon size={20} aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        {code && <span className="font-mono text-caption text-text-muted">{code}</span>}
        <h1 className="text-h4 font-semibold">{title}</h1>
        {description && <p className="text-body-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}