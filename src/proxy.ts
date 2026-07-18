import { NextRequest, NextResponse } from 'next/server';

const TOKEN_COOKIE = 'auth-token';

// 公开路由白名单(无需 token)—— 路由可访问,但页面里需要登录的局部内容
// 会被 <LoginGate> 包起来显示锁图标(不强制整页跳登录)
const PUBLIC_PREFIXES = [
  '/',              // 根路径 → src/app/page.tsx 内部 redirect 到 /home/recommend
  '/user/login',
  '/user/social-login',
  '/detail',
  '/home',
  '/digital-human',
  '/search',
  '/share',
  '/recharge',
  '/download',
  '/wallpaper',
  '/gouji',
  '/kf-chat',
  '/hermes',
  '/crawled',
  '/account',     // 个人中心:整页 LoginGate 替换内容(看得到路径,看不到数据)
  '/user',        // 积分等
  '/_next',
  '/favicon',
  '/mockServiceWorker',
  '/api',
  '/static',
  '/images',
  '/avatar',
  '/avatars',  // 数字人抠像视频库(public/avatars/*)
  '/wake',     // openWakeWord 模型文件(public/wake/*.onnx,客户端推理需要)
  '/ort-wasm', // onnxruntime-web 运行时 WASM/.mjs(public/ort-wasm/*)
  '/_raw-test.html',  // 调试页面(three.js 加载 GLB 测试)
  '/test-render.html',  // 调试页面
];

// 仅限管理员 / 已登录用户的路由前缀
const ADMIN_PREFIXES = ['/system', '/admin'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || (p === '/detail' && pathname.startsWith('/detail')));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function proxy(request: NextRequest) {
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
