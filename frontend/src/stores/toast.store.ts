import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

const MAX_TOASTS = 4;
const TOAST_DURATION_MS = 3200;

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_TOASTS) }));
    window.setTimeout(() => get().dismiss(id), TOAST_DURATION_MS);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Atalho para disparar toasts fora de componentes React */
export const toast = (kind: ToastKind, title: string, description?: string): void =>
  useToastStore.getState().show({ kind, title, description });