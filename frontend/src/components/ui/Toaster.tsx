import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import { useToastStore, type ToastKind } from '../../stores/toast.store';

const icons: Record<ToastKind, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: 'text-success-text' },
  error: { icon: CircleAlert, className: 'text-error-text' },
  info: { icon: Info, className: 'text-info' },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[1400] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map(({ id, kind, title, description }) => {
        const { icon: Icon, className } = icons[kind];
        return (
          <div
            key={id}
            role={kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex animate-toast items-start gap-2.5 rounded-lg border border-border bg-surface-elevated px-3.5 py-3 text-body-sm shadow-md"
          >
            <Icon size={16} className={`mt-0.5 shrink-0 ${className}`} aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span>{title}</span>
              {description && <span className="text-caption text-text-secondary">{description}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}