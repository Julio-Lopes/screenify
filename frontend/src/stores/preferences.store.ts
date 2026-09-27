import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SHARE_MODE, DEFAULT_SHARE_PRESET, type SharePresetId, type ShareMode } from '../media/quality-presets';

interface PreferencesState {
  sharePreset: SharePresetId;
  /** Texto (nitidez) ou jogo (fluidez) */
  shareMode: ShareMode;
  /** Resolução escolhida por quem assiste (720 para 720p); null é "a maior da live" */
  viewMaxHeight: number | null;
  /** Mostrar os cursores das outras pessoas sobre a tela */
  showCursors: boolean;
  setSharePreset: (preset: SharePresetId) => void;
  setShareMode: (mode: ShareMode) => void;
  setViewMaxHeight: (height: number | null) => void;
  toggleCursors: () => void;
}

/** Escolhas de qualidade lembradas entre visitas */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      sharePreset: DEFAULT_SHARE_PRESET,
      shareMode: DEFAULT_SHARE_MODE,
      viewMaxHeight: null,
      showCursors: true,
      setSharePreset: (sharePreset) => set({ sharePreset }),
      setShareMode: (shareMode) => set({ shareMode }),
      setViewMaxHeight: (viewMaxHeight) => set({ viewMaxHeight }),
      toggleCursors: () => set((state) => ({ showCursors: !state.showCursors })),
    }),
    {
      name: 'screenify:preferences',
      version: 4,
      // Versões anteriores guardavam a escolha de quem assiste em outros formatos: volta ao padrão
      migrate: (persisted) => {
        const previous = persisted as Partial<PreferencesState> | undefined;
        return {
          sharePreset: previous?.sharePreset ?? DEFAULT_SHARE_PRESET,
          shareMode: previous?.shareMode ?? DEFAULT_SHARE_MODE,
          viewMaxHeight: previous?.viewMaxHeight ?? null,
          showCursors: previous?.showCursors ?? true,
        };
      },
    },
  ),
);