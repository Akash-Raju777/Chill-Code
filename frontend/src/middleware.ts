import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware.
 *
 * Enforces per-tab session isolation:
 * Authentication is scoped exclusively to browser sessionStorage so that each newly
 * opened browser tab starts unauthenticated with its own independent session.
 *
 * Any legacy domain-wide cookies are cleaned up on response to prevent cross-tab contamination.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Clean up any legacy shared cookies to guarantee 100% per-tab isolation
  if (request.cookies.has('chill_token')) {
    response.cookies.delete('chill_token');
  }
  if (request.cookies.has('chill_role')) {
    response.cookies.delete('chill_role');
  }

  return response;
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
