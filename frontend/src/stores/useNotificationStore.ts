import { create } from 'zustand';
import { ApiError } from '../api/http';
import {
  apiGetUnreadCount,
  apiListNotifications,
  apiMarkNotificationsRead,
  type NotificationItem,
} from '../api/notifications';
import { useAuthStore } from './useAuthStore';

const POLL_INTERVAL_MS = 60_000;

export interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchUnreadCount: () => Promise<void>;
  fetchList: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  reset: () => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.messages.join(' ') || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unable to load pit signals';
}

function getToken(): string | null {
  return useAuthStore.getState().token;
}

const idleNotifications = {
  items: [] as NotificationItem[],
  unreadCount: 0,
  isLoading: false,
  error: null as string | null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Purpose: poll REST unread counts for the Pit-Mat bell without opening a WebSocket.
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  ...idleNotifications,

  fetchUnreadCount: async () => {
    const token = getToken();
    if (!token) {
      return;
    }
    try {
      const res = await apiGetUnreadCount(token);
      set({ unreadCount: res.unreadCount, error: null });
    } catch (err: unknown) {
      set({ error: errorMessage(err) });
    }
  },

  fetchList: async () => {
    const token = getToken();
    if (!token) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const res = await apiListNotifications({}, token);
      set({
        items: res.items,
        unreadCount: res.unreadCount,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  markRead: async (ids) => {
    const token = getToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    const res = await apiMarkNotificationsRead(
      ids === undefined ? {} : { ids },
      token,
    );
    const stamped = new Date().toISOString();
    set((state) => ({
      unreadCount: res.unreadCount,
      items: state.items.map((item) => {
        if (ids === undefined || ids.includes(item.id)) {
          return { ...item, readAt: item.readAt ?? stamped };
        }
        return item;
      }),
    }));
  },

  startPolling: () => {
    get().stopPolling();
    void get().fetchUnreadCount();
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void get().fetchUnreadCount();
    }, POLL_INTERVAL_MS);
  },

  stopPolling: () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },

  reset: () => {
    get().stopPolling();
    set({ ...idleNotifications });
  },
}));
