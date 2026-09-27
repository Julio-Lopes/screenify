import { useState } from 'react';
import { normalizeRoomCodeInput } from '../../utils/room-code';
import { cn } from '../../utils/cn';

const PLACEHOLDER = 'X7K29MPA';

interface RoomCodeInputProps {
  id: string;
  /** Código no formato XXXX-XXXX (ou parcial) */
  value: string;
  onChange: (code: string) => void;
}

/**
 * Oito casas visíveis com um input transparente por cima: digitar, colar o código ou
 * colar o link inteiro da sala continua funcionando como num campo de texto comum.
 */
export function RoomCodeInput({ id, value, onChange }: RoomCodeInputProps) {
  const [focused, setFocused] = useState(false);
  const chars = value.replace('-', '');
  const caret = Math.min(chars.length, 7);

  function cell(index: number) {
    const ch = chars[index];
    const active = focused && index === caret;

    return (
      <span
        key={index}
        className={cn(
          'flex h-[46px] max-w-[33px] min-w-0 flex-1 items-center justify-center rounded-md border bg-background font-mono text-[18px] leading-none font-medium',
          'lg:h-[42px] lg:w-[34px] lg:max-w-none lg:flex-none lg:rounded-[7px] lg:text-[17px]',
          'transition-[border-color,box-shadow] duration-120',
          active
            ? 'border-border-focus shadow-[0_0_0_3px_rgba(99,102,241,0.25)]'
            : ch
              ? 'border-border-strong'
              : 'border-border',
          ch ? 'text-text-primary' : 'text-border-strong',
        )}
      >
        {ch ?? PLACEHOLDER[index]}
      </span>
    );
  }

  return (
    <div className="relative flex items-center justify-between gap-1 lg:justify-start lg:gap-[5px]">
      <span className="contents" aria-hidden>
        {[0, 1, 2, 3].map(cell)}
        <span className="h-0.5 w-1.5 shrink-0 bg-text-disabled lg:mx-[3px] lg:w-2" />
        {[4, 5, 6, 7].map(cell)}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(normalizeRoomCodeInput(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="X7K2-9MPA"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="go"
        className="absolute inset-0 size-full cursor-text text-base opacity-0"
      />
    </div>
  );
}
