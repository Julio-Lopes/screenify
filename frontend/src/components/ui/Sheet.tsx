import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Painel sobreposto do design system: no celular sobe de baixo (bottom sheet), no tablet
 * entra pela direita (drawer). No desktop não é usado: lá os painéis ficam fixos na tela.
 * O vídeo nunca encolhe para dar lugar a ele.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      // O foco volta para o botão que abriu o painel
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] lg:hidden">
      <div className="absolute inset-0 animate-fade bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'absolute flex flex-col bg-surface shadow-lg outline-none',
          // Celular: de baixo para cima, com a alça do design system
          'inset-x-0 bottom-0 max-h-[75dvh] animate-toast rounded-t-[20px] border-t border-border pb-[env(safe-area-inset-bottom)]',
          // Tablet: da direita
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-80 sm:animate-drawer sm:rounded-none sm:border-t-0 sm:border-l',
        ].join(' ')}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong sm:hidden" aria-hidden />
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <h2 id={titleId} className="text-body-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-11 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}