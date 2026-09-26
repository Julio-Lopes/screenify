/**
 * IP de quem está do outro lado da conexão. Atrás de um proxy (o Traefik do Coolify), o IP
 * da conexão é o do proxy, e o do visitante vem no cabeçalho X-Forwarded-For.
 *
 * Só se confia no cabeçalho quando há proxies configurados, e só nas posições que eles
 * escrevem: cada proxy acrescenta um IP no fim da lista, então com N proxies confiáveis
 * o IP real é o N-ésimo a partir do fim. O que vier antes disso foi escrito pelo próprio
 * visitante e pode ser falsificado. É a mesma regra do "trust proxy" do Express.
 */
export function clientIp(forwardedFor: string | string[] | undefined, remoteAddress: string, trustedProxies: number): string {
  if (trustedProxies === 0 || !forwardedFor) return normalize(remoteAddress);

  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const chain = header
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  const candidate = chain[chain.length - trustedProxies];
  return normalize(candidate ?? chain[0] ?? remoteAddress);
}

/** "::ffff:203.0.113.5" é o mesmo IPv4 "203.0.113.5" visto por um socket IPv6 */
function normalize(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}