import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AnnotationLayer } from '../../annotation/AnnotationLayer';
import type { Annotations } from '../../annotation/useAnnotations';
import { CursorLayer, type CursorContext } from '../../cursor/CursorLayer';
import { CursorToggle } from '../../cursor/CursorToggle';
import {
  formatMbps,
  getSharePreset,
  presetBitrate,
  presetLabel,
  SHARE_MODES,
  SHARE_PRESETS,
  type SharePresetId,
  type ShareMode,
} from '../../media/quality-presets';
import type { CaptureQuality } from '../../media/screen-share-manager';
import { QualityMenu } from '../ui/QualityMenu';

interface ScreenPreviewProps {
  stream: MediaStream;
  quality: CaptureQuality | null;
  connecting: boolean;
  preset: SharePresetId;
  onPresetChange: (preset: SharePresetId) => void;
  mode: ShareMode;
  onModeChange: (mode: ShareMode) => void;
  annotations: Annotations;
  cursors: CursorContext;
}

/** O bitrate estimado depende do modo: jogo usa bem mais */
function presetOptions(mode: ShareMode) {
  return SHARE_PRESETS.map((preset) => ({
    id: preset.id,
    label: presetLabel(preset),
    hint: formatMbps(presetBitrate(preset, mode)),
  }));
}

const MODE_OPTIONS = SHARE_MODES.map(({ id, label, hint }) => ({ id, label, hint }));

/** O que você está transmitindo, exibido para você mesmo */
export function ScreenPreview({
  stream,
  quality,
  connecting,
  preset,
  onPresetChange,
  mode,
  onModeChange,
  annotations,
  cursors,
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
      <CursorLayer videoRef={videoRef} cursors={cursors} />

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
                <span className="font-mono text-text-primary tabular-nums" title="Resolução que o navegador está capturando">
                  {quality.width}×{quality.height}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CursorToggle visible={cursors.visible} onToggle={cursors.toggle} />
          <QualityMenu
            options={MODE_OPTIONS}
            selected={mode}
            onSelect={onModeChange}
            triggerLabel={mode === 'game' ? 'Jogo' : 'Texto'}
            note="O codec (GPU ou CPU) é escolhido ao começar a compartilhar; o resto muda na hora."
          />
          <QualityMenu
            options={presetOptions(mode)}
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