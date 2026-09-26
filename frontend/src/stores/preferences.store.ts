import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SHARE_PRESET, type SharePresetId, type ViewQuality } from '../media/quality-presets';

interface PreferencesState {
  sharePreset: SharePresetId;
  viewQuality: ViewQuality;
  setSharePreset: (preset: SharePresetId) => void;
  setViewQuality: (quality: ViewQuality) => void;
}

/** Escolhas de qualidade lembradas entre visitas */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      sharePreset: DEFAULT_SHARE_PRESET,
      viewQuality: 'auto',
      setSharePreset: (sharePreset) => set({ sharePreset }),
      setViewQuality: (viewQuality) => set({ viewQuality }),
    }),
    { name: 'screenify:preferences', version: 1 },
  ),
);