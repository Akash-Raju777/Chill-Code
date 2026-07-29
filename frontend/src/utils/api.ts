import { useAuthStore } from '../store/authStore';
import { useBackendStore } from '../store/backendStore';

/**
 * Centralized API Base URL Configuration.
 * Automatically switches based on environment:
 * - Local Development (.env.local): http://localhost:8080
 * - Production (.env.production): https://chill-code-2.onrender.com
 */
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const BASE_URL = RAW_API_URL.replace(/\/$/, '');

const apiCache = new Map<string, { data: any; expiry: number }>();

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${BASE_URL}${cleanEndpoint}`;

  if (method !== 'GET') {
    apiCache.clear();
  }

  const cacheKey = `${method}:${cleanEndpoint}`;
  if (method === 'GET') {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
  }

  const token = useAuthStore.getState().token;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      cache: 'no-store',
      ...options,
      headers,
    });
    // Successful response clears backend offline status
    useBackendStore.getState().setOffline(false);
  } catch (err: any) {
    const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
    useBackendStore.getState().setOffline(true, BASE_URL);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Backend Connection Warning] Failed to connect to ${fullUrl}.`);
    } else {
      console.error(`[API Network Error] Failed to connect to ${fullUrl}:`, err);
    }

    if (isLocal) {
      throw new Error(
        `Backend server is not running. Please start the Spring Boot backend on ${BASE_URL} before using the application.`
      );
    } else {
      throw new Error(
        `Unable to connect to cloud backend (${BASE_URL}). Please check your connection or try again later.`
      );
    }
  }

  // Handle Authentication / Session Failures
  if (response.status === 401 || response.status === 403) {
    if (!cleanEndpoint.includes('/api/auth/login')) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }

  // Handle Specific Error Status Codes with Detailed Messages
  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (_) {}

    console.error(`[API Error ${response.status}] ${method} ${fullUrl}:`, errorText || response.statusText);

    if (response.status === 404) {
      throw new Error(errorText || `API endpoint not found (404): ${cleanEndpoint}`);
    }

    if (response.status === 500) {
      throw new Error(errorText || `Server returned an unexpected error (500). Please try again later.`);
    }

    throw new Error(errorText || `API Error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (method === 'GET') {
    apiCache.set(cacheKey, { data, expiry: Date.now() + 1500 });
  }

  return data;
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
export const assignBadgeManually = (studentId: number, badgeId: number) => apiCall('/api/admin/badges/assign', { method: 'POST', body: JSON.stringify({ studentId, badgeId }) });
export const removeBadgeManually = (studentId: number, badgeId: number) => apiCall('/api/admin/badges/remove', { method: 'POST', body: JSON.stringify({ studentId, badgeId }) });

// Badge Set Management APIs
export const fetchBadgeSets = () => apiCall('/api/admin/badge-sets');
export const createBadgeSet = (data: any) => apiCall('/api/admin/badge-sets', { method: 'POST', body: JSON.stringify(data) });
export const updateBadgeSet = (id: number, data: any) => apiCall(`/api/admin/badge-sets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBadgeSet = (id: number) => apiCall(`/api/admin/badge-sets/${id}`, { method: 'DELETE' });
export const toggleBadgeSetStatus = (id: number, status: string) => apiCall(`/api/admin/badge-sets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

// Leaderboard APIs
export const fetchSubjectLeaderboard = (subjectId: number) => apiCall(`/api/student/leaderboard/subject/${subjectId}`);
export const fetchTopSubjectRankings = (subjectId: number, limit = 10) => apiCall(`/api/student/leaderboard/top/${subjectId}?limit=${limit}`);
export const fetchOverallLeaderboard = (timeFilter = 'ALL', departmentFilter = 'ALL') => apiCall(`/api/student/leaderboard/overall?timeFilter=${timeFilter}&departmentFilter=${departmentFilter}`);
export const fetchStudentLeaderboardSummary = () => apiCall('/api/student/leaderboard/summary');

/**
 * Format ISO/UTC date-time strings to Indian Standard Time (IST - Asia/Kolkata).
 */
export function formatISTDateTime(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return 'N/A';
  let dateStr = String(dateInput);
  if (typeof dateInput === 'string' && !dateInput.endsWith('Z') && !dateInput.includes('+') && !dateInput.includes('-0') && !dateInput.includes('+0')) {
    dateStr = dateInput + 'Z';
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
  if (typeof dateInput === 'string' && !dateInput.endsWith('Z') && !dateInput.includes('+') && !dateInput.includes('-0') && !dateInput.includes('+0')) {
    dateStr = dateInput + 'Z';
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
