import { cn } from '../utils/cn';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  className?: string;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Iniciais sobre a cor da pessoa a 15%, como no design system (cor opaca para sobrepor em grupo) */
export function Avatar({ name, color, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, var(--color-surface))`, color }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-caption',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}