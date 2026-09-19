import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  apiChangeEmail,
  apiChangePassword,
  apiDeleteAccount,
  apiGetMe,
  apiLogin,
  apiRegister,
  apiUpdateProfile,
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
    ageAttested: true;
    acceptedLegal: true;
    recaptchaToken: string;
  }) => Promise<void>;
  changePassword: (payload: {
    currentPassword: string;
    nextPassword: string;
  }) => Promise<void>;
  changeEmail: (payload: { password: string; nextEmail: string }) => Promise<void>;
  updateProfile: (payload: {
    bio?: string | null;
    avatarUrl?: string | null;
  }) => Promise<void>;
  deleteAccount: (payload: {
    password: string;
    confirmation: 'DELETE';
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
      changePassword: async (payload) => {
        const token = get().token;
        if (!token) {
          throw new Error('Unable to reach the garage API');
        }
        set({ isLoading: true, error: null });
        try {
          await apiChangePassword(token, payload);
          set({ isLoading: false });
        } catch (err: unknown) {
          set({ error: errorMessage(err), isLoading: false });
          throw err;
        }
      },
      changeEmail: async (payload) => {
        const token = get().token;
        const current = get().user;
        if (!token) {
          throw new Error('Unable to reach the garage API');
        }
        set({ isLoading: true, error: null });
        try {
          const profile = await apiChangeEmail(token, payload);
          set({
            user: current
              ? { ...current, ...profile }
              : asSessionProfile(profile),
            isLoading: false,
          });
        } catch (err: unknown) {
          set({ error: errorMessage(err), isLoading: false });
          throw err;
        }
      },
      updateProfile: async (payload) => {
        const token = get().token;
        const current = get().user;
        if (!token) {
          throw new Error('Unable to reach the garage API');
        }
        set({ isLoading: true, error: null });
        try {
          const profile = await apiUpdateProfile(token, payload);
          set({
            user: current
              ? { ...current, ...profile, avatarUrl: profile.avatarUrl, bio: profile.bio }
              : asSessionProfile(profile),
            isLoading: false,
          });
        } catch (err: unknown) {
          set({ error: errorMessage(err), isLoading: false });
          throw err;
        }
      },
      deleteAccount: async (payload) => {
        const token = get().token;
        if (!token) {
          throw new Error('Unable to reach the garage API');
        }
        set({ isLoading: true, error: null });
        try {
          await apiDeleteAccount(token, payload);
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
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
      // JWT lives in localStorage so XSS can steal it for JWT_EXPIRATION (default 7d); httpOnly cookies are deferred.
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
