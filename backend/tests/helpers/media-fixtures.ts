import type { DtlsParameters, RtpParameters } from '@screenify/shared';

/*
 * Parâmetros no formato que um navegador envia ao transmitir VP8.
 * Servem para testar a sinalização: o mediasoup cria Producers e Consumers com eles
 * mesmo sem pacotes de vídeo chegando. O vídeo de verdade é testado no navegador.
 */
export const VP8_RTP_PARAMETERS: RtpParameters = {
  mid: '0',
  codecs: [
    {
      mimeType: 'video/VP8',
      payloadType: 96,
      clockRate: 90000,
      parameters: {},
      rtcpFeedback: [{ type: 'nack' }, { type: 'nack', parameter: 'pli' }, { type: 'ccm', parameter: 'fir' }],
    },
    { mimeType: 'video/rtx', payloadType: 97, clockRate: 90000, parameters: { apt: 96 } },
  ],
  headerExtensions: [],
  encodings: [{ ssrc: 11111111, rtx: { ssrc: 22222222 } }],
  rtcp: { cname: 'screenify-test' },
};

export const FAKE_DTLS_PARAMETERS: DtlsParameters = {
  role: 'client',
  fingerprints: [
    {
      algorithm: 'sha-256',
      value: 'AF:4C:6B:2A:83:9E:10:5D:77:C1:3E:90:4B:2F:6A:D8:1E:55:C0:39:8B:7F:21:A4:6D:E3:0C:92:5B:14:F8:66',
    },
  ],
};

export const VP8_SIMULCAST_RTP_PARAMETERS: RtpParameters = {
  ...VP8_RTP_PARAMETERS,
  headerExtensions: [
    { uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 },
    { uri: 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id', id: 2 },
    { uri: 'urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id', id: 3 },
  ],
  encodings: [
    { rid: 'r0', scalabilityMode: 'L1T3' },
    { rid: 'r1', scalabilityMode: 'L1T3' },
    { rid: 'r2', scalabilityMode: 'L1T3' },
  ],
};