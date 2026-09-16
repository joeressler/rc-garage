import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  apiGetMe,
  apiLogin,
  apiRegister,
  asSessionProfile,
  type SessionProfile,
  type UserProfile,
} from '../api/auth';
import { ApiError } from '../api/http';

export type { UserProfile, SessionProfile };

export interface AuthState {
  token: string | null;
  user: SessionProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setToken: (token: string | null) => void;
  setUser: (user: SessionProfile | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    callsign: string;
  }) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.messages.join(' ') || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unable to reach the garage API';
}

async function hydrateFleet(
  token: string,
  fallback: UserProfile,
): Promise<SessionProfile> {
  try {
    return await apiGetMe(token);
  } catch {
    return asSessionProfile(fallback);
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setUser: (user) => set({ user }),
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiLogin(credentials);
          const user = await hydrateFleet(res.token, res.user);
          set({
            token: res.token,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: unknown) {
          set({ error: errorMessage(err), isLoading: false });
          throw err;
        }
      },
      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiRegister(payload);
          const user = await hydrateFleet(res.token, res.user);
          set({
            token: res.token,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: unknown) {
          set({ error: errorMessage(err), isLoading: false });
          throw err;
        }
      },
      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null,
        }),
      checkSession: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const user = await apiGetMe(token);
          set({ user, isAuthenticated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'rc-garage-auth',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (!state?.token) {
          return;
        }
        state.isAuthenticated = true;
        void useAuthStore.getState().checkSession();
      },
    },
  ),
);
