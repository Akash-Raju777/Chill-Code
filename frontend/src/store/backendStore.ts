import { create } from 'zustand';

interface BackendStore {
  isOffline: boolean;
  offlineUrl: string;
  isConnecting: boolean;
  setOffline: (offline: boolean, url?: string) => void;
  setConnecting: (connecting: boolean) => void;
}

export const useBackendStore = create<BackendStore>((set) => ({
  isOffline: false,
  offlineUrl: '',
  isConnecting: false,
  setOffline: (offline: boolean, url: string = '') =>
    set({ isOffline: offline, offlineUrl: url, isConnecting: false }),
  setConnecting: (connecting: boolean) => set({ isConnecting: connecting }),
}));
