import { describe, expect, it } from 'vitest';
import { formatBitrate, readStreamStats } from './stream-stats';

const pair = { type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.018 };

describe('readStreamStats (quem assiste)', () => {
  const inbound = (timestamp: number, bytes: number, received: number, lost: number, decoded: number) => ({
    type: 'inbound-rtp',
    kind: 'video',
    timestamp,
    frameWidth: 1920,
    frameHeight: 1080,
    bytesReceived: bytes,
    packetsReceived: received,
    packetsLost: lost,
    framesDecoded: decoded,
  });

  it('na primeira leitura só conhece resolução e RTT: taxas precisam de duas leituras', () => {
    const { metrics } = readStreamStats([inbound(1000, 0, 0, 0, 0), pair], 'inbound', null);
    expect(metrics).toEqual({ width: 1920, height: 1080, fps: null, bitrateKbps: null, rttMs: 18, packetLossPct: null, limitation: null, encoder: null, captureFps: null });
  });

  it('calcula bitrate, FPS e perda pela diferença entre leituras', () => {
    const first = readStreamStats([inbound(1000, 0, 0, 0, 0), pair], 'inbound', null);
    // Em 1 segundo: 500 KB (4 Mbps), 30 quadros, 990 pacotes recebidos e 10 perdidos
    const { metrics } = readStreamStats([inbound(2000, 500_000, 990, 10, 30), pair], 'inbound', first.sample);

    expect(metrics.bitrateKbps).toBe(4000);
    expect(metrics.fps).toBe(30);
    expect(metrics.packetLossPct).toBe(1);
  });
});

describe('readStreamStats (quem transmite)', () => {
  it('soma as camadas do simulcast e mostra a resolução da maior', () => {
    const layer = (width: number, height: number, bytes: number, timestamp: number) => ({
      type: 'outbound-rtp',
      kind: 'video',
      timestamp,
      frameWidth: width,
      frameHeight: height,
      framesPerSecond: 30,
      bytesSent: bytes,
      packetsSent: bytes / 1000,
    });
    const first = readStreamStats([layer(640, 360, 0, 1000), layer(1920, 1080, 0, 1000)], 'outbound', null);
    const { metrics } = readStreamStats(
      [
        layer(640, 360, 25_000, 2000),
        layer(1920, 1080, 500_000, 2000),
        { type: 'remote-inbound-rtp', kind: 'video', packetsLost: 0 },
      ],
      'outbound',
      first.sample,
    );

    expect(metrics.width).toBe(1920);
    expect(metrics.fps).toBe(30);
    expect(metrics.bitrateKbps).toBe(4200);
  });
});

describe('formatBitrate', () => {
  it('usa kbps abaixo de 1 Mbps', () => {
    expect(formatBitrate(850)).toBe('850 kbps');
    expect(formatBitrate(3240)).toBe('3.2 Mbps');
  });
});
describe('readStreamStats (quem transmite)', () => {
  const outbound = (extra: Record<string, unknown>) => ({
    type: 'outbound-rtp',
    kind: 'video',
    timestamp: 1000,
    frameWidth: 1920,
    frameHeight: 1080,
    bytesSent: 0,
    packetsSent: 0,
    framesEncoded: 0,
    ...extra,
  });

  it('mostra por que o navegador está limitando e onde está codificando', () => {
    const { metrics } = readStreamStats(
      [
        outbound({ qualityLimitationReason: 'cpu', encoderImplementation: 'libvpx' }),
        { type: 'media-source', kind: 'video', framesPerSecond: 60 },
      ],
      'outbound',
      null,
    );
    expect(metrics.limitation).toBe('cpu');
    expect(metrics.encoder).toBe('software');
    expect(metrics.captureFps).toBe(60);
  });

  it('prefere o powerEfficientEncoder ao nome da implementação', () => {
    const { metrics } = readStreamStats(
      [outbound({ powerEfficientEncoder: true, encoderImplementation: 'SimulcastEncoderAdapter' })],
      'outbound',
      null,
    );
    expect(metrics.encoder).toBe('hardware');
  });
});
