import type { GuestSessionResponse, PublicUser } from '@screenify/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  token: string | null;
  user: PublicUser | null;
  setSession: (session: GuestSessionResponse) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    { name: 'screenify:session', version: 1 },
  ),
);