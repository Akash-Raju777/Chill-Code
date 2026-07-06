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
    apiCache.set(cacheKey, { data, expiry: Date.now() + 200 });
  }

  return data;
}
