import { Check, Redo2, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { COLORS, TOOLS, WIDTHS } from './tools';
import type { Annotations } from './useAnnotations';

/** Campos de texto têm os próprios atalhos: letras ali são texto, não troca de ferramenta */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Drawing Toolbar do design system: ferramentas à esquerda, cor e estilo no meio,
 * histórico à direita. Cada botão tem dica com atalho de teclado.
 */
interface DrawingToolbarProps {
  annotations: Annotations;
  /**
   * Atalhos de teclado ligados. Só uma barra na tela pode tê-los: com duas (a fixa e a do painel
   * do celular), um Ctrl+Z desfaria duas vezes.
   */
  shortcuts?: boolean;
  /** Chamado ao escolher uma ferramenta com clique ou toque; o painel do celular fecha para liberar o desenho */
  onToolSelected?: () => void;
}

export function DrawingToolbar({ annotations, shortcuts = true, onToolSelected }: DrawingToolbarProps) {
  const { tool, setTool, undo, redo, canUndo, canRedo, clear, isHost, strokes, canErase } = annotations;
  const hasErasable = strokes.some(canErase);

  // Atalhos: uma letra por ferramenta, Esc volta a selecionar, Ctrl+Z e Ctrl+Shift+Z para o histórico
  useEffect(() => {
    if (!shortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if ((key === 'z' && event.shiftKey) || key === 'y') {
          event.preventDefault();
          redo();
        }
        return;
      }
      if (event.altKey) return;

      if (event.key === 'Escape') {
        setTool('select');
        return;
      }
      const match = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (match) setTool(match.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts, setTool, undo, redo]);

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas de anotação"
      className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-xl border border-border bg-surface-elevated p-1 shadow-md"
    >
      {TOOLS.map((t) => (
        <ToolbarButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          shortcut={t.key}
          active={tool === t.id}
          onClick={() => {
            setTool(t.id);
            onToolSelected?.();
          }}
        />
      ))}

      <Divider />
      <StyleMenu annotations={annotations} />
      <Divider />

      <ToolbarButton icon={Undo2} label="Desfazer" shortcut="Ctrl Z" disabled={!canUndo} onClick={undo} />
      <ToolbarButton icon={Redo2} label="Refazer" shortcut="Ctrl ⇧ Z" disabled={!canRedo} onClick={redo} />
      <ToolbarButton
        icon={Trash2}
        label={isHost ? 'Limpar todas as anotações' : 'Limpar minhas anotações'}
        destructive
        disabled={!hasErasable}
        onClick={clear}
      />
    </div>
  );
}

function Divider() {
  return <span className="mx-1.5 h-6 w-px bg-border" aria-hidden />;
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, shortcut, active, disabled, destructive, onClick }: ToolbarButtonProps) {
  return (
    <span className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors duration-120',
          'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:text-text-disabled',
          active
            ? 'bg-primary-soft text-text-primary'
            : 'text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text-primary',
          destructive && 'enabled:hover:bg-error/12 enabled:hover:text-error-text',
        )}
      >
        <Icon size={18} aria-hidden />
      </button>
      <Tooltip label={label} shortcut={shortcut} />
    </span>
  );
}

/** Dica do design system: fundo claro, nome e atalho em mono */
function Tooltip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute bottom-12 left-1/2 z-[1500] flex -translate-x-1/2 items-center gap-2 rounded-sm bg-text-primary px-2 py-1.5 text-caption font-medium whitespace-nowrap text-background opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
    >
      {label}
      {shortcut && <span className="font-mono text-[10px] text-text-muted">{shortcut}</span>}
    </span>
  );
}

/** Cor, espessura e opacidade num popover acima da barra */
function StyleMenu({ annotations }: { annotations: Annotations }) {
  const { style, setStyle, ownColor } = annotations;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const palette = [{ name: 'Sua cor', value: ownColor }, ...COLORS.filter((c) => c.value !== ownColor)];
  const colorName = palette.find((c) => c.value.toLowerCase() === style.color.toLowerCase())?.name ?? style.color;

  return (
    <span ref={rootRef} className="group relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Cor e traço: ${colorName}, ${style.width}px, ${Math.round(style.opacity * 100)}%`}
        className="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
      >
        <span
          className="size-[18px] rounded-full"
          style={{ backgroundColor: style.color, boxShadow: '0 0 0 2px var(--color-surface-elevated), 0 0 0 3px var(--color-border-strong)' }}
        />
      </button>
      {!open && <Tooltip label="Cor e traço" />}

      {open && (
        <div
          role="dialog"
          aria-label="Cor e traço"
          className="absolute bottom-12 left-1/2 z-[1200] flex w-64 -translate-x-1/2 animate-toast flex-col gap-4 rounded-lg border border-border bg-surface-elevated p-3 shadow-md"
        >
          <Section title="Cor" value={colorName}>
            <div className="flex flex-wrap gap-1.5">
              {palette.map((color) => {
                const selected = color.value.toLowerCase() === style.color.toLowerCase();
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setStyle({ color: color.value })}
                    aria-label={color.name}
                    aria-pressed={selected}
                    title={color.name}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
                    style={{
                      backgroundColor: color.value,
                      boxShadow: selected ? '0 0 0 2px var(--color-surface-elevated), 0 0 0 4px var(--color-text-primary)' : undefined,
                    }}
                  >
                    {selected && <Check size={14} className="text-background mix-blend-difference" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Espessura" value={`${style.width}px`}>
            <div className="grid grid-cols-4 gap-1">
              {WIDTHS.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => setStyle({ width })}
                  aria-label={`${width} pixels`}
                  aria-pressed={style.width === width}
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-sm border focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none',
                    style.width === width ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-hover',
                  )}
                >
                  <span className="rounded-full bg-text-primary" style={{ width: width + 2, height: width + 2 }} />
                </button>
              ))}
            </div>
          </Section>

          <Section title="Opacidade" value={`${Math.round(style.opacity * 100)}%`}>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={Math.round(style.opacity * 100)}
              onChange={(e) => setStyle({ opacity: Number(e.target.value) / 100 })}
              aria-label="Opacidade"
              className="w-full cursor-pointer accent-primary"
            />
          </Section>
        </div>
      )}
    </span>
  );
}

function Section({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-caption">
        <span className="font-medium text-text-label">{title}</span>
        <span className="font-mono text-text-muted">{value}</span>
      </div>
      {children}
    </div>
  );
}