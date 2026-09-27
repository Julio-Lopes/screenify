/**
 * Variáveis de ambiente do frontend. O Vite as embute no código no momento do build,
 * então um valor errado só aparece quando alguém abre o site: por isso a validação aqui
 * trava tudo com uma mensagem clara em vez de deixar a aplicação falhar de um jeito confuso.
 */
function readUrl(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} não definida. Crie o arquivo frontend/.env a partir do .env.example.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} não é uma URL válida: ${value}`);
  }

  // Um site em HTTPS não pode chamar uma API em HTTP: o navegador bloqueia (conteúdo misto)
  if (import.meta.env.PROD && url.protocol !== 'https:') {
    throw new Error(`${name} precisa usar https em produção: ${value}`);
  }

  return value.replace(/\/+$/, '');
}

const apiUrl = readUrl('VITE_API_URL', import.meta.env.VITE_API_URL);

export const env = {
  apiUrl,
  /** Servidor do Socket.IO. No Screenify é o mesmo da API; fica separado para poder mudar sem mexer no código */
  wsUrl: import.meta.env.VITE_WS_URL ? readUrl('VITE_WS_URL', import.meta.env.VITE_WS_URL) : apiUrl,
} as const;