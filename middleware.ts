import { NextRequest, NextResponse } from 'next/server';

const protectedPaths = [
  '/dashboard',
  '/products',
  '/orders',
  '/bills',
  '/settings',
  '/api/products',
  '/api/orders',
  '/api/bills',
  '/api/dashboard',
  '/api/users',
];

const adminPaths = ['/settings/users'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('shop_session')?.value;

  // Allow public paths
  const isPublicPath = pathname === '/login'
    || pathname.startsWith('/api/auth')
    || pathname.startsWith('/_next')
    || pathname.startsWith('/public');

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin-only paths
  if (adminPaths.some((p) => pathname.startsWith(p))) {
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
