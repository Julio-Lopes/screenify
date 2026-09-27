import type { types } from 'mediasoup-client';
import { presetBitrate, type SharePreset, type ShareMode } from './quality-presets';

export interface CodecChoice {
  /** Codec para passar ao transport.produce(); undefined deixa o mediasoup-client usar o padrão (VP8) */
  codec: types.RtpCodecCapability | undefined;
  /** O navegador diz que vai codificar com eficiência de energia, o que na prática quer dizer GPU */
  hardware: boolean;
}

/**
 * Escolhe o codec da transmissão.
 *
 * No modo jogo, o gargalo costuma ser a CPU: o VP8 é codificado em software (libvpx) e disputa
 * o processador com o jogo. Se o navegador informar que tem H264 por hardware (NVENC, QuickSync,
 * AMF, VideoToolbox), a codificação vai para um circuito dedicado da GPU e sai do caminho do jogo.
 *
 * Sem H264 por hardware, fica no VP8: o H264 em software (OpenH264) não ganharia nada.
 * No modo texto, também fica no VP8, que é o que o projeto sempre usou.
 */
export async function chooseCodec(
  device: { rtpCapabilities: types.RtpCapabilities },
  preset: SharePreset,
  mode: ShareMode,
): Promise<CodecChoice> {
  const fallback: CodecChoice = { codec: undefined, hardware: false };
  if (mode !== 'game') return fallback;

  const h264 = device.rtpCapabilities.codecs?.find(
    (codec) => codec.kind === 'video' && codec.mimeType.toLowerCase() === 'video/h264',
  );
  if (!h264) return fallback;

  const hardware = await isPowerEfficient('video/H264', preset, mode);
  return hardware ? { codec: h264, hardware: true } : fallback;
}

async function isPowerEfficient(contentType: string, preset: SharePreset, mode: ShareMode): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaCapabilities?.encodingInfo) return false;
  try {
    const info = await navigator.mediaCapabilities.encodingInfo({
      type: 'webrtc',
      video: {
        contentType,
        width: preset.width,
        height: preset.height,
        bitrate: presetBitrate(preset, mode),
        framerate: preset.frameRate,
      },
    });
    return info.supported && info.powerEfficient;
  } catch {
    // Navegadores sem suporte a type 'webrtc' lançam erro: tratamos como "sem hardware"
    return false;
  }
}
