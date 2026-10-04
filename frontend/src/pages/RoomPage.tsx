import type { Participant, RoomSummary } from '@screenify/shared';
import {
  ChevronLeft,
  Link2,
  LoaderCircle,
  Lock,
  LogOut,
  MonitorOff,
  ScreenShare,
  SearchX,
  Undo2,
  Unplug,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { DrawingToolbar } from '../annotation/DrawingToolbar';
import { TOOLS } from '../annotation/tools';
import { useAnnotations } from '../annotation/useAnnotations';
import { Logo } from '../components/Logo';
import { StateMessage } from '../components/StateMessage';
import { AvatarGroup } from '../components/room/AvatarGroup';
import { EndRoomModal } from '../components/room/EndRoomModal';
import { JoinForm, type JoinFormValues } from '../components/room/JoinForm';
import { LiveBadge } from '../components/room/LiveBadge';
import { ParticipantList, ParticipantsPanel } from '../components/room/ParticipantsPanel';
import { QualityBadges } from '../components/room/QualityBadges';
import { RemoteScreen } from '../components/room/RemoteScreen';
import { RoomShell } from '../components/room/RoomShell';
import { ScreenPreview } from '../components/room/ScreenPreview';
import { ShareScreenButton } from '../components/room/ShareScreenButton';
import { StreamStatusBar } from '../components/room/StreamStatusBar';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { useMediaSession } from '../hooks/useMediaSession';
import { useRoom } from '../hooks/useRoom';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { useRoomProducers } from '../hooks/useRoomProducers';
import { useScreenShare } from '../hooks/useScreenShare';
import { useScreenAudio } from '../hooks/useScreenAudio';
import { useScreenView } from '../hooks/useScreenView';
import { useStreamStats } from '../hooks/useStreamStats';
import { usePreferencesStore } from '../stores/preferences.store';
import type { CursorContext } from '../cursor/CursorLayer';
import { getSharePreset } from '../media/quality-presets';
import { ApiError } from '../services/api';
import { deleteRoom } from '../services/rooms';
import type { AppSocket } from '../services/socket';
import { createGuestSession } from '../services/users';
import { useSessionStore } from '../stores/session.store';
import { toast } from '../stores/toast.store';
import { cn } from '../utils/cn';
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
          socket={state.socket}
          joinedAt={state.joinedAt}
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
  socket: AppSocket;
  joinedAt: number;
}

