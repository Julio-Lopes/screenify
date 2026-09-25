const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error('VITE_API_URL não definida. Crie o arquivo frontend/.env a partir do .env.example.');
}

export const env = {
  apiUrl: apiUrl.replace(/\/+$/, ''),
} as const;