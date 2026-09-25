import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  /** Impede fechar por Esc ou clique fora (ex.: enquanto uma ação está em andamento) */
  dismissible?: boolean;
}

export function Modal({ open, onClose, title, description, children, footer, dismissible = true }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: o navegador fecharia sozinho; quem decide é o estado do React
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && dismissible) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[420px] rounded-xl border border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-background/72 open:animate-modal"
    >
      <div className="flex flex-col gap-1 px-5 pt-5">
        <h2 id={titleId} className="text-[18px] leading-7 font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-body-sm text-text-secondary">
            {description}
          </p>
        )}
      </div>
      <div className="p-5">{children}</div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>
    </dialog>
  );
}