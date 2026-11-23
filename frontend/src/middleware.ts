import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Checks if a JWT token string is structurally expired in Edge Runtime.
 */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = atob(base64);
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
 * Resolves the primary dashboard for a given role.
 */
function getAuthorizedDashboard(role?: string): string {
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('chill_token')?.value;
  const role = request.cookies.get('chill_role')?.value;

  const isProtectedStudent = pathname.startsWith('/student');
  const isProtectedAdmin = pathname.startsWith('/admin');
  const isProtectedSuperAdmin = pathname.startsWith('/super-admin');
  const isProtected = isProtectedStudent || isProtectedAdmin || isProtectedSuperAdmin;
  const isLoginPage = pathname === '/login' || pathname === '/';

  const isTokenExpired = Boolean(token && isJwtExpired(token));
  const isAuthenticated = Boolean(token && role && !isTokenExpired);

  // ─────────────────────────────────────────────────────────────────────────────
  // CASE 1: NOT AUTHENTICATED (or token is structurally expired / invalid)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (isProtected) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      if (token || isTokenExpired) {
        response.cookies.delete('chill_token');
      }
      if (role) {
        response.cookies.delete('chill_role');
      }
      return response;
    }

    if (isLoginPage) {
      const response = NextResponse.next();
      if (isTokenExpired) {
        response.cookies.delete('chill_token');
        response.cookies.delete('chill_role');
      }
      return response;
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CASE 2, 3, 4: AUTHENTICATED USER VISITING LOGIN OR ROOT URL
  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoginPage) {
    const targetDashboard = getAuthorizedDashboard(role);
    return NextResponse.redirect(new URL(targetDashboard, request.url));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROTECTED ROUTE ROLE PERMISSION ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  if (isProtected) {
    if (isProtectedSuperAdmin && role !== 'SUPER_ADMIN') {
      const target = role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
    if (isProtectedAdmin && role !== 'ADMIN') {
      const target = role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/student/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
    if (isProtectedStudent && role !== 'STUDENT') {
      const target = role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/admin/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/student/:path*',
    '/admin/:path*',
    '/super-admin/:path*',
    '/login',
    '/'
  ],
};
