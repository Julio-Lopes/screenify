import { ScreenShare } from 'lucide-react';
import { Link } from 'react-router';

export function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-md focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
        <ScreenShare size={15} strokeWidth={2} aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Screenify</span>
    </Link>
  );
}