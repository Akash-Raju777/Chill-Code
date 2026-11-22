import { create } from 'zustand';
import { useTestStore } from './testStore';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'STUDENT' | 'SUPER_ADMIN';
  registerNumber?: string;
  username?: string;
  status: string;
  department?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

function clearAllCodeBackups() {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('chillcode_code_backup_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

function getStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }

  // Check localStorage first (multi-tab persistence), then sessionStorage (tab isolation fallback)
  const savedUser = localStorage.getItem('chill_user') || sessionStorage.getItem('chill_user');
  const savedToken = localStorage.getItem('chill_token') || sessionStorage.getItem('chill_token');

  if (savedUser && savedToken) {
    try {
      const parsedUser = JSON.parse(savedUser);
      // Ensure both storages are populated for compatibility
      localStorage.setItem('chill_user', savedUser);
      localStorage.setItem('chill_token', savedToken);
      sessionStorage.setItem('chill_user', savedUser);
      sessionStorage.setItem('chill_token', savedToken);
      return { user: parsedUser, token: savedToken };
    } catch (e) {
      console.error('Failed to parse saved auth user:', e);
    }
  }

  return { user: null, token: null };
}

export const useAuthStore = create<AuthState>((set) => {
  const initial = getStoredAuth();

  return {
    user: initial.user,
    token: initial.token,
    isAuthenticated: !!initial.token,
    login: (user, token) => {
      // Clear any previous student's test session and code backups
      useTestStore.getState().clearTestSession();
      clearAllCodeBackups();

      if (typeof window !== 'undefined') {
        const userJson = JSON.stringify(user);
        localStorage.setItem('chill_user', userJson);
        localStorage.setItem('chill_token', token);
        sessionStorage.setItem('chill_user', userJson);
        sessionStorage.setItem('chill_token', token);
      }
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      useTestStore.getState().clearTestSession();
      clearAllCodeBackups();

      if (typeof window !== 'undefined') {
        localStorage.removeItem('chill_user');
        localStorage.removeItem('chill_token');
        sessionStorage.removeItem('chill_user');
        sessionStorage.removeItem('chill_token');
      }
      set({ user: null, token: null, isAuthenticated: false });
    },
    setUser: (newUser) => {
      set((state) => {
        if (state.user && JSON.stringify(state.user) === JSON.stringify(newUser)) {
          return state;
        }
        if (typeof window !== 'undefined') {
          const userJson = JSON.stringify(newUser);
          localStorage.setItem('chill_user', userJson);
          sessionStorage.setItem('chill_user', userJson);
        }
        return { user: newUser };
      });
    },
    setToken: (newToken) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('chill_token', newToken);
        sessionStorage.setItem('chill_token', newToken);
      }
      set({ token: newToken, isAuthenticated: true });
    },
  };
});

// Setup Cross-tab Synchronization Listener in Browser
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'chill_token') {
      if (!event.newValue) {
        // Logged out in another tab
        useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
      } else {
        useAuthStore.setState({ token: event.newValue, isAuthenticated: true });
      }
    } else if (event.key === 'chill_user') {
      if (event.newValue) {
        try {
          const parsedUser = JSON.parse(event.newValue);
          useAuthStore.setState({ user: parsedUser });
        } catch (_) {}
      } else {
        useAuthStore.setState({ user: null });
      }
    }
  });
}
