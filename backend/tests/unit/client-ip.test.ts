import { describe, expect, it } from 'vitest';
import { clientIp } from '../../src/utils/client-ip.js';

describe('clientIp', () => {
  it('sem proxy, usa o endereço da conexão e ignora o cabeçalho (que o visitante pode forjar)', () => {
    expect(clientIp('1.2.3.4', '203.0.113.5', 0)).toBe('203.0.113.5');
  });

  it('com um proxy confiável, usa o último IP que ele acrescentou', () => {
    expect(clientIp('198.51.100.7', '10.0.0.2', 1)).toBe('198.51.100.7');
  });

  it('não se deixa enganar por IPs falsos colocados antes pelo visitante', () => {
    // O visitante mandou "X-Forwarded-For: 1.2.3.4"; o proxy acrescentou o IP real no fim
    expect(clientIp('1.2.3.4, 198.51.100.7', '10.0.0.2', 1)).toBe('198.51.100.7');
  });

  it('normaliza IPv4 visto por socket IPv6', () => {
    expect(clientIp(undefined, '::ffff:203.0.113.5', 0)).toBe('203.0.113.5');
  });
});