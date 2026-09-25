import type { RoomSummary } from '@screenify/shared';
import { Link2, LoaderCircle, Lock, MonitorOff, SearchX, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Logo } from '../components/Logo';
import { StateMessage } from '../components/StateMessage';
import { Button } from '../components/ui/Button';
import { useRoom } from '../hooks/useRoom';
import { toast } from '../stores/toast.store';
import { buildRoomUrl } from '../utils/room-code';

export function RoomPage() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const rawCode = params.code ?? '';
  const code = rawCode.toUpperCase();
  const { state, retry } = useRoom(code);

  // Deixa a URL sempre no formato canônico, em maiúsculas
  useEffect(() => {
    if (rawCode !== code) navigate(`/room/${code}`, { replace: true });
  }, [rawCode, code, navigate]);

  useEffect(() => {
    document.title = state.status === 'ready' ? `${state.room.name} · Screenify` : 'Screenify';
    return () => {
      document.title = 'Screenify';
    };
  }, [state]);

  if (state.status === 'ready') {
    return <RoomView room={state.room} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 items-center border-b border-border-subtle px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-14">
        {state.status === 'loading' && (
          <div role="status" className="flex items-center gap-2.5 text-body-sm text-text-secondary">
            <LoaderCircle size={16} className="animate-spin" aria-hidden />
            Carregando sala…
          </div>
        )}

        {state.status === 'not-found' && (
          <StateMessage
            icon={SearchX}
            tone="error"
            code={`ROOM_NOT_FOUND · ${code}`}
            title="Sala não encontrada"
            description="Verifique o código ou peça um novo link a quem criou a sala."
            actions={
              <Button variant="secondary" onClick={() => navigate('/')}>
                Voltar ao início
              </Button>
            }
          />
        )}

        {state.status === 'error' && (
          <StateMessage
            icon={WifiOff}
            tone="error"
            title="Erro de conexão"
            description={`${state.message} Verifique sua internet e tente de novo.`}
            actions={<Button onClick={retry}>Tentar agora</Button>}
          />
        )}
      </main>
    </div>
  );
}

function RoomView({ room }: { room: RoomSummary }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(buildRoomUrl(room.code));
      toast('success', 'Link copiado');
    } catch {
      toast('error', 'Não foi possível copiar o link', 'Copie o endereço direto da barra do navegador.');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 items-center gap-4 border-b border-border-subtle px-4 sm:px-6">
        <Logo />
        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="truncate text-body-sm font-semibold">{room.name}</h1>
          <span className="font-mono text-caption text-text-muted">{room.code}</span>
          {room.hasPassword && (
            <Lock size={14} className="shrink-0 text-text-muted" aria-label="Sala protegida por senha" />
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={copyLink}>
          <Link2 size={15} aria-hidden />
          Convidar
        </Button>
      </header>

      <main className="flex flex-1 flex-col p-4 sm:p-6">
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-black">
          <StateMessage
            icon={MonitorOff}
            title="Nenhuma transmissão ativa."
            description="Quando alguém compartilhar a tela, ela aparece aqui."
          />
        </div>
      </main>
    </div>
  );
}