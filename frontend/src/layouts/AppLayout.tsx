import { Pencil, Zap } from 'lucide-react';
import { Outlet } from 'react-router';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { useUiStore } from '../stores/ui.store';

export function AppLayout() {
  const openCreateRoom = useUiStore((s) => s.openCreateRoom);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 items-center gap-3 border-b border-border-subtle px-6">
        <Logo />
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={openCreateRoom}>
          Criar sala
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-14">
        <Outlet />
      </main>

      <footer className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1 border-t border-border-subtle px-6 py-3 text-caption text-text-muted">
        <span className="flex items-center gap-1.5">
          <Zap size={13} aria-hidden />
          Baixa latência via WebRTC
        </span>
        <span className="flex items-center gap-1.5">
          <Pencil size={13} aria-hidden />
          Anotações em tempo real
        </span>
        <span className="flex-1" />
        <span className="font-mono">{window.location.host}</span>
      </footer>

      <CreateRoomModal />
    </div>
  );
}