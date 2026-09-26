import { LoaderCircle, Maximize, Minimize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { VIEW_QUALITIES, type ViewQuality } from '../../media/quality-presets';
import { QualityMenu } from '../ui/QualityMenu';

interface RemoteScreenProps {
  stream: MediaStream;
  sharerName: string;
  /** Presente quando a transmissão é simulcast e o espectador pode escolher a qualidade */
  quality: { selected: ViewQuality; onChange: (quality: ViewQuality) => void } | null;
}

const VIEW_OPTIONS = VIEW_QUALITIES.map(({ id, label, hint }) => ({ id, label, hint }));

/** A tela de quem está transmitindo, como chega para quem assiste */
export function RemoteScreen({ stream, sharerName, quality }: RemoteScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [firstFrame, setFirstFrame] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setFirstFrame(false);
    video.srcObject = stream;

    // O tamanho recebido muda quando quem transmite troca de janela ou a rede força outra qualidade
    const updateSize = () => {
      if (video.videoWidth > 0) setSize({ width: video.videoWidth, height: video.videoHeight });
    };
    const onPlaying = () => {
      setFirstFrame(true);
      updateSize();
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('resize', updateSize);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('resize', updateSize);
    };
  }, [stream]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  }

  const FullscreenIcon = fullscreen ? Minimize : Maximize;

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-full w-full object-contain"
        aria-label={`Tela de ${sharerName}`}
      />

      {!firstFrame && (
        <div role="status" className="absolute inset-0 flex items-center justify-center gap-2.5 text-body-sm text-text-secondary">
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          Conectando à transmissão…
        </div>
      )}

      <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-caption backdrop-blur">
          <span className="text-text-secondary">Tela de {sharerName}</span>
          {size && (
            <span className="font-mono text-text-primary tabular-nums" title="Resolução que está chegando até você">
              {size.width}×{size.height}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {quality && (
            <QualityMenu
              options={VIEW_OPTIONS}
              selected={quality.selected}
              onSelect={quality.onChange}
              triggerLabel={VIEW_QUALITIES.find((q) => q.id === quality.selected)?.label ?? 'Automática'}
              note="Na automática, a qualidade se ajusta sozinha à sua conexão."
            />
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            className="flex size-7 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface text-text-secondary transition-colors duration-120 hover:bg-surface-hover hover:text-text-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
          >
            <FullscreenIcon size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}