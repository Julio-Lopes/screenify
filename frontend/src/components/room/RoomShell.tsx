import type { ReactNode } from 'react';
import { Logo } from '../Logo';

/** Moldura das telas da sala antes de entrar: carregando, senha, erros */
export function RoomShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 items-center border-b border-border-subtle px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-14">{children}</main>
    </div>
  );
}