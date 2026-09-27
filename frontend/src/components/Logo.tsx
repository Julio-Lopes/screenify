import { ScreenShare } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../utils/cn';

interface LogoProps {
  /** md é o da sala; lg é o do cabeçalho do site */
  size?: 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const large = size === 'lg';

  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-md focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-md bg-primary text-white',
          large ? 'size-7 md:size-[30px]' : 'size-7',
        )}
      >
        <ScreenShare size={large ? 16 : 15} strokeWidth={2} aria-hidden />
      </span>
      <span className={cn('font-semibold', large ? 'text-base tracking-[-0.015em]' : 'text-[15px] tracking-[-0.01em]')}>
        Screenify
      </span>
    </Link>
  );
}
