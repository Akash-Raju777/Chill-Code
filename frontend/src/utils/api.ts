import { useAuthStore } from '../store/authStore';
import { useBackendStore } from '../store/backendStore';

export class ApiError extends Error {
  status?: number;
  isNetworkError: boolean;
  isAuthError: boolean;

  constructor(message: string, status?: number, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
    this.isAuthError = status === 401 || status === 403;
  }
}

/**
 * Centralized API Base URL Configuration.
 * Automatically switches based on environment:
 * - Local Development (.env.local): http://localhost:8080
 * - Production (.env.production): https://chill-code-2.onrender.com
 * - Production browser fail-safe: ensures deployed frontend NEVER requests localhost
 */
function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

    // In production browser, ensure requests NEVER go to localhost
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

const BASE_URL = resolveBaseUrl();

/** Exported so edge-case callers (keepalive beacon, blob downloads) can build full URLs. */
export { BASE_URL as API_BASE_URL };

const apiCache = new Map<string, { data: any; expiry: number }>();
const inFlightRequests = new Map<string, Promise<any>>();
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export interface ApiCallOptions extends RequestInit {
  skipLocalCache?: boolean;
  isRetry?: boolean;
  timeout?: number;
}

/**
 * Attempt to refresh the JWT session token without logging the user out.
 */
async function attemptTokenRefresh(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const currentToken = useAuthStore.getState().token;
      if (!currentToken) return null;

      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data && data.token) {
        useAuthStore.getState().setToken(data.token);
        return data.token;
      }
      return null;
    } catch (e) {
      console.warn('[API Auth] Token refresh failed:', e);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiCall(endpoint: string, options: ApiCallOptions = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${BASE_URL}${cleanEndpoint}`;

  // Flush cache on mutations
  if (method !== 'GET') {
    apiCache.clear();
  }

  const cacheKey = `${method}:${cleanEndpoint}`;

  // Check Local Cache
  if (method === 'GET' && !options.skipLocalCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
  }

  // Deduplicate in-flight GET requests
  if (method === 'GET' && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const executeRequest = async (): Promise<any> => {
    const token = useAuthStore.getState().token;

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let timeoutId: any;
    let fetchSignal = options.signal;
    if (options.timeout && !fetchSignal) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), options.timeout);
      fetchSignal = controller.signal;
    }

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        cache: 'no-store',
        ...options,
        headers,
        signal: fetchSignal,
      });
      // Successful response clears backend offline status
      if (timeoutId) clearTimeout(timeoutId);
      useBackendStore.getState().setOffline(false);
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
        const msg = isLocal
          ? `Backend request timed out after ${options.timeout}ms.`
          : `Connecting to server, please wait... Cloud backend is waking up.`;
        throw new ApiError(msg, 504, true);
      }
      const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
      useBackendStore.getState().setOffline(true, BASE_URL);

      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Backend Connection Warning] Failed to connect to ${fullUrl}.`);
      } else {
        console.error(`[API Network Error] Failed to connect to ${fullUrl}:`, err);
      }

      const msg = isLocal
        ? `Backend server is not running. Please start the Spring Boot backend on ${BASE_URL} before using the application.`
        : `Connecting to cloud backend... The server may be waking up, please wait a moment.`;
      throw new ApiError(msg, undefined, true);
    }

    // Handle 502/503/504 (Cloud server waking up)
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      useBackendStore.getState().setOffline(true, BASE_URL);
      const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
      const msg = isLocal
        ? `Backend server is temporarily unavailable (${response.status}).`
        : `Connecting to server, please wait... Cloud backend is waking up.`;
      throw new ApiError(msg, response.status, true);
    }

    // Handle 401 Unauthorized with automatic Token Refresh
    if (response.status === 401) {
      const isAuthEndpoint =
        cleanEndpoint === '/api/auth/login' ||
        cleanEndpoint === '/api/auth/register' ||
        cleanEndpoint === '/api/auth/refresh' ||
        cleanEndpoint === '/api/auth/health' ||
        cleanEndpoint === '/api/auth/ping';

      if (!isAuthEndpoint && !options.isRetry) {
        const newToken = await attemptTokenRefresh();
        if (newToken) {
          // Re-try original request once with fresh token
          return apiCall(endpoint, { ...options, isRetry: true });
        }
      }

      // If refresh failed or already retried, clear session
      if (!isAuthEndpoint) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.replace('/login');
        }
      }

      let errMessage = 'Session invalid or expired';
      try {
        errMessage = (await response.text()) || errMessage;
      } catch (_) {}
      throw new ApiError(errMessage, 401, false);
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (_) {}

      const isAccountSuspendedOrInactive =
        errorText.toLowerCase().includes('inactive') ||
        errorText.toLowerCase().includes('suspended');

      if (isAccountSuspendedOrInactive && !cleanEndpoint.includes('/api/auth/login')) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.replace('/login');
        }
        throw new ApiError(errorText || 'Your account is inactive or suspended.', 403, false);
      }

      throw new ApiError(errorText || 'Permission Denied (403)', 403, false);
    }

    // Handle Specific Error Status Codes with Detailed Messages
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (_) {}

      console.error(`[API Error ${response.status}] ${method} ${fullUrl}:`, errorText || response.statusText);

      if (response.status === 404) {
        throw new ApiError(errorText || `API endpoint not found (404): ${cleanEndpoint}`, 404, false);
      }

      if (response.status === 500) {
        throw new ApiError(errorText || `Server returned an unexpected error (500). Please try again later.`, 500, false);
      }

      throw new ApiError(errorText || `API Error: ${response.status} ${response.statusText}`, response.status, false);
    }

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (method === 'GET' && !options.skipLocalCache) {
      // 10s safe cache TTL for GET requests
      apiCache.set(cacheKey, { data, expiry: Date.now() + 10000 });
    }

    return data;
  };

  if (method === 'GET') {
    const promise = executeRequest().finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return executeRequest();
}

