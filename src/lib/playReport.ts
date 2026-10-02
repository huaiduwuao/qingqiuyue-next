/**
 * 播放结果上报(后端 POST /api/content/play/report → PG play_outcome,qingqiuyue-go internal/workcat 聚合)。
 *
 * 「能看」以前只是服务端的推断;这里记下真实观众放没放出来:拿到第一帧记 ok,解析 / 加载失败记 fail。
 * 作品主档按播放源聚合成功率,选源时成功率高的排前面。同一页面同一内容同一来源同一结果只报一次。
 */

import { contentClient } from '@/lib/api/client';

const sent = new Set<string>();

function clientKind(): string {
  if (typeof window === 'undefined') return 'web';
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI__ || w.__TAURI_INTERNALS__) return /android/i.test(navigator.userAgent) ? 'android' : 'desktop';
  return /mobile/i.test(navigator.userAgent) ? 'mobile-web' : 'web';
}

export function reportPlay(contentId: string | number, sourceUrl: string, ok: boolean, reason = ''): void {
  const url = (sourceUrl || '').trim();
  if (!contentId || !url) return;
  const key = `${contentId}|${url}|${ok ? 1 : 0}`;
  if (sent.has(key)) return;
  sent.add(key);
  void contentClient('/play/report', {
    method: 'POST',
    data: { contentId: String(contentId), sourceUrl: url, ok, reason: reason.slice(0, 200), client: clientKind() },
  }).catch(() => {
    // 上报失败不影响播放;下次再有结果还会报
    sent.delete(key);
  });
}
