/**
 * 客户端诊断上报 → POST /api/content/stream/rules/report,后端只写日志([client-diag])。
 * 用来拿真机现场:本地解析/播放为什么失败、滑动页面为什么没滚 —— 这些在模拟环境里复现不了。
 * 只在客户端里发;同一个 key 本次运行只发一次,不会刷屏。
 */

import { API_PREFIX } from '@/lib/api/prefix';
import { authPlatform, isDesktopClient } from '@/lib/clientAuth';

const sent = new Set<string>();

export function reportDiag(kind: string, key: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !isDesktopClient()) return;
  const dedupe = `${kind}:${key}`;
  if (sent.has(dedupe)) return;
  sent.add(dedupe);
  const body = {
    kind,
    platform: authPlatform(),
    path: location.pathname + location.search,
    viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
    ...data,
  };
  try {
    void fetch(`${API_PREFIX}/api/content/stream/rules/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body).slice(0, 4000),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 上报失败不影响使用 */
  }
}
