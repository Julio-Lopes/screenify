import { Check, ChevronDown, Gauge, Info } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../utils/cn';

export interface QualityOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

interface QualityMenuProps<T extends string> {
  options: readonly QualityOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
  triggerLabel: string;
  note?: string;
}

/** Quality Selector do design system: gatilho compacto e lista de seleção única com check */
export function QualityMenu<T extends string>({ options, selected, onSelect, triggerLabel, note }: QualityMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Ao abrir, o foco vai para a opção marcada
  useEffect(() => {
    if (open) {
      const index = Math.max(0, options.findIndex((o) => o.id === selected));
      itemRefs.current[index]?.focus();
    }
  }, [open, options, selected]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Qualidade: ${triggerLabel}`}
        className="flex h-7 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-2 font-mono text-caption font-medium text-text-primary transition-colors duration-120 hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
      >
        <Gauge size={13} className="text-text-secondary" aria-hidden />
        {triggerLabel}
        <ChevronDown size={13} className="text-text-muted" aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Qualidade"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 bottom-full z-[1200] mb-2 flex w-[280px] animate-toast flex-col gap-px rounded-lg border border-border bg-surface-elevated p-1 shadow-md"
        >
          <div className="flex items-center justify-between px-2.5 pt-2.5 pb-2">
            <span className="text-[13px] font-semibold">Qualidade</span>
            <Gauge size={15} className="text-text-muted" aria-hidden />
          </div>

          {options.map((option, index) => {
            const checked = option.id === selected;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => {
                  onSelect(option.id);
                  close();
                }}
                className={cn(
                  'flex h-[38px] cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left outline-none',
                  'hover:bg-surface-hover focus-visible:bg-surface-hover',
                  checked ? 'bg-surface-hover text-text-primary' : 'text-text-label',
                )}
              >
                <span className="flex-1 font-mono text-[13px] font-medium">{option.label}</span>
                {option.hint && <span className="font-mono text-[11px] text-text-muted">{option.hint}</span>}
                <span className="flex w-4">{checked && <Check size={16} className="text-primary-hover" aria-hidden />}</span>
              </button>
            );
          })}

          {note && (
            <div className="mx-1.5 mt-1 mb-1.5 flex gap-2 rounded-sm bg-info/8 px-2.5 py-2 text-caption leading-[18px] text-info-text">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              {note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}