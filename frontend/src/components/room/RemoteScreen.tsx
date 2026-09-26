import { LoaderCircle, Maximize, Minimize, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LayerOption, SpatialLayer } from '../../media/quality-presets';
import { QualityMenu } from '../ui/QualityMenu';

interface RemoteScreenProps {
  stream: MediaStream;
  sharerName: string;
  /** Resoluções da live, da maior para a menor; vazio quando não há o que escolher */
  layers: LayerOption[];
  selectedLayer: SpatialLayer;
  /** Altura que a resolução escolhida tem de verdade; chegando bem menos, a conexão está limitando */
  expectedHeight: number | null;
  onLayerChange: (layer: SpatialLayer) => void;
}

/** A tela de quem está transmitindo, como chega para quem assiste */
export function RemoteScreen({
  stream,
  sharerName,
  layers,
  selectedLayer,
  expectedHeight,
  onLayerChange,
}: RemoteScreenProps) {
  // O menu trabalha com ids em texto; a camada é um número
  const options = layers.map((option) => ({ id: String(option.layer), label: option.label }));
  const selectedLabel = layers.find((option) => option.layer === selectedLayer)?.label;

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
          {size &&
            (expectedHeight !== null && size.height < expectedHeight * 0.9 ? (
              <span
                className="flex items-center gap-1.5 font-mono text-warning-text tabular-nums"
                title="Abaixo da resolução escolhida: sua conexão não está dando conta agora. Volta sozinha quando melhorar."
              >
                <TriangleAlert size={12} aria-hidden />
                {size.width}×{size.height}
              </span>
            ) : (
              <span className="font-mono text-text-primary tabular-nums" title="Resolução que está chegando até você">
                {size.width}×{size.height}
              </span>
            ))}
        </div>

        <div className="flex items-center gap-2">
          {options.length > 1 && selectedLabel && (
            <QualityMenu
              options={options}
              selected={String(selectedLayer)}
              onSelect={(id) => {
                const option = layers.find((layer) => String(layer.layer) === id);
                if (option) onLayerChange(option.layer);
              }}
              triggerLabel={selectedLabel}
              note="A resolução escolhida é mantida. Só baixa se a sua conexão não aguentar, para o vídeo não travar."
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