function RoomView({ room, self, participants, reconnecting, token, socket, joinedAt }: RoomViewProps) {
  const navigate = useNavigate();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  // Painéis sobrepostos do tablet e do celular (no desktop ficam fixos na tela)
  const [sheet, setSheet] = useState<'participants' | 'tools' | null>(null);
  const isHost = self.role === 'HOST';

  const media = useMediaSession(socket, joinedAt);
  const share = useScreenShare(media);
  const producers = useRoomProducers(socket, media);

  const selfSharing = share.state.status === 'connecting' || share.state.status === 'live';
  const screenProducer =
    producers.find((p) => p.source === 'screen' && p.kind === 'video' && p.userId !== self.userId) ?? null;
  const otherSharer = screenProducer
    ? (participants.find((p) => p.userId === screenProducer.userId) ?? null)
    : null;
  const sharingUserId = selfSharing ? self.userId : (screenProducer?.userId ?? null);
  const isLive = share.state.status === 'live' || otherSharer !== null;
  const view = useScreenView(media, screenProducer);
  const screenAudioProducer = screenProducer
    ? (producers.find((p) => p.source === 'screen' && p.kind === 'audio' && p.userId === screenProducer.userId) ?? null)
    : null;
  const screenAudio = useScreenAudio(media, screenAudioProducer);
  const canAnnotate = share.state.status === 'live' || view.state.status === 'playing';
  // Os desenhos pertencem à transmissão atual: outra transmissão começa com a tela limpa
  const annotations = useAnnotations(
    self,
    socket,
    selfSharing ? `self:${joinedAt}` : (screenProducer?.producerId ?? null),
  );
  const showCursors = usePreferencesStore((s) => s.showCursors);
  // Métricas de quem transmite (o que sai) ou de quem assiste (o que chega)
  const sending = share.state.status === 'live';
  const watching = view.state.status === 'playing';
  const outboundStats = useStreamStats(share.getStats, 'outbound', sending);
  const inboundStats = useStreamStats(view.getStats, 'inbound', watching && !sending);
  const toggleCursors = usePreferencesStore((s) => s.toggleCursors);
  const { getRemoteActive } = annotations;
  const cursors: CursorContext = useMemo(
    () => ({
      socket,
      participants,
      selfId: self.userId,
      visible: showCursors,
      toggle: toggleCursors,
      isDrawing: (userId) => getRemoteActive().some((stroke) => stroke.userId === userId),
    }),
    [socket, participants, self.userId, showCursors, toggleCursors, getRemoteActive],
  );
  // Badges do cabeçalho: a qualidade escolhida por quem transmite (estável). A real aparece no player
  const sharePreset = getSharePreset(share.preset);
  const liveTarget =
    share.state.status === 'live'
      ? { height: sharePreset.height, frameRate: sharePreset.frameRate }
      : otherSharer
        ? (screenProducer?.target ?? null)
        : null;

        const closeSheet = useCallback(() => setSheet(null), []);
        const currentTool = TOOLS.find((t) => t.id === annotations.tool) ?? TOOLS[0];

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
            <header className="flex h-15 shrink-0 items-center gap-2 border-b border-border-subtle px-2 sm:gap-4 sm:px-6">
        {/* Celular: voltar à esquerda, como no design system; a partir do tablet, a marca */}
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Sair da sala"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-primary hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none sm:hidden"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="hidden sm:contents">
          <Logo />
          <span className="h-5 w-px bg-border" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="truncate text-body-sm font-semibold">{room.name}</h1>
          <span className="hidden shrink-0 font-mono text-caption whitespace-nowrap text-text-muted lg:inline">
            {room.code}
          </span>
          {room.hasPassword && (
            <Lock size={14} className="shrink-0 text-text-muted" aria-label="Sala protegida por senha" />
          )}
          {isLive && <LiveBadge />}
          {isLive && liveTarget && <QualityBadges quality={liveTarget} />}
        </div>
        <span className="hidden lg:contents">
          <AvatarGroup participants={participants} />
        </span>
        {/* Abaixo de 1024px, o painel de participantes vira um painel sobreposto */}
        <button
          type="button"
          onClick={() => setSheet('participants')}
          aria-label={`Participantes (${participants.length})`}
          className="hidden h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 font-mono text-caption text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none sm:flex lg:hidden"
        >
          <Users size={15} aria-hidden />
          {participants.length}
        </button>
        {/* Celular sem captura de tela (o caso comum): o botão desabilitado só ocuparia espaço */}
        <span className={share.supported ? 'contents' : 'hidden sm:contents'}>
          <ShareScreenButton
            state={share.state}
            supported={share.supported}
            otherSharerName={otherSharer?.displayName ?? null}
            disabled={reconnecting}
            onStart={share.start}
            onStop={share.stop}
          />
        </span>
        <Button variant="secondary" size="sm" onClick={copyLink} aria-label="Convidar">
          <Link2 size={15} aria-hidden />
          <span className="hidden lg:inline">Convidar</span>
        </Button>
        <span className="hidden sm:contents">
          {isHost && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)} className="hover:text-error-text">
              Encerrar sala
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Sair da sala">
            <LogOut size={15} aria-hidden />
            <span className="hidden lg:inline">Sair</span>
          </Button>
        </span>
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
        {/* No celular o vídeo ocupa a largura toda, sem margem nem borda */}
        <main className="flex min-w-0 flex-1 flex-col gap-3 sm:p-6">
          <div className="flex min-h-56 flex-none items-center justify-center overflow-hidden bg-black max-sm:aspect-video sm:min-h-0 sm:flex-1 sm:rounded-lg sm:border sm:border-border">
            {share.state.status === 'connecting' || share.state.status === 'live' ? (
              <ScreenPreview
                stream={share.state.stream}
                quality={share.state.status === 'live' ? share.state.quality : null}
                connecting={share.state.status === 'connecting'}
                preset={share.preset}
                onPresetChange={share.setPreset}
                mode={share.mode}
                onModeChange={share.setMode}
                annotations={annotations}
                cursors={cursors}
              />
                        ) : otherSharer ? (
              view.state.status === 'playing' ? (
                <RemoteScreen
                  stream={view.state.stream}
                  audioStream={screenAudio}
                  sharerName={otherSharer.displayName}
                  layers={view.layers}
                  selectedLayer={view.selectedLayer}
                  expectedHeight={view.expectedHeight}
                  onLayerChange={view.setLayer}
                  annotations={annotations}
                  cursors={cursors}
                />
              ) : view.state.status === 'error' ? (
                <StateMessage
                  icon={WifiOff}
                  tone="error"
                  title="Não foi possível exibir a transmissão"
                  description={view.state.message}
                  actions={<Button onClick={view.retry}>Tentar de novo</Button>}
                />
              ) : (
                <div role="status" className="flex items-center gap-2.5 text-body-sm text-text-secondary">
                  <LoaderCircle size={16} className="animate-spin" aria-hidden />
                  Conectando à transmissão de {otherSharer.displayName}…
                </div>
              )
            ) : (
              <StateMessage
                icon={MonitorOff}
                title="Nenhuma transmissão ativa."
                description="Quando alguém compartilhar a tela, ela aparece aqui."
                actions={
                  share.supported && (
                    <Button
                      variant="secondary"
                      onClick={share.start}
                      disabled={reconnecting}
                      loading={share.state.status === 'starting'}
                      loadingText="Iniciando…"
                    >
                      <ScreenShare size={16} aria-hidden />
                      Compartilhar minha tela
                    </Button>
                  )
                }
              />
            )}
          </div>
          {/* A barra aparece só quando há uma tela para anotar; no celular ela vive no painel de ferramentas */}
          {canAnnotate && (
            <div className="hidden shrink-0 justify-center sm:flex">
              <DrawingToolbar annotations={annotations} />
            </div>
          )}
        </main>
        <ParticipantsPanel participants={participants} selfId={self.userId} sharingUserId={sharingUserId} />
      </div>
      
      {(sending || watching) && (
        <StreamStatusBar
          metrics={sending ? outboundStats : inboundStats}
          label={sending ? 'Transmitindo' : `Assistindo ${otherSharer?.displayName ?? ''}`.trim()}
        />
      )}
      {/* Celular: barra de ações inferior com alvos de 44px, como no design system */}
      <nav
        aria-label="Ações da sala"
        className="flex shrink-0 items-center justify-around border-t border-border-subtle bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <MobileAction
          icon={currentTool.icon}
          label="Ferramentas"
          active={annotations.tool !== 'select'}
          disabled={!canAnnotate}
          onClick={() => setSheet('tools')}
        />
        <MobileAction
          icon={Undo2}
          label="Desfazer"
          disabled={!canAnnotate || !annotations.canUndo}
          onClick={annotations.undo}
        />
        <MobileAction
          icon={Users}
          label={`Pessoas (${participants.length})`}
          onClick={() => setSheet('participants')}
        />
      </nav>

      <Sheet open={sheet === 'participants'} onClose={closeSheet} title={`Participantes · ${participants.length}`}>
        <ParticipantList participants={participants} selfId={self.userId} sharingUserId={sharingUserId} />
        {isHost && (
          <div className="mt-4 border-t border-border-subtle pt-4 sm:hidden">
            <Button variant="danger" className="w-full" onClick={() => setConfirmEnd(true)}>
              Encerrar sala
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'tools' && canAnnotate} onClose={closeSheet} title="Ferramentas">
        <div className="flex justify-center">
          <DrawingToolbar annotations={annotations} shortcuts={false} onToolSelected={closeSheet} />
        </div>
      </Sheet>
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
      description="Verifique o código ou peça um novo link a quem criou a sala. Salas que ficam vazias por alguns minutos são encerradas automaticamente."
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

interface MobileActionProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function MobileAction({ icon: Icon, label, active, disabled, onClick }: MobileActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex min-h-11 min-w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 text-[11px] font-medium',
        'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none disabled:text-text-disabled',
        active ? 'text-primary-hover' : 'text-text-secondary',
      )}
    >
      <Icon size={20} aria-hidden />
      {label}
    </button>
  );
}