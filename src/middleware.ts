import { NextRequest, NextResponse } from 'next/server';

const TOKEN_COOKIE = 'auth-token';

// 公开路由白名单(无需 token)
const PUBLIC_PREFIXES = [
  '/user/login',
  '/user/social-login',
  '/detail',
  '/home',
  '/digital-human',
  '/_next',
  '/favicon',
  '/mockServiceWorker',
  '/api',
  '/static',
  '/images',
  '/avatar',
];

// 仅限管理员 / 已登录用户的路由前缀
const ADMIN_PREFIXES = ['/system', '/admin'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || (p === '/detail' && pathname.startsWith('/detail')));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  // 公开路由直接放行
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 未登录:跳到登录页,带上 next
  if (!token) {
    const loginUrl = new URL('/user/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 管理员路由放行(具体按钮级权限在页面用 useAuthority 控制)
  if (isAdminRoute(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // 匹配除 _next/static/image/favicon.ico/mockServiceWorker.js 外的所有路径
  matcher: ['/((?!_next/static|_next/image|favicon.ico|mockServiceWorker.js).*)'],
};
