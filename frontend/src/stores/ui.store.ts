import { create } from 'zustand';

interface UiState {
  createRoomOpen: boolean;
  openCreateRoom: () => void;
  closeCreateRoom: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  createRoomOpen: false,
  openCreateRoom: () => set({ createRoomOpen: true }),
  closeCreateRoom: () => set({ createRoomOpen: false }),
}));