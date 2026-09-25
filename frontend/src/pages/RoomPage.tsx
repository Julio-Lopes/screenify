import type { Participant, RoomSummary } from '@screenify/shared';
import { Link2, LoaderCircle, Lock, LogOut, MonitorOff, SearchX, Unplug, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Logo } from '../components/Logo';
import { StateMessage } from '../components/StateMessage';
import { AvatarGroup } from '../components/room/AvatarGroup';
import { EndRoomModal } from '../components/room/EndRoomModal';
import { JoinForm, type JoinFormValues } from '../components/room/JoinForm';
import { ParticipantsPanel } from '../components/room/ParticipantsPanel';
import { RoomShell } from '../components/room/RoomShell';
import { Button } from '../components/ui/Button';
import { useRoom } from '../hooks/useRoom';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { ApiError } from '../services/api';
import { deleteRoom } from '../services/rooms';
import { createGuestSession } from '../services/users';
import { useSessionStore } from '../stores/session.store';
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
    return <RoomEntry room={state.room} />;
  }

  return (
    <RoomShell>
      {state.status === 'loading' && <Loading text="Carregando sala…" />}
      {state.status === 'not-found' && <RoomNotFound code={code} />}
      {state.status === 'error' && (
        <StateMessage
          icon={WifiOff}
          tone="error"
          title="Erro de conexão"
          description={`${state.message} Verifique sua internet e tente de novo.`}
          actions={<Button onClick={retry}>Tentar agora</Button>}
        />
      )}
    </RoomShell>
  );
}

/** Garante uma sessão antes de conectar: quem chega pelo link sem sessão informa o nome aqui */
function RoomEntry({ room }: { room: RoomSummary }) {
  const token = useSessionStore((s) => s.token);
  const setSession = useSessionStore((s) => s.setSession);
  const [initialPassword, setInitialPassword] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string>();

  if (token) {
    return <RoomConnection key={token} room={room} token={token} initialPassword={initialPassword} />;
  }

  async function handleSubmit({ displayName, password }: JoinFormValues) {
    setSubmitting(true);
    setError(null);
    setNameError(undefined);

    try {
      const session = await createGuestSession({ displayName });
      setInitialPassword(password || undefined);
      setSession(session);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setNameError(err.details?.displayName?.[0]);
      } else {
        setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoomShell>
      <JoinForm
        room={room}
        askName
        askPassword={room.hasPassword}
        submitting={submitting}
        error={error}
        fieldErrors={{ displayName: nameError }}
        onSubmit={handleSubmit}
      />
    </RoomShell>
  );
}

interface RoomConnectionProps {
  room: RoomSummary;
  token: string;
  initialPassword?: string;
}

function RoomConnection({ room, token, initialPassword }: RoomConnectionProps) {
  const { state, submitPassword, reconnect } = useRoomConnection(room.code, token, initialPassword);
  const navigate = useNavigate();

  switch (state.status) {
    case 'joined':
      return (
        <RoomView
          room={state.room}
          self={state.self}
          participants={state.participants}
          reconnecting={state.reconnecting}
          token={token}
        />
      );

    case 'connecting':
      return (
        <RoomShell>
          <Loading text="Entrando na sala…" />
        </RoomShell>
      );

    case 'password':
      return (
        <RoomShell>
          <JoinForm
            room={room}
            askName={false}
            askPassword
            submitting={false}
            error={state.error}
            onSubmit={({ password }) => submitPassword(password)}
          />
        </RoomShell>
      );

    case 'error':
      return (
        <RoomShell>
          <StateMessage
            icon={WifiOff}
            tone="error"
            title="Erro de conexão"
            description={`${state.message} Verifique sua internet e tente de novo.`}
            actions={<Button onClick={reconnect}>Tentar agora</Button>}
          />
        </RoomShell>
      );

    case 'ended':
      return (
        <RoomShell>
          {state.reason === 'not-found' && <RoomNotFound code={room.code} />}
          {state.reason === 'closed' && (
            <StateMessage
              icon={MonitorOff}
              title="Sala encerrada"
              description="Quem criou esta sala a encerrou. O link não funciona mais."
              actions={
                <Button variant="secondary" onClick={() => navigate('/')}>
                  Voltar ao início
                </Button>
              }
            />
          )}
          {state.reason === 'replaced' && (
            <StateMessage
              icon={Unplug}
              title="Sala aberta em outra aba"
              description="Você entrou nesta sala em outra aba ou janela. Só uma delas fica conectada por vez."
              actions={<Button onClick={reconnect}>Usar esta aba</Button>}
            />
          )}
        </RoomShell>
      );
  }
}

interface RoomViewProps {
  room: RoomSummary;
  self: Participant;
  participants: Participant[];
  reconnecting: boolean;
  token: string;
}

function RoomView({ room, self, participants, reconnecting, token }: RoomViewProps) {
  const navigate = useNavigate();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const isHost = self.role === 'HOST';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(buildRoomUrl(room.code));
      toast('success', 'Link copiado');
    } catch {
      toast('error', 'Não foi possível copiar o link', 'Copie o endereço direto da barra do navegador.');
    }
  }

  async function endRoom() {
    setEnding(true);
    try {
      await deleteRoom(room.code, token);
      toast('success', 'Sala encerrada');
      navigate('/');
    } catch (error) {
      toast('error', 'Não foi possível encerrar a sala', error instanceof ApiError ? error.message : undefined);
      setEnding(false);
      setConfirmEnd(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:gap-4 sm:px-6">
        <Logo />
        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="truncate text-body-sm font-semibold">{room.name}</h1>
          <span className="hidden font-mono text-caption text-text-muted sm:inline">{room.code}</span>
          {room.hasPassword && (
            <Lock size={14} className="shrink-0 text-text-muted" aria-label="Sala protegida por senha" />
          )}
        </div>
        <AvatarGroup participants={participants} />
        <Button variant="secondary" size="sm" onClick={copyLink}>
          <Link2 size={15} aria-hidden />
          <span className="hidden sm:inline">Convidar</span>
        </Button>
        {isHost && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)} className="hover:text-error-text">
            Encerrar sala
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Sair da sala">
          <LogOut size={15} aria-hidden />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </header>

      {reconnecting && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-center gap-2 border-b border-border-subtle bg-surface py-2 text-caption text-warning-text"
        >
          <LoaderCircle size={13} className="animate-spin" aria-hidden />
          Conexão perdida. Reconectando…
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
          <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-black">
            <StateMessage
              icon={MonitorOff}
              title="Nenhuma transmissão ativa."
              description="Quando alguém compartilhar a tela, ela aparece aqui."
            />
          </div>
        </main>
        <ParticipantsPanel participants={participants} selfId={self.userId} />
      </div>

      <EndRoomModal open={confirmEnd} ending={ending} onCancel={() => setConfirmEnd(false)} onConfirm={endRoom} />
    </div>
  );
}

function RoomNotFound({ code }: { code: string }) {
  const navigate = useNavigate();
  return (
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
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 text-body-sm text-text-secondary">
      <LoaderCircle size={16} className="animate-spin" aria-hidden />
      {text}
    </div>
  );
}