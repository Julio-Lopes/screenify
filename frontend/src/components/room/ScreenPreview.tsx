import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { CaptureQuality } from '../../media/screen-share-manager';

interface ScreenPreviewProps {
  stream: MediaStream;
  quality: CaptureQuality | null;
  connecting: boolean;
}

/** O que você está transmitindo, exibido para você mesmo */
export function ScreenPreview({ stream, quality, connecting }: ScreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-caption backdrop-blur">
        {connecting ? (
          <>
            <LoaderCircle size={13} className="animate-spin text-text-secondary" aria-hidden />
            <span className="text-text-secondary">Conectando ao servidor…</span>
          </>
        ) : (
          <>
            <span className="text-text-secondary">Sua tela</span>
            {quality && (
              <span className="font-mono text-text-primary tabular-nums">
                {quality.width}×{quality.height} • {quality.frameRate} FPS
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}