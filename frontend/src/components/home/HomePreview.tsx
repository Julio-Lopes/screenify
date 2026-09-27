import { Circle, MousePointer2, MoveUpRight, Pencil, Type, Undo2 } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useServerStatusStore } from '../../stores/server-status.store';
import { cn } from '../../utils/cn';

// Posições por onde os cursores de exemplo passeiam, em % da área da tela
const MARIA_PATH = [
  ['24%', '74%'],
  ['38%', '62%'],
  ['30%', '82%'],
  ['46%', '70%'],
] as const;
const CARLOS_PATH = [
  ['64%', '28%'],
  ['58%', '44%'],
  ['70%', '36%'],
  ['60%', '22%'],
] as const;

const TICK_MS = 1700;
const FALLBACK_PING = 24;

function useDemoTick() {
  const [tick, setTick] = useState(0);
  const [bitrate, setBitrate] = useState(8.2);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setTick((t) => t + 1);
      setBitrate(Number((7.8 + Math.random() * 0.8).toFixed(1)));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return { tick, bitrate };
}

const drawStroke = 'animate-draw motion-reduce:animate-none';

/** Ilustração de uma sala em andamento: tela compartilhada, traços e cursores de outras pessoas */
export function HomePreview() {
  const { tick, bitrate } = useDemoTick();
  const ping = useServerStatusStore((s) => s.ping) ?? FALLBACK_PING;
  const maria = MARIA_PATH[tick % 4];
  const carlos = CARLOS_PATH[(tick + 1) % 4];

  return (
    <div
      role="img"
      aria-label="Prévia de uma sala: a tela compartilhada com um círculo e uma seta desenhados por cima e os cursores de Maria e Carlos"
      className="overflow-hidden rounded-[14px] border border-border bg-surface lg:shadow-lg"
    >
      {/* Barra do topo */}
      <div className="flex h-[38px] items-center gap-2 border-b border-border px-2.5 lg:h-11 lg:gap-2.5 lg:px-3">
        <span className="hidden text-[13px] font-medium lg:inline">Revisão do onboarding</span>
        <span className="h-5 rounded-[5px] border border-border bg-surface-elevated px-1.5 font-mono text-[10.5px] leading-[18px] font-medium text-text-label lg:h-[22px] lg:rounded-sm lg:px-[7px] lg:text-[11px] lg:leading-5">
          X7K2-9MPA
        </span>
        <span className="flex-1" />
        <div className="flex">
          <Avatar initials="JL" className="hidden bg-[#1E1E2E] text-[#A5B4FC] lg:flex" />
          <Avatar initials="MS" className="bg-[#132A22] text-[#34D399] lg:-ml-[7px]" />
          <Avatar initials="CL" className="-ml-2 bg-[#2A2412] text-[#FBBF24] lg:-ml-[7px]" />
        </div>
      </div>

      {/* Tela compartilhada */}
      <div className="relative aspect-[16/10] overflow-hidden bg-black">
        <DesktopScreen />
        <MobileScreen />

        <svg
          viewBox="0 0 160 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 hidden size-full lg:block"
        >
          <ellipse cx="54" cy="74" rx="16" ry="7" stroke="#EF4444" strokeWidth="3" {...strokeProps} className={drawStroke} />
          <path d="M112 30 L88 50" stroke="#EAB308" strokeWidth="3" {...strokeProps} className={drawStroke} style={delay(1.2)} />
          <path d="M91 43 L88 50 L95 49" stroke="#EAB308" strokeWidth="3" strokeLinejoin="round" {...strokeProps} className={drawStroke} style={delay(1.6)} />
        </svg>
        <svg
          viewBox="0 0 160 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full lg:hidden"
        >
          <ellipse cx="36" cy="78" rx="22" ry="10" stroke="#EF4444" strokeWidth="2.5" {...strokeProps} className={drawStroke} />
          <path d="M120 22 L96 42" stroke="#EAB308" strokeWidth="2.5" {...strokeProps} className={drawStroke} style={delay(1.2)} />
        </svg>

        <DemoCursor name="Maria" x={maria[0]} y={maria[1]} className="text-[#34D399]" label="bg-[#34D399] text-[#052E16]" duration="duration-[1400ms]" />
        <DemoCursor name="Carlos" x={carlos[0]} y={carlos[1]} className="hidden text-[#FBBF24] lg:flex" label="bg-[#FBBF24] text-[#422006]" duration="duration-[1600ms]" />

        <div className="absolute top-2 left-2 flex gap-1.5 lg:top-2.5 lg:left-2.5">
          <span className="hidden h-[22px] items-center gap-1.5 rounded-sm bg-danger-solid px-2 text-[11px] font-semibold tracking-[0.06em] text-white lg:inline-flex">
            <span className="size-1.5 rounded-full bg-white" />
            LIVE
          </span>
          <span className="inline-flex h-[18px] items-center rounded-[5px] bg-background/80 px-1.5 font-mono text-[10px] font-medium lg:h-[22px] lg:rounded-sm lg:px-2 lg:text-[11px]">
            1080p · 60 FPS
          </span>
        </div>

        <DemoToolbar />
      </div>

      {/* Barra de métricas */}
      <div className="flex h-[30px] items-center gap-3.5 border-t border-border px-2.5 font-mono text-[10.5px] leading-none font-medium text-text-secondary lg:h-[34px] lg:gap-[18px] lg:px-3 lg:text-[11.5px] [&>span]:whitespace-nowrap">
        <span className="hidden text-text-primary lg:inline">1920 × 1080</span>
        <span>{bitrate.toFixed(1)} Mbps</span>
        <span className="text-success-text">RTT {ping} ms</span>
        <span className="hidden xl:inline">perda 0.1%</span>
        <span className="flex-1" />
        <span className="flex items-center gap-1 font-sans whitespace-nowrap lg:gap-1.5">
          <Pencil size={12} className="text-[#34D399]" />
          <span>
            Maria <span className="hidden lg:inline">está </span>desenhando
          </span>
        </span>
      </div>
    </div>
  );
}

