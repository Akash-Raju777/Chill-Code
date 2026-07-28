import { useAuthStore } from '../store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const apiCache = new Map<string, { data: any; expiry: number }>();

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  
  if (method !== 'GET') {
    apiCache.clear();
  }

  const cacheKey = `${method}:${endpoint}`;
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

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      cache: 'no-store',
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error('Network connection refused or server offline. Please check your connection.');
  }

  if (response.status === 401 || response.status === 403) {
    if (!endpoint.includes('/api/auth/login')) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
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

