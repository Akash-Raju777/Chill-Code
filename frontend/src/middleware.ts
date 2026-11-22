import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('chill_token')?.value;
  const role = request.cookies.get('chill_role')?.value;

  const isProtectedStudent = pathname.startsWith('/student');
  const isProtectedAdmin = pathname.startsWith('/admin');
  const isProtectedSuperAdmin = pathname.startsWith('/super-admin');
  const isProtected = isProtectedStudent || isProtectedAdmin || isProtectedSuperAdmin;
  const isLoginPage = pathname === '/login' || pathname === '/';

  // 1. If unauthenticated user tries to access any protected route, redirect to /login immediately
  if (isProtected && (!token || !role)) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('chill_token');
    response.cookies.delete('chill_role');
    return response;
  }

  // 2. If authenticated user attempts cross-role access, redirect to their authorized portal
  if (isProtected && token && role) {
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

  // 3. If authenticated user visits login page (/login or /), redirect to their authorized dashboard
  if (isLoginPage && token && role) {
    if (role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/super-admin/dashboard', request.url));
    }
    if (role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    if (role === 'STUDENT') {
      return NextResponse.redirect(new URL('/student/dashboard', request.url));
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
