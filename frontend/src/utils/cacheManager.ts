/**
 * Chill Code - Intelligent Smart Cache Manager
 *
 * Implements high-performance, role-aware, user-isolated caching with:
 * - Two-tier storage (Fast In-Memory Map + SessionStorage Tab Resilience)
 * - Strict User & Role Scope Isolation (Never leak data across accounts or roles)
 * - Sensitive Endpoint Safeguards (Never cache credentials, tokens, or auth endpoints)
 * - Dynamic TTL & Stale-While-Revalidate (SWR) for instantaneous page transitions
 * - Granular Automatic Cache Invalidation on Mutations
 * - Zero external caching library bloat
 */

import { useAuthStore } from '../store/authStore';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  freshUntil: number;
  staleUntil: number;
  userScope: string;
  tag?: string;
}

export interface CacheConfig {
  freshDurationMs: number;
  staleDurationMs: number;
  tag?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT CONFIGURATION & SENSITIVITY GUARDS
// ─────────────────────────────────────────────────────────────────────────────

const NON_CACHEABLE_PATTERNS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/reset-password',
  '/api/auth/health',
  '/api/health',
  '/api/student/profile', // Kept LIVE for real-time 5s account security heartbeat (Rule 3)
];

const ROUTE_CACHE_PROFILES: Array<{ prefix: string; config: CacheConfig }> = [
  // Leaderboards & Achievements (Frequently read, slower change)
  {
    prefix: '/api/student/leaderboard',
    config: { freshDurationMs: 45_000, staleDurationMs: 600_000, tag: 'student-leaderboard' },
  },
  {
    prefix: '/api/student/achievements',
    config: { freshDurationMs: 45_000, staleDurationMs: 600_000, tag: 'student-achievements' },
  },
  {
    prefix: '/api/student/badges',
    config: { freshDurationMs: 45_000, staleDurationMs: 600_000, tag: 'student-badges' },
  },
  {
    prefix: '/api/admin/badges',
    config: { freshDurationMs: 45_000, staleDurationMs: 600_000, tag: 'admin-badges' },
  },

  // Student Dashboard & Submissions
  {
    prefix: '/api/student/dashboard/stats',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'student-dashboard' },
  },
  {
    prefix: '/api/student/submissions',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'student-submissions' },
  },
  {
    prefix: '/api/student/tests',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'student-tests' },
  },

  // Admin Management & Dashboards
  {
    prefix: '/api/admin/analytics',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'admin-analytics' },
  },
  {
    prefix: '/api/admin/dashboard',
    config: { freshDurationMs: 20_000, staleDurationMs: 300_000, tag: 'admin-dashboard' },
  },
  {
    prefix: '/api/admin/tests',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'admin-tests' },
  },
  {
    prefix: '/api/admin/questions',
    config: { freshDurationMs: 30_000, staleDurationMs: 300_000, tag: 'admin-questions' },
  },
  {
    prefix: '/api/admin/subjects',
    config: { freshDurationMs: 40_000, staleDurationMs: 600_000, tag: 'admin-subjects' },
  },
  {
    prefix: '/api/admin/students',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'admin-students' },
  },
  {
    prefix: '/api/admin/ash',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'admin-results' },
  },

  // Super Admin Endpoints
  {
    prefix: '/api/super-admin/dashboard',
    config: { freshDurationMs: 20_000, staleDurationMs: 300_000, tag: 'super-admin-dashboard' },
  },
  {
    prefix: '/api/super-admin/staff',
    config: { freshDurationMs: 30_000, staleDurationMs: 300_000, tag: 'super-admin-staff' },
  },
  {
    prefix: '/api/super-admin/students',
    config: { freshDurationMs: 30_000, staleDurationMs: 300_000, tag: 'super-admin-students' },
  },
  {
    prefix: '/api/super-admin/assessments',
    config: { freshDurationMs: 30_000, staleDurationMs: 300_000, tag: 'super-admin-assessments' },
  },
  {
    prefix: '/api/super-admin/results',
    config: { freshDurationMs: 25_000, staleDurationMs: 300_000, tag: 'super-admin-results' },
  },
];

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  freshDurationMs: 15_000,
  staleDurationMs: 180_000,
  tag: 'general',
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHE MANAGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SmartCacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly storagePrefix = 'chill_cache_';
  private listeners = new Map<string, Set<(data: any) => void>>();

  /**
   * Resolves the current user scope: e.g. "STUDENT:3" or "ADMIN:2".
   * Guarantees 100% cache isolation between users and roles.
   */
  public getUserScope(): string {
    const user = useAuthStore.getState().user;
    if (!user || !user.id || !user.role) return 'ANON';
    return `${user.role}:${user.id}`;
  }

  /**
   * Evaluates whether an endpoint is eligible for caching.
   */
  public isCacheable(endpoint: string, method: string): boolean {
    if (method.toUpperCase() !== 'GET') return false;
    for (const pattern of NON_CACHEABLE_PATTERNS) {
      if (endpoint === pattern || endpoint.startsWith(pattern + '?')) {
        return false;
      }
    }
    return true;
  }

  public normalizeEndpoint(endpoint: string): string {
    let clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    clean = clean.replace(/([?&])(t|_|timestamp)=\d+(&|$)/g, '$1').replace(/[?&]$/, '');
    return clean;
  }

  /**
   * Generates a fully isolated cache key: `${userScope}:GET:${cleanEndpoint}`.
   */
  public getCacheKey(endpoint: string): string {
    const clean = this.normalizeEndpoint(endpoint);
    return `${this.getUserScope()}:GET:${clean}`;
  }

  /**
   * Resolves the cache configuration (fresh duration, stale duration, tag) for a given endpoint.
   */
  public getConfig(endpoint: string): CacheConfig {
    const clean = this.normalizeEndpoint(endpoint);
    for (const item of ROUTE_CACHE_PROFILES) {
      if (clean === item.prefix || clean.startsWith(item.prefix + '/') || clean.startsWith(item.prefix + '?')) {
        return item.config;
      }
    }
    return DEFAULT_CACHE_CONFIG;
  }

  /**
   * Retrieves an entry from cache. Checks Memory first, then SessionStorage.
   * Returns:
   * - { status: 'FRESH', data } if within freshDuration
   * - { status: 'STALE', data } if expired but within staleDuration (serve instantly & background fetch)
   * - { status: 'MISS' } if not cached or beyond staleDuration
   */
  public get<T = any>(endpoint: string): { status: 'FRESH' | 'STALE' | 'MISS'; data?: T } {
    const key = this.getCacheKey(endpoint);
    const now = Date.now();
    const currentScope = this.getUserScope();

    // 1. Check in-memory Map
    let entry = this.memoryCache.get(key);

    // 2. Fallback to SessionStorage if not in memory (e.g. after page refresh)
    if (!entry && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`${this.storagePrefix}${key}`);
        if (stored) {
          entry = JSON.parse(stored);
          if (entry && entry.userScope === currentScope) {
            this.memoryCache.set(key, entry);
          } else {
            entry = undefined;
          }
        }
      } catch (_) {}
    }

    if (!entry) {
      return { status: 'MISS' };
    }

    // Verify scope ownership (never return another user's data)
    if (entry.userScope !== currentScope) {
      this.deleteKey(key);
      return { status: 'MISS' };
    }

    if (now <= entry.freshUntil) {
      return { status: 'FRESH', data: entry.data };
    }

    if (now <= entry.staleUntil) {
      return { status: 'STALE', data: entry.data };
    }

    // Completely expired
    this.deleteKey(key);
    return { status: 'MISS' };
  }

  /**
   * Stores response data with user isolation and TTL.
   */
  public set<T = any>(endpoint: string, data: T, customConfig?: Partial<CacheConfig>): void {
    if (!this.isCacheable(endpoint, 'GET')) return;

    const key = this.getCacheKey(endpoint);
    const config = { ...this.getConfig(endpoint), ...customConfig };
    const now = Date.now();
    const currentScope = this.getUserScope();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      freshUntil: now + config.freshDurationMs,
      staleUntil: now + config.staleDurationMs,
      userScope: currentScope,
      tag: config.tag,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in sessionStorage for fast tab navigation & page refresh
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`${this.storagePrefix}${key}`, JSON.stringify(entry));
      } catch (_) {}
    }

    // Notify any active subscribers
    const subs = this.listeners.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(data);
        } catch (_) {}
      });
    }
  }

  /**
   * Deletes a specific cache key from memory and storage.
   */
  public deleteKey(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`${this.storagePrefix}${key}`);
      } catch (_) {}
    }
  }

  /**
   * Invalidates cached entries by tag or pattern.
   */
  public invalidateTag(tag: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tag === tag) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((k) => this.deleteKey(k));

    if (typeof window !== 'undefined') {
      const storageKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(this.storagePrefix)) {
          storageKeys.push(k);
        }
      }
      for (const k of storageKeys) {
        try {
          const raw = sessionStorage.getItem(k);
          if (raw) {
            const entry = JSON.parse(raw);
            if (entry.tag === tag) {
              sessionStorage.removeItem(k);
            }
          }
        } catch (_) {}
      }
    }
  }

  /**
   * Automatically invalidates relevant cached queries when a mutation executes.
   */
  public invalidateOnMutation(endpoint: string, method: string): void {
    const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Student Submissions / Tests
    if (clean.includes('/student/submissions') || clean.includes('/student/tests') || clean.includes('/submit')) {
      this.invalidateTag('student-dashboard');
      this.invalidateTag('student-submissions');
      this.invalidateTag('student-tests');
      this.invalidateTag('student-leaderboard');
      this.invalidateTag('admin-dashboard');
      this.invalidateTag('admin-results');
      return;
    }

    // Admin Tests & Questions
    if (clean.includes('/admin/tests')) {
      this.invalidateTag('admin-dashboard');
      this.invalidateTag('admin-tests');
      this.invalidateTag('admin-analytics');
      this.invalidateTag('student-tests');
      return;
    }

    if (clean.includes('/admin/questions')) {
      this.invalidateTag('admin-questions');
      this.invalidateTag('admin-tests');
      this.invalidateTag('student-tests');
      return;
    }

    // Admin Subjects
    if (clean.includes('/admin/subjects')) {
      this.invalidateTag('admin-subjects');
      this.invalidateTag('admin-dashboard');
      this.invalidateTag('student-tests');
      return;
    }

    // Admin Students / Reattempt Approvals
    if (clean.includes('/admin/students') || clean.includes('/reattempt') || clean.includes('/approve')) {
      this.invalidateTag('admin-students');
      this.invalidateTag('admin-dashboard');
      this.invalidateTag('student-submissions');
      this.invalidateTag('student-tests');
      return;
    }

    // Badges & Badge Sets
    if (clean.includes('/badges') || clean.includes('/badge-sets')) {
      this.invalidateTag('admin-badges');
      this.invalidateTag('student-badges');
      this.invalidateTag('student-achievements');
      this.invalidateTag('student-dashboard');
      return;
    }

    // Super Admin Mutations
    if (clean.includes('/super-admin')) {
      this.invalidateTag('super-admin-dashboard');
      this.invalidateTag('super-admin-staff');
      this.invalidateTag('super-admin-students');
      this.invalidateTag('super-admin-assessments');
      this.invalidateTag('super-admin-results');
      return;
    }

    // Generic fallback for any mutation: clear memory cache for current scope
    const currentScope = this.getUserScope();
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.userScope === currentScope) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((k) => this.deleteKey(k));
  }

  /**
   * Completely purges all cached data on logout or account switch.
   * Prevents any residual information from being accessible by subsequent users.
   */
  public clearAll(): void {
    this.memoryCache.clear();
    this.listeners.clear();

    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(this.storagePrefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }
  }

  /**
   * Subscribes to updates for a specific endpoint (for background SWR revalidation).
   */
  public subscribe(endpoint: string, callback: (data: any) => void): () => void {
    const key = this.getCacheKey(endpoint);
    let subs = this.listeners.get(key);
    if (!subs) {
      subs = new Set();
      this.listeners.set(key, subs);
    }
    subs.add(callback);
    return () => {
      subs?.delete(callback);
      if (subs?.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
}

export const smartCache = new SmartCacheManager();
