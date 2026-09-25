import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // O CORS do backend libera exatamente esta porta; se ela estiver ocupada, falhar é melhor que trocar em silêncio
    strictPort: true,
  },
});