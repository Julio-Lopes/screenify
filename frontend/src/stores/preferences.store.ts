import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SHARE_PRESET, type SharePresetId } from '../media/quality-presets';

interface PreferencesState {
  sharePreset: SharePresetId;
  /** Resolução escolhida por quem assiste (720 para 720p); null é "a maior da live" */
  viewMaxHeight: number | null;
  /** Mostrar os cursores das outras pessoas sobre a tela */
  showCursors: boolean;
  setSharePreset: (preset: SharePresetId) => void;
  setViewMaxHeight: (height: number | null) => void;
  toggleCursors: () => void;
}

/** Escolhas de qualidade lembradas entre visitas */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      sharePreset: DEFAULT_SHARE_PRESET,
      viewMaxHeight: null,
      showCursors: true,
      setSharePreset: (sharePreset) => set({ sharePreset }),
      setViewMaxHeight: (viewMaxHeight) => set({ viewMaxHeight }),
      toggleCursors: () => set((state) => ({ showCursors: !state.showCursors })),
    }),
    {
      name: 'screenify:preferences',
      version: 3,
      // Versões anteriores guardavam a escolha de quem assiste em outros formatos: volta ao padrão
      migrate: (persisted) => {
        const previous = persisted as Partial<PreferencesState> | undefined;
        return { sharePreset: previous?.sharePreset ?? DEFAULT_SHARE_PRESET, viewMaxHeight: null, showCursors: true };
      },
    },
  ),
);