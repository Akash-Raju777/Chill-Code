import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
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
}

export const useAuthStore = create<AuthState>((set) => {
  // Load initial state from localStorage safely (checking for window presence in Next.js)
  let initialUser: User | null = null;
  let initialToken: string | null = null;

  if (typeof window !== 'undefined') {
    const savedUser = localStorage.getItem('chill_user');
    const savedToken = localStorage.getItem('chill_token');
    if (savedUser && savedToken) {
      try {
        initialUser = JSON.parse(savedUser);
        initialToken = savedToken;
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }
  }

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: !!initialToken,
    login: (user, token) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('chill_user', JSON.stringify(user));
        localStorage.setItem('chill_token', token);
      }
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('chill_user');
        localStorage.removeItem('chill_token');
      }
      set({ user: null, token: null, isAuthenticated: false });
    },
    setUser: (user) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('chill_user', JSON.stringify(user));
      }
      set({ user });
    },
  };
});
