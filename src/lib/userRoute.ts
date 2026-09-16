// 用户主页路由。每个用户都有一个主页(/u?id=),头像点击一律跳这里。
// 生产是 output:'export' 静态导出,动态段 /u/[id] 导不出来,所以和详情页一样走 query 参数。

export type UserId = number | string;

export function userProfileHref(id: UserId | null | undefined): string | null {
  if (id === null || id === undefined || id === '' || id === 0) return null;
  return `/u?id=${encodeURIComponent(String(id))}`;
}
