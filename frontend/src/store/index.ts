import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token?: string | null) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const TOKEN_STORAGE_KEY = 'token';
const AUTH_STORAGE_KEY = 'auth-storage';

function canUseWebStorage(storage: 'localStorage' | 'sessionStorage') {
  return typeof window !== 'undefined' && typeof window[storage] !== 'undefined';
}

function getLegacyAuthSnapshot() {
  if (!canUseWebStorage('localStorage')) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function migrateLegacyAuthState() {
  if (!canUseWebStorage('sessionStorage')) {
    return;
  }

  const session = window.sessionStorage;
  const local = canUseWebStorage('localStorage') ? window.localStorage : null;
  if (!local || session.getItem(AUTH_STORAGE_KEY)) {
    return;
  }

  const legacyAuth = getLegacyAuthSnapshot();
  const legacyToken = local.getItem(TOKEN_STORAGE_KEY);

  if (legacyAuth) {
    session.setItem(AUTH_STORAGE_KEY, JSON.stringify(legacyAuth));
  }

  if (legacyToken) {
    session.setItem(TOKEN_STORAGE_KEY, legacyToken);
    local.removeItem(TOKEN_STORAGE_KEY);
  }
}

function clearLegacyAuthState() {
  if (canUseWebStorage('localStorage')) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem('user');
  }
}

export function getStoredToken(): string | null {
  migrateLegacyAuthState();

  if (!canUseWebStorage('sessionStorage')) {
    return null;
  }

  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

migrateLegacyAuthState();

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token = null) => {
        if (canUseWebStorage('sessionStorage')) {
          if (token) {
            window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
          } else {
            window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          }
        }
        clearLegacyAuthState();
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        if (canUseWebStorage('sessionStorage')) {
          window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        clearLegacyAuthState();
        set({ user: null, token: null, isAuthenticated: false });
      },
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

interface AppState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapse: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapse: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

interface AIState {
  enabled: boolean;
  defaultProvider: string;
  availableProviders: string[];
  setStatus: (status: { enabled: boolean; defaultProvider: string; availableProviders: string[] }) => void;
}

export const useAIStore = create<AIState>((set) => ({
  enabled: false,
  defaultProvider: 'openai',
  availableProviders: [],
  setStatus: (status) => set(status),
}));
