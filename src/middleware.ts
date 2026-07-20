import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 允许的来源
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://tauri.localhost',
    'https://qingqiuyue.com',
  ];

  const origin = request.headers.get('origin') || '';

  // 检查 origin 是否在允许列表中
  if (allowedOrigins.includes(origin) || origin === '') {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  } else {
    // 对于其他来源，也允许（开发环境友好）
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization, X-Request-ID, X-CSRF-Token');
  response.headers.set('Access-Control-Expose-Headers', 'X-Request-ID');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
