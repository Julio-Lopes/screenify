/** O que a status bar mostra, como o prompt pede: resolução, FPS, bitrate, RTT e perda de pacotes */
export interface StreamMetrics {
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrateKbps: number | null;
  rttMs: number | null;
  packetLossPct: number | null;
  /**
   * Só para quem transmite: por que o navegador está entregando menos que o pedido.
   * 'cpu' = o processador não dá conta de codificar; 'bandwidth' = a rede não comporta;
   * 'none' = nada limitando. Vem do outbound-rtp da maior camada.
   */
  limitation: 'cpu' | 'bandwidth' | 'none' | 'other' | null;
  /** Só para quem transmite: se o codificador em uso roda na GPU (hardware) ou na CPU (software) */
  encoder: 'hardware' | 'software' | null;
  /** Só para quem transmite: FPS que a captura está entregando, antes do codificador */
  captureFps: number | null;
}

/** Contadores acumulados de uma leitura; a próxima leitura calcula as taxas pela diferença */
export interface StatsSample {
  timestamp: number;
  bytes: number;
  packets: number;
  packetsLost: number;
  frames: number;
}

type RawStats = Record<string, unknown>;

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const sum = (entries: RawStats[], key: string) => entries.reduce((total, entry) => total + (num(entry[key]) ?? 0), 0);

/** RTT até o servidor: o par de candidatos ICE que está de fato em uso */
function readRtt(entries: RawStats[]): number | null {
  const pair = entries.find(
    (e) => e.type === 'candidate-pair' && e.state === 'succeeded' && e.nominated === true && num(e.currentRoundTripTime) !== null,
  );
  const seconds = num(pair?.currentRoundTripTime);
  return seconds === null ? null : Math.round(seconds * 1000);
}

function rate(current: number, previous: number, elapsedMs: number): number {
  return elapsedMs > 0 ? Math.max(0, current - previous) / (elapsedMs / 1000) : 0;
}

/**
 * Lê o relatório do getStats() do WebRTC. Os contadores (bytes, pacotes, quadros) só crescem,
 * então bitrate, FPS e perda saem da diferença entre esta leitura e a anterior.
 *
 * Quem transmite olha o "outbound-rtp" (um por camada do simulcast) e o que o servidor
 * relata de volta ("remote-inbound-rtp"); quem assiste olha o "inbound-rtp".
 */
export function readStreamStats(
  report: Iterable<RawStats>,
  direction: 'outbound' | 'inbound',
  previous: StatsSample | null,
): { metrics: StreamMetrics; sample: StatsSample } {
  const entries = [...report];
  const rtpType = direction === 'outbound' ? 'outbound-rtp' : 'inbound-rtp';
  const rtps = entries.filter((e) => e.type === rtpType && e.kind === 'video');

  // No simulcast, a resolução exibida é a da maior camada que está saindo
  const top = rtps.reduce<RawStats | null>(
    (best, e) => ((num(e.frameWidth) ?? 0) > (num(best?.frameWidth) ?? 0) ? e : best),
    null,
  );

  const timestamp = num(rtps[0]?.timestamp) ?? Date.now();
  const sample: StatsSample =
    direction === 'outbound'
      ? {
          timestamp,
          bytes: sum(rtps, 'bytesSent'),
          packets: sum(rtps, 'packetsSent'),
          packetsLost: sum(entries.filter((e) => e.type === 'remote-inbound-rtp' && e.kind === 'video'), 'packetsLost'),
          frames: num(top?.framesEncoded) ?? 0,
        }
      : {
          timestamp,
          bytes: sum(rtps, 'bytesReceived'),
          packets: sum(rtps, 'packetsReceived'),
          packetsLost: sum(rtps, 'packetsLost'),
          frames: sum(rtps, 'framesDecoded'),
        };

  const elapsed = previous ? sample.timestamp - previous.timestamp : 0;
  const lost = previous ? Math.max(0, sample.packetsLost - previous.packetsLost) : 0;
  const delivered = previous ? Math.max(0, sample.packets - previous.packets) : 0;

  const metrics: StreamMetrics = {
    width: num(top?.frameWidth),
    height: num(top?.frameHeight),
    fps: num(top?.framesPerSecond) ?? (previous ? Math.round(rate(sample.frames, previous.frames, elapsed)) : null),
    bitrateKbps: previous ? Math.round((rate(sample.bytes, previous.bytes, elapsed) * 8) / 1000) : null,
    rttMs: readRtt(entries),
    packetLossPct: previous && lost + delivered > 0 ? Math.round((lost / (lost + delivered)) * 1000) / 10 : previous ? 0 : null,
    limitation: direction === 'outbound' ? readLimitation(top) : null,
    encoder: direction === 'outbound' ? readEncoder(top) : null,
    captureFps:
      direction === 'outbound'
        ? num(entries.find((e) => e.type === 'media-source' && e.kind === 'video')?.framesPerSecond)
        : null,
  };

  return { metrics, sample };
}

function readLimitation(rtp: RawStats | null): StreamMetrics['limitation'] {
  const reason = rtp?.qualityLimitationReason;
  if (typeof reason !== 'string') return null;
  return reason === 'cpu' || reason === 'bandwidth' || reason === 'none' ? reason : 'other';
}

/**
 * powerEfficientEncoder é o sinal oficial (Chrome só expõe com permissão de captura, que quem
 * transmite tem). Sem ele, o nome da implementação: libvpx, libaom e OpenH264 são software.
 */
function readEncoder(rtp: RawStats | null): StreamMetrics['encoder'] {
  if (typeof rtp?.powerEfficientEncoder === 'boolean') {
    return rtp.powerEfficientEncoder ? 'hardware' : 'software';
  }
  const name = rtp?.encoderImplementation;
  if (typeof name !== 'string' || name === '' || name === 'unknown') return null;
  return /libvpx|libaom|openh264|dav1d/i.test(name) ? 'software' : 'hardware';
}

export function formatBitrate(kbps: number): string {
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;
}

/**
 * Acima destes valores, o número aparece como aviso. A perda de 2% é a do design system.
 * O RTT do design system (35 ms) é de rede local; pela internet até a VPS, até 100 ms
 * ainda dá uma experiência fluida para compartilhar tela, e acima disso o atraso começa a ser notado.
 */
export const METRIC_LIMITS = { rttMs: 100, packetLossPct: 2 } as const;