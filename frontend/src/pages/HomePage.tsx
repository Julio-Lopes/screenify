import { ArrowRight, Monitor, MonitorUp, Plus } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { HomePreview } from '../components/home/HomePreview';
import { RoomCodeInput } from '../components/home/RoomCodeInput';
import { useUiStore } from '../stores/ui.store';
import { cn } from '../utils/cn';
import { isValidRoomCode } from '../utils/room-code';
import { loadRoomPage } from './load-room-page';

const focusRing = 'focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none';

const STEPS = [
  { title: 'Crie a sala', text: 'Código curto, senha opcional. Expira sozinha após 10 min vazia.' },
  { title: 'Envie o link', text: 'Quem entra assiste direto do navegador, na resolução que a conexão aguenta.' },
  { title: 'Desenhem juntos', text: 'Traços e cursores aparecem para todos enquanto ainda estão sendo feitos.' },
];

export function HomePage() {
  // Com a Home na tela e o navegador ocioso, baixa a sala: entrar nela fica instantâneo
  useEffect(() => {
    const id = window.setTimeout(() => void loadRoomPage(), 1500);
    return () => window.clearTimeout(id);
  }, []);

  const openCreateRoom = useUiStore((s) => s.openCreateRoom);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
      <section
        className={cn(
          'grid flex-1 items-center gap-4 px-5 pt-8',
          'lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pt-16 lg:pb-14',
          'xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-14 xl:pt-18 xl:pl-18',
        )}
      >
        <div className="flex flex-col gap-6 lg:gap-8">
          <div className="flex flex-col gap-4.5 lg:gap-8">
            <p className="flex items-center gap-2 font-mono text-[11px] leading-none font-medium tracking-[0.04em] text-text-muted lg:text-caption lg:leading-none">
              <span className="inline-flex h-5 items-center gap-[5px] rounded-sm bg-danger-solid px-[7px] font-sans text-[10px] leading-none font-semibold tracking-[0.06em] text-white lg:h-[22px] lg:gap-1.5 lg:px-2 lg:text-[11px]">
                <span className="size-[5px] animate-live-pulse rounded-full bg-white motion-reduce:animate-none lg:size-1.5" />
                LIVE
              </span>
              ATÉ 1080p · <span className="hidden lg:inline">60 FPS · </span>SEM CONTA
            </p>

            <h1 className="text-[36px] leading-10 font-semibold tracking-[-0.035em] text-balance lg:text-[40px] lg:leading-[46px] xl:text-[52px] xl:leading-[58px]">
              <span className="lg:whitespace-nowrap">Compartilhe sua tela.</span>
              <br />
              <span className="text-text-muted">Todo mundo desenha por cima.</span>
            </h1>

            <p className="max-w-[460px] text-[15px] leading-[23px] text-pretty text-text-secondary lg:text-[17px] lg:leading-[27px]">
              <span className="hidden lg:inline">Crie uma sala, envie o link e compartilhe sua tela. </span>
              Quem entra assiste em tempo real e pode desenhar, marcar e apontar, com o cursor de cada pessoa visível
              para todos.
            </p>
          </div>

          <div className="flex max-w-[460px] flex-col gap-3.5">
            <button
              type="button"
              onClick={openCreateRoom}
              className={cn(
                'hidden h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[10px] bg-primary px-5 text-[15px] font-medium text-white lg:flex',
                'transition-colors duration-120 hover:bg-primary-hover active:bg-primary-active',
                focusRing,
              )}
            >
              <MonitorUp size={18} aria-hidden />
              Criar sala e compartilhar
            </button>
            <JoinRoomCard />
          </div>
        </div>

        <HomePreview />

        {/* No celular o navegador não captura a tela: criar sala vira ação secundária */}
        <div className="flex flex-col gap-2.5 lg:hidden">
          <button
            type="button"
            onClick={openCreateRoom}
            className={cn(
              'flex h-[50px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border-strong bg-surface-elevated text-[15px] font-medium text-text-primary',
              'transition-colors duration-120 hover:bg-surface-hover',
              focusRing,
            )}
          >
            <Plus size={17} aria-hidden />
            Criar sala
          </button>
          <p className="flex gap-2 text-[12.5px] leading-[18px] text-text-muted">
            <Monitor size={14} className="mt-0.5 shrink-0" aria-hidden />
            Para compartilhar a tela, abra a sala num computador. No celular você assiste e anota com o dedo.
          </p>
        </div>
      </section>

      <section
        id="como-funciona"
        aria-labelledby="como-funciona-titulo"
        className="mx-5 mt-8 scroll-mt-4 border-t border-border-subtle pt-6 pb-10 lg:mx-8 lg:mt-0 lg:pt-7 xl:mx-18"
      >
        <h2 id="como-funciona-titulo" className="sr-only">
          Como funciona
        </h2>
        <ol className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="font-mono text-caption leading-5 font-medium text-primary" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-[3px] lg:gap-1">
                <h3 className="text-[15px] font-semibold">{step.title}</h3>
                <p className="text-body-sm leading-[21px] text-text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function JoinRoomCard() {
  const navigate = useNavigate();
  const inputId = useId();
  const [code, setCode] = useState('');
  const canJoin = isValidRoomCode(code);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canJoin) navigate(`/room/${code}`);
  }

  return (
    <form
      onSubmit={handleJoin}
      className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-4 lg:gap-3 lg:rounded-lg lg:p-3.5"
    >
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-body-sm font-medium text-text-label lg:text-[13px]">
          <span className="lg:hidden">Entrar com código</span>
          <span className="hidden lg:inline">Recebeu um código?</span>
        </label>
        <span className="hidden font-mono text-[11px] leading-none text-text-muted lg:inline">cole o link ou digite</span>
      </div>

      <div className="flex flex-col gap-3.5 lg:gap-2.5 xl:flex-row xl:items-center">
        <RoomCodeInput id={inputId} value={code} onChange={setCode} />
        <button
          type="submit"
          disabled={!canJoin}
          className={cn(
            'flex h-[50px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-transparent bg-primary text-[15px] font-medium text-white',
            'lg:h-[42px] lg:gap-1.5 xl:flex-1 lg:rounded-md lg:text-body-sm',
            'transition-colors duration-120 hover:bg-primary-hover active:bg-primary-active',
            'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-elevated disabled:text-text-muted',
            focusRing,
          )}
        >
          <span className="lg:hidden">Entrar na sala</span>
          <span className="hidden lg:inline">Entrar</span>
          <ArrowRight size={16} className="lg:size-[15px]" aria-hidden />
        </button>
      </div>

      <p className="text-[12.5px] leading-[18px] text-text-muted lg:hidden">Também funciona abrindo o link recebido.</p>
    </form>
  );
}
