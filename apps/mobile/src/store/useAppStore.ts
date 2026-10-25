import { create } from 'zustand';
import { User, Store } from '@hardware-store/shared';

export interface AppState {
  user: User | null;
  store: Store | null;
  token: string | null;
  deviceId: string;
  apiUrl: string;
  isOnline: boolean;
  isLocked: boolean;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  language: 'en' | 'hi';
  isDarkMode: boolean;

  setUser: (user: User | null) => void;
  setStore: (store: Store | null) => void;
  setToken: (token: string | null) => void;
  setDeviceId: (id: string) => void;
  setApiUrl: (url: string) => void;
  setIsOnline: (online: boolean) => void;
  setIsLocked: (locked: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncTime: (time: string | null) => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  setIsDarkMode: (val: boolean) => void;
  toggleTheme: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  store: null,
  token: null,
  deviceId: 'default-device-1',
  apiUrl: 'http://localhost:4000',
  isOnline: true,
  isLocked: false,
  pendingSyncCount: 0,
  lastSyncTime: null,
  language: 'en',
  isDarkMode:
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('hw_store_dark_mode') === 'true'
      : false,

  setUser: (user) => set({ user }),
  setStore: (store) => set({ store }),
  setToken: (token) => set({ token }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setApiUrl: (apiUrl) => set({ apiUrl }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setIsLocked: (isLocked) => set({ isLocked }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setLanguage: (language) => set({ language }),
  setIsDarkMode: (isDarkMode) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('hw_store_dark_mode', String(isDarkMode));
    }
    set({ isDarkMode });
  },
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDarkMode;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('hw_store_dark_mode', String(next));
      }
      return { isDarkMode: next };
    }),
  logout: () => set({ user: null, token: null, isLocked: false }),
}));
