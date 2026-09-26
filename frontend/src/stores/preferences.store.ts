import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SHARE_PRESET, HIGHEST_LAYER, type SharePresetId, type SpatialLayer } from '../media/quality-presets';

interface PreferencesState {
  sharePreset: SharePresetId;
  /** Teto de qualidade de quem assiste: 2 é a resolução cheia da live, 0 a menor camada */
  viewLayer: SpatialLayer;
  setSharePreset: (preset: SharePresetId) => void;
  setViewLayer: (layer: SpatialLayer) => void;
}

/** Escolhas de qualidade lembradas entre visitas */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      sharePreset: DEFAULT_SHARE_PRESET,
      viewLayer: HIGHEST_LAYER,
      setSharePreset: (sharePreset) => set({ sharePreset }),
      setViewLayer: (viewLayer) => set({ viewLayer }),
    }),
    {
      name: 'screenify:preferences',
      version: 2,
      // A versão 1 guardava a qualidade de quem assiste como "auto/medium/low": volta ao padrão
      migrate: (persisted) => {
        const previous = persisted as Partial<PreferencesState> | undefined;
        return { sharePreset: previous?.sharePreset ?? DEFAULT_SHARE_PRESET, viewLayer: HIGHEST_LAYER };
      },
    },
  ),
);