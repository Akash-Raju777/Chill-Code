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

/**
 * Returns the primary route dashboard for a given role.
 */
export function getAuthorizedDashboard(role?: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'STUDENT':
      return '/student/dashboard';
    default:
      return '/';
  }
}

/**
 * Resolves the authenticated session with strict per-tab isolation.
 * Priority:
 * 1. sessionStorage (isolated strictly to the current browser tab)
 * 2. localStorage fallback (only for newly opened blank tabs inheriting the initial session)
 */
function getStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }

  // 1. Check sessionStorage FIRST for per-tab isolation
  const sessionUser = sessionStorage.getItem('chill_user');
  const sessionToken = sessionStorage.getItem('chill_token');

  if (sessionUser && sessionToken) {
    try {
      const parsedUser = JSON.parse(sessionUser);
      return { user: parsedUser, token: sessionToken };
    } catch (e) {
      sessionStorage.removeItem('chill_user');
      sessionStorage.removeItem('chill_token');
    }
  }

  // 2. Fallback to localStorage ONLY if this tab does not have a session yet (e.g. freshly opened blank tab)
  const localUser = localStorage.getItem('chill_user');
  const localToken = localStorage.getItem('chill_token');

  if (localUser && localToken) {
    try {
      const parsedUser = JSON.parse(localUser);
      // Clone into this tab's sessionStorage so future tab actions remain isolated
      sessionStorage.setItem('chill_user', localUser);
      sessionStorage.setItem('chill_token', localToken);
      return { user: parsedUser, token: localToken };
    } catch (e) {
      localStorage.removeItem('chill_user');
      localStorage.removeItem('chill_token');
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
      // Clear any previous student test session and local code backups
      useTestStore.getState().clearTestSession();
      clearAllCodeBackups();

      if (typeof window !== 'undefined') {
        const userJson = JSON.stringify(user);
        // Primary: Isolated per-tab storage
        sessionStorage.setItem('chill_user', userJson);
        sessionStorage.setItem('chill_token', token);

        // Fallback: Default session for new tabs opened in the future
        localStorage.setItem('chill_user', userJson);
        localStorage.setItem('chill_token', token);
      }
      set({ user, token, isAuthenticated: true });
    },

    logout: () => {
      const currentToken = useAuthStore.getState().token;
      useTestStore.getState().clearTestSession();
      clearAllCodeBackups();

      if (typeof window !== 'undefined') {
        // Clear this tab's isolated session
        sessionStorage.removeItem('chill_user');
        sessionStorage.removeItem('chill_token');

        // Only clear localStorage if it belongs to this same session
        const storedLocalToken = localStorage.getItem('chill_token');
        if (!storedLocalToken || storedLocalToken === currentToken) {
          localStorage.removeItem('chill_user');
          localStorage.removeItem('chill_token');
        }
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
          sessionStorage.setItem('chill_user', userJson);
          // Update localStorage only if this tab's user matches localStorage
          const localUser = localStorage.getItem('chill_user');
          if (localUser) {
            try {
              const parsed = JSON.parse(localUser);
              if (parsed.id === newUser.id) {
                localStorage.setItem('chill_user', userJson);
              }
            } catch (_) {}
          }
        }
        return { user: newUser };
      });
    },

    setToken: (newToken) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('chill_token', newToken);
        localStorage.setItem('chill_token', newToken);
      }
      set({ token: newToken, isAuthenticated: true });
    },
  };
});
