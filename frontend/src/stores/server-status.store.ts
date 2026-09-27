import { create } from 'zustand';

export type ServerStatus = 'checking' | 'online' | 'offline';

interface ServerStatusState {
  status: ServerStatus;
  /** Tempo de ida e volta até a API em milissegundos; null enquanto não houver medida */
  ping: number | null;
  setOnline: (ping: number) => void;
  setOffline: () => void;
}

export const useServerStatusStore = create<ServerStatusState>()((set) => ({
  status: 'checking',
  ping: null,
  setOnline: (ping) => set({ status: 'online', ping }),
  setOffline: () => set({ status: 'offline', ping: null }),
}));
