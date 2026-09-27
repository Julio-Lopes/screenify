import type { types } from 'mediasoup';

/**
 * Codecs que o Router aceita. O navegador escolhe um deles ao transmitir.
 * VP8 é o mais compatível e suporta simulcast; VP9 e H264 ficam disponíveis
 * para a Fase 10 (qualidade), e o Opus já fica pronto para áudio no futuro.
 */
export const MEDIA_CODECS: types.RouterRtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: { 'profile-id': 0, 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

/** Teto de bitrate que o servidor aceita de quem transmite (bits por segundo). O modo jogo em 1080p60 usa ~14 Mbps */
export const MAX_INCOMING_BITRATE = 20_000_000;

/** Bitrate inicial ao enviar para um espectador, antes de o controle de congestionamento medir a rede */
export const INITIAL_OUTGOING_BITRATE = 3_000_000;