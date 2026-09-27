import { ArrowUpRight, Menu, Plus } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { Logo } from '../components/Logo';
import { ServerStatusPill } from '../components/ServerStatusPill';
import { Sheet } from '../components/ui/Sheet';
import { LINKS } from '../config/links';
import { useServerStatusPolling } from '../hooks/useServerStatusPolling';
import { useServerStatusStore } from '../stores/server-status.store';
import { useUiStore } from '../stores/ui.store';
import { cn } from '../utils/cn';

const focusRing = 'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none';

const navLink = cn(
  'flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-body-sm text-text-secondary transition-colors duration-120',
  'hover:bg-surface-elevated hover:text-text-primary',
  focusRing,
);

const menuLink = cn(
  'flex h-11 items-center justify-between rounded-md px-3 text-body-sm text-text-label hover:bg-surface-hover hover:text-text-primary',
  focusRing,
);

const FOOTER_STATUS = {
  checking: { dot: 'bg-text-disabled', label: 'verificando o servidor' },
  online: { dot: 'bg-success', label: 'todos os sistemas operando' },
  offline: { dot: 'bg-error', label: 'servidor fora do ar' },
} as const;

export function AppLayout() {
  useServerStatusPolling();
  const openCreateRoom = useUiStore((s) => s.openCreateRoom);
  const status = useServerStatusStore((s) => s.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const footerStatus = FOOTER_STATUS[status];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center gap-2.5 border-b border-border-subtle pr-2 pl-5 md:h-16 md:gap-7 md:px-8">
        <Logo size="lg" />

        <nav aria-label="Principal" className="hidden gap-1 md:flex">
          <a href="/#como-funciona" className={navLink}>
            Como funciona
          </a>
          <a href={LINKS.repository} target="_blank" rel="noreferrer" className={navLink}>
            Código-fonte
            <ArrowUpRight size={13} aria-hidden />
          </a>
        </nav>

        <span className="flex-1" />
        <ServerStatusPill />

        <button
          type="button"
          onClick={openCreateRoom}
          className={cn(
            'hidden h-[34px] cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3.5 text-body-sm font-medium text-white md:flex',
            'transition-colors duration-120 hover:bg-primary-hover active:bg-primary-active',
            focusRing,
          )}
        >
          <Plus size={15} aria-hidden />
          Criar sala
        </button>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className={cn(
            'flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-text-primary hover:bg-surface-hover md:hidden',
            focusRing,
          )}
        >
          <Menu size={20} aria-hidden />
        </button>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <nav aria-label="Principal" className="flex flex-col gap-1">
          <a href="/#como-funciona" className={menuLink} onClick={() => setMenuOpen(false)}>
            Como funciona
          </a>
          <a href={LINKS.repository} target="_blank" rel="noreferrer" className={menuLink}>
            Código-fonte
            <ArrowUpRight size={15} aria-hidden />
          </a>
          <a href={LINKS.linkedin} target="_blank" rel="noreferrer" className={menuLink}>
            LinkedIn
            <ArrowUpRight size={15} aria-hidden />
          </a>
        </nav>
      </Sheet>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <footer
        className={cn(
          'flex flex-col gap-3.5 border-t border-border-subtle bg-surface px-5 pt-5 pb-8',
          'lg:min-h-12 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-3 lg:px-8 lg:py-2.5',
        )}
      >
        <span className="flex items-center gap-1.5 font-mono text-[11.5px] leading-none font-medium text-text-secondary">
          <span className={cn('size-1.5 rounded-full', footerStatus.dot)} aria-hidden />
          {footerStatus.label}
        </span>
        <span className="hidden font-mono text-[11.5px] leading-none font-medium text-text-muted lg:inline">
          WebRTC · SFU mediasoup
        </span>
        <span className="hidden flex-1 lg:block" />
        <p className="text-[13px] leading-5 text-text-muted lg:text-[12.5px] lg:leading-[18px]">
          Projeto pessoal de portfólio, sem fins lucrativos<span className="lg:hidden">.</span>
          <span className="hidden lg:inline"> ·</span> Feito por{' '}
          <a
            href={LINKS.author}
            target="_blank"
            rel="noreferrer"
            className={cn('rounded-xs text-text-label hover:text-text-primary', focusRing)}
          >
            Julio Lopes
          </a>
          <span className="lg:hidden">.</span>
        </p>
        <div className="flex gap-2 lg:gap-5">
          <FooterLink href={LINKS.repository}>GitHub</FooterLink>
          <FooterLink href={LINKS.linkedin}>LinkedIn</FooterLink>
        </div>
      </footer>

      <CreateRoomModal />
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        // Celular: botões com área de toque de 44px; desktop: links discretos em mono
        'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border text-body-sm text-text-label',
        'lg:h-auto lg:flex-none lg:gap-1 lg:rounded-xs lg:border-0 lg:font-mono lg:text-[11.5px] lg:leading-none lg:font-medium lg:text-text-secondary',
        'hover:text-text-primary',
        focusRing,
      )}
    >
      {children}
      <ArrowUpRight size={13} className="lg:size-3" aria-hidden />
    </a>
  );
}
