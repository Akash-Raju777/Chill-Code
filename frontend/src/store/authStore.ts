import { create } from 'zustand';
import { useTestStore } from './testStore';
import { smartCache } from '../utils/cacheManager';

export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

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
  isInitialized: boolean;
  authStatus: AuthStatus;
  initializeAuth: () => Promise<boolean>;
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

function clearAuthCookies() {
  if (typeof window === 'undefined') return;
  document.cookie = 'chill_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  document.cookie = 'chill_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
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
      return '/login';
  }
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    if (!isLocalhost) {
      const configured = (process.env.NEXT_PUBLIC_API_URL || '').trim();
      if (!configured || configured.includes('localhost') || configured.includes('127.0.0.1')) {
        return 'https://chill-code-2.onrender.com';
      }
      return configured.replace(/\/+$/, '');
    }
  }
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim();
  return raw.replace(/\/+$/, '');
}

/**
 * Checks if a JWT token string is structurally expired.
 */
export function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return true;
    }
    return false;
  } catch (_) {
    return true;
  }
}

/**
 * Verifies a token against the backend (/api/auth/me) with timeout.
 */
async function verifySessionWithBackend(token: string): Promise<User | null> {
  try {
    const baseUrl = getBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const verifiedUser = await res.json();
      if (verifiedUser && verifiedUser.status === 'ACTIVE') {
        return verifiedUser;
      }
    }
    if (res.status === 401 || res.status === 403) {
      return null;
    }
  } catch (err: any) {
    // Network failure / cold-start: if token is structurally unexpired, keep optimistic local user
    if (!isJwtExpired(token)) {
      const stored = sessionStorage.getItem('chill_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (_) {}
      }
    }
  }
  return null;
}

/**
 * Resolves the authenticated session with strict per-tab isolation.
 * Uses sessionStorage EXCLUSIVELY so that each newly opened browser tab
 * starts unauthenticated, while existing tabs preserve authentication on refresh.
 */
function getStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }

  // Purge any legacy shared localStorage auth tokens once to prevent tab cross-talk
  try {
    localStorage.removeItem('chill_user');
    localStorage.removeItem('chill_token');
  } catch (_) {}

  // Check sessionStorage ONLY for this browser tab
  const sessionUser = sessionStorage.getItem('chill_user');
  const sessionToken = sessionStorage.getItem('chill_token');

  if (sessionUser && sessionToken) {
    try {
      const parsedUser = JSON.parse(sessionUser);
      if (!isJwtExpired(sessionToken)) {
        return { user: parsedUser, token: sessionToken };
      }
    } catch (e) {
      sessionStorage.removeItem('chill_user');
      sessionStorage.removeItem('chill_token');
    }
  }

  return { user: null, token: null };
}

let initPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  const initial = getStoredAuth();
  const initiallyAuthed = !!(initial.token && !isJwtExpired(initial.token));

  return {
    user: initial.user,
    token: initial.token,
    isAuthenticated: initiallyAuthed,
    isInitialized: false,
    authStatus: 'INITIALIZING',

    initializeAuth: async (): Promise<boolean> => {
      if (typeof window === 'undefined') {
        return false;
      }

      // Fast path: already verified this tab — never re-hit /api/auth/me on
      // every layout mount / client navigation. Session revocation is still
      // caught by apiCall's 401 handling on any subsequent request.
      const current = get();
      if (current.isInitialized) {
        return current.isAuthenticated;
      }

      if (initPromise) return initPromise;

      initPromise = (async () => {
        const stored = getStoredAuth();

        // Case A: Missing or structurally expired token in this tab
        if (!stored.token || !stored.user || isJwtExpired(stored.token)) {
          clearAuthCookies();
          smartCache.clearAll();
          sessionStorage.removeItem('chill_token');
          sessionStorage.removeItem('chill_user');

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isInitialized: true,
            authStatus: 'UNAUTHENTICATED',
          });
          return false;
        }

        // Case B: Verify session with backend
        const verifiedUser = await verifySessionWithBackend(stored.token);
        if (verifiedUser) {
          sessionStorage.setItem('chill_token', stored.token);
          sessionStorage.setItem('chill_user', JSON.stringify(verifiedUser));

          set({
            user: verifiedUser,
            token: stored.token,
            isAuthenticated: true,
            isInitialized: true,
            authStatus: 'AUTHENTICATED',
          });
          return true;
        } else {
          // Token rejected by backend (401/403 or inactive account)
          clearAuthCookies();
          smartCache.clearAll();
          sessionStorage.removeItem('chill_token');
          sessionStorage.removeItem('chill_user');

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isInitialized: true,
            authStatus: 'UNAUTHENTICATED',
          });
          return false;
        }
      })();

      const result = await initPromise;
      initPromise = null;
      return result;
    },

    login: (user, token) => {
      useTestStore.getState().clearTestSession();
      clearAllCodeBackups();
      smartCache.clearAll();

      if (typeof window !== 'undefined') {
        clearAuthCookies();
        const userJson = JSON.stringify(user);
        sessionStorage.setItem('chill_user', userJson);
        sessionStorage.setItem('chill_token', token);
      }
      set({
        user,
        token,
        isAuthenticated: true,
        isInitialized: true,
        authStatus: 'AUTHENTICATED',
      });
    },

    logout: () => {
      useTestStore.getState().clearTestSession();
      clearAllCodeBackups();
      smartCache.clearAll();

      if (typeof window !== 'undefined') {
        clearAuthCookies();
        sessionStorage.removeItem('chill_user');
        sessionStorage.removeItem('chill_token');
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isInitialized: true,
        authStatus: 'UNAUTHENTICATED',
      });
    },

    setUser: (newUser) => {
      set((state) => {
        if (state.user && JSON.stringify(state.user) === JSON.stringify(newUser)) {
          return state;
        }
        if (typeof window !== 'undefined') {
          const userJson = JSON.stringify(newUser);
          sessionStorage.setItem('chill_user', userJson);
        }
        return { user: newUser };
      });
    },

    setToken: (newToken) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('chill_token', newToken);
      }
      set({
        token: newToken,
        isAuthenticated: true,
        isInitialized: true,
        authStatus: 'AUTHENTICATED',
      });
    },
  };
});