const strokeProps = {
  fill: 'none',
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
  pathLength: 100,
  strokeDasharray: 100,
} as const;

function delay(seconds: number): CSSProperties {
  return { animationDelay: `${seconds}s`, animationFillMode: 'backwards' };
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-[22px] items-center justify-center rounded-full border-2 border-surface text-[8px] font-semibold lg:size-6 lg:text-[9px]',
        className,
      )}
    >
      {initials}
    </span>
  );
}

interface DemoCursorProps {
  name: string;
  x: string;
  y: string;
  className: string;
  label: string;
  duration: string;
}

function DemoCursor({ name, x, y, className, label, duration }: DemoCursorProps) {
  return (
    <div
      style={{ left: x, top: y }}
      className={cn(
        'pointer-events-none absolute flex items-start transition-[left,top] ease-[cubic-bezier(.4,0,.2,1)]',
        duration,
        className,
      )}
    >
      <MousePointer2 strokeWidth={2} className="size-4 lg:size-5" />
      <span
        className={cn(
          'mt-3 -ml-0.5 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap lg:mt-4 lg:rounded-sm lg:px-[7px] lg:py-[3px] lg:text-[11px]',
          label,
        )}
      >
        {name}
      </span>
    </div>
  );
}

function DemoToolbar() {
  const tools = [MousePointer2, Pencil, MoveUpRight, Circle, Type];

  return (
    <div className="absolute top-2.5 right-3 hidden gap-0.5 rounded-[10px] border border-border bg-surface-elevated p-1 shadow-md lg:flex">
      {tools.map((Icon, index) => (
        <span
          key={index}
          className={cn(
            'flex size-[30px] items-center justify-center rounded-[7px]',
            index === 1 ? 'bg-primary-soft text-[#E0E7FF]' : 'text-text-secondary',
          )}
        >
          <Icon size={15} />
        </span>
      ))}
      <span className="mx-[3px] my-1.5 h-[18px] w-px bg-border" />
      <span className="flex size-[30px] items-center justify-center rounded-[7px] text-text-secondary">
        <Undo2 size={15} />
      </span>
    </div>
  );
}

/** Uma página clara genérica, com janela de navegador e barra lateral */
function DesktopScreen() {
  return (
    <div className="absolute inset-y-[5%] inset-x-[6%] hidden flex-col overflow-hidden rounded-sm bg-[#F4F4F5] lg:flex">
      <div className="flex h-[26px] items-center gap-[5px] bg-[#E4E4E7] px-2.5">
        <span className="size-[7px] rounded-full bg-[#D4D4D8]" />
        <span className="size-[7px] rounded-full bg-[#D4D4D8]" />
        <span className="size-[7px] rounded-full bg-[#D4D4D8]" />
        <span className="ml-3.5 h-3 w-2/5 rounded-[4px] bg-[#F4F4F5]" />
      </div>
      <div className="grid flex-1 grid-cols-[22%_1fr] gap-5 p-[22px]">
        <div className="flex flex-col gap-2.5">
          <div className="h-[9px] rounded-[3px] bg-[#D4D4D8]" />
          <div className="h-[9px] w-4/5 rounded-[3px] bg-[#D4D4D8]" />
          <div className="h-[9px] w-[90%] rounded-[3px] bg-[#E4E4E7]" />
          <div className="h-[9px] w-3/5 rounded-[3px] bg-[#E4E4E7]" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-[18px] w-[46%] rounded-[4px] bg-[#3F3F46]" />
          <div className="h-[9px] w-[78%] rounded-[3px] bg-[#A1A1AA]" />
          <div className="h-[9px] w-[58%] rounded-[3px] bg-[#A1A1AA]" />
          <div className="mt-2 grid min-h-0 flex-1 grid-cols-3 gap-3">
            <div className="rounded-md bg-[#E0E7FF]" />
            <div className="rounded-md bg-[#E4E4E7]" />
            <div className="rounded-md bg-[#E4E4E7]" />
          </div>
          <div className="h-[30px] w-[30%] shrink-0 rounded-sm bg-primary" />
          <div className="flex-[1.3]" />
        </div>
      </div>
    </div>
  );
}

function MobileScreen() {
  return (
    <div className="absolute inset-[6%] flex flex-col gap-[7px] rounded-[4px] bg-[#F4F4F5] p-[5%] lg:hidden">
      <div className="h-2.5 w-[46%] rounded-[3px] bg-[#3F3F46]" />
      <div className="h-1.5 w-[78%] rounded-[3px] bg-[#A1A1AA]" />
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        <div className="rounded-[4px] bg-[#E0E7FF]" />
        <div className="rounded-[4px] bg-[#E4E4E7]" />
        <div className="rounded-[4px] bg-[#E4E4E7]" />
      </div>
      <div className="mb-[6%] h-4 w-[32%] rounded-[4px] bg-primary" />
    </div>
  );
}
