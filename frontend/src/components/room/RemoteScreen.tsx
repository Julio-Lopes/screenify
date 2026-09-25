import { LoaderCircle, Maximize, Minimize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RemoteScreenProps {
  stream: MediaStream;
  sharerName: string;
}

/** A tela de quem está transmitindo, como chega para quem assiste */
export function RemoteScreen({ stream, sharerName }: RemoteScreenProps) {
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
    <div ref={containerRef} className="group relative flex h-full w-full items-center justify-center bg-black">
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

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-caption backdrop-blur">
        <span className="text-text-secondary">Tela de {sharerName}</span>
        {size && (
          <span className="font-mono text-text-primary tabular-nums">
            {size.width}×{size.height}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        className="absolute right-3 bottom-3 flex size-8 cursor-pointer items-center justify-center rounded-md bg-background/80 text-text-secondary opacity-0 backdrop-blur transition-opacity duration-120 group-hover:opacity-100 hover:text-text-primary focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
      >
        <FullscreenIcon size={15} aria-hidden />
      </button>
    </div>
  );
}