// Badge & Achievements APIs
export const fetchMyAchievements = () => apiCall('/api/student/achievements');
export const fetchMyEarnedBadges = () => apiCall('/api/student/badges/earned');
export const fetchAllBadges = () => apiCall('/api/admin/badges');
export const createBadge = (data: any) => apiCall('/api/admin/badges', { method: 'POST', body: JSON.stringify(data) });
export const updateBadge = (id: number, data: any) => apiCall(`/api/admin/badges/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBadge = (id: number) => apiCall(`/api/admin/badges/${id}`, { method: 'DELETE' });
export const toggleBadgeStatus = (id: number, status: string) => apiCall(`/api/admin/badges/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const fetchAllStudentAchievements = () => apiCall('/api/admin/achievements');
export const fetchAllEarnedBadges = () => apiCall('/api/admin/badges/student-badges');
export const assignBadgeManually = (studentId: number, badgeId: number, testId?: number) => apiCall('/api/admin/badges/assign', { method: 'POST', body: JSON.stringify({ studentId, badgeId, testId }) });
export const removeBadgeManually = (studentId: number, badgeId: number) => apiCall('/api/admin/badges/remove', { method: 'POST', body: JSON.stringify({ studentId, badgeId }) });

// Badge Set Management APIs
export const fetchBadgeSets = () => apiCall('/api/admin/badge-sets');
export const createBadgeSet = (data: any) => apiCall('/api/admin/badge-sets', { method: 'POST', body: JSON.stringify(data) });
export const updateBadgeSet = (id: number, data: any) => apiCall(`/api/admin/badge-sets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBadgeSet = (id: number) => apiCall(`/api/admin/badge-sets/${id}`, { method: 'DELETE' });
export const toggleBadgeSetStatus = (id: number, status: string) => apiCall(`/api/admin/badge-sets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const fetchBadgeSetWinners = (id: number) => apiCall(`/api/admin/badge-sets/${id}/winners`);

// Leaderboard APIs
export const fetchSubjectLeaderboard = (subjectId: number) => apiCall(`/api/student/leaderboard/subject/${subjectId}`);
export const fetchTopSubjectRankings = (subjectId: number, limit = 10) => apiCall(`/api/student/leaderboard/top/${subjectId}?limit=${limit}`);
export const fetchOverallLeaderboard = (timeFilter = 'ALL', departmentFilter = 'ALL') => apiCall(`/api/student/leaderboard/overall?timeFilter=${timeFilter}&departmentFilter=${departmentFilter}`);
export const fetchStudentLeaderboardSummary = () => apiCall('/api/student/leaderboard/summary');

// Admin Analytics APIs
export const fetchAdminAnalyticsOverview = () => apiCall('/api/admin/analytics/overview');
export const fetchAdminAnalyticsCharts = () => apiCall('/api/admin/analytics/charts');

/**
 * Format ISO/UTC date-time strings to Indian Standard Time (IST - Asia/Kolkata).
 */
export function formatISTDateTime(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return 'N/A';
  let dateStr = String(dateInput);
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const hasTimezone = trimmed.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(trimmed);
    if (!hasTimezone) {
      dateStr = trimmed.replace(' ', 'T') + '+05:30';
    } else {
      dateStr = trimmed;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatISTDate(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return 'N/A';
  let dateStr = String(dateInput);
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const hasTimezone = trimmed.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(trimmed);
    if (!hasTimezone) {
      dateStr = trimmed.replace(' ', 'T') + '+05:30';
    } else {
      dateStr = trimmed;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
