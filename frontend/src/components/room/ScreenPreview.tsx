import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AnnotateToggle } from '../../annotation/AnnotateToggle';
import { AnnotationLayer } from '../../annotation/AnnotationLayer';
import type { Annotations } from '../../annotation/useAnnotations';
import {
  formatMbps,
  getSharePreset,
  presetLabel,
  SHARE_PRESETS,
  type SharePresetId,
} from '../../media/quality-presets';
import type { CaptureQuality } from '../../media/screen-share-manager';
import { QualityMenu } from '../ui/QualityMenu';

interface ScreenPreviewProps {
  stream: MediaStream;
  quality: CaptureQuality | null;
  connecting: boolean;
  preset: SharePresetId;
  onPresetChange: (preset: SharePresetId) => void;
  annotations: Annotations;
}

const PRESET_OPTIONS = SHARE_PRESETS.map((preset) => ({
  id: preset.id,
  label: presetLabel(preset),
  hint: formatMbps(preset.bitrate),
}));

/** O que você está transmitindo, exibido para você mesmo */
export function ScreenPreview({
  stream,
  quality,
  connecting,
  preset,
  onPresetChange,
  annotations,
}: ScreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
      <AnnotationLayer videoRef={videoRef} annotations={annotations} />

      <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-caption backdrop-blur">
          {connecting ? (
            <>
              <LoaderCircle size={13} className="animate-spin text-text-secondary" aria-hidden />
              <span className="text-text-secondary">Conectando ao servidor…</span>
            </>
          ) : (
            <>
              <span className="text-text-secondary">Sua tela</span>
              {quality && (
                <span className="font-mono text-text-primary tabular-nums" title="Qualidade que o navegador está entregando">
                  {quality.width}×{quality.height} • {quality.frameRate} FPS
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <AnnotateToggle enabled={annotations.enabled} onToggle={annotations.toggle} />
          <QualityMenu
            options={PRESET_OPTIONS}
            selected={preset}
            onSelect={onPresetChange}
            triggerLabel={presetLabel(getSharePreset(preset))}
            note="Reduza a qualidade se a conexão ficar instável."
          />
        </div>
      </div>
    </div>
  );
}