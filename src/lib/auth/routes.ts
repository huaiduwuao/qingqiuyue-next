// 路由访问策略的唯一来源。
//
// 站点生产环境是静态导出(next.config.ts 的 output: 'export'),Next 的 middleware /
// proxy 在生产根本不执行。此前 src/proxy.ts 维护着一份完整的公开路由表却从未生效,
// 真正在跑的是 AuthContext 里另一份只有三项的 PUBLIC_PATHS —— 未登录用户打开任何
// 详情、搜索、分享链接都会被踢去登录页。
//
// 现在只有这一张表:不在公开前缀里的路由需要登录;页面里局部需要登录的功能用 <LoginGate>。

const PUBLIC_PREFIXES = [
  '/home',
  '/detail',
  '/search',
  '/share',
  '/recharge',
  '/download',
  '/wallpaper',
  // 诗词频道与诗人页:和详情页一样是公开内容,未登录就能读
  '/poetry',
  '/gouji',
  '/kf-chat',
  // 关于 / 免责声明 / 数据采集说明:合规页必须未登录可读
  '/legal',
  // 歌单:公开的歌单凭链接就能看和播;「我的歌单」页面里自己提示登录
  '/playlist',
  '/digital-human',
  '/crawled',
  // 用户主页:每个用户都有,未登录也能看(关注/私信等按钮点了再去登录)
  '/u',
  // 个人中心 / 积分:整页由 <LoginGate> 替换内容(看得到入口,登录后才有数据)
  '/account',
  // 登录、第三方登录回调、积分
  '/user',
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 未登录访问时需要跳登录页的路由(后台 /system、AI 创作工具等)。 */
export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